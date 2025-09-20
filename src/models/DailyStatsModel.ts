import { database } from '../database';
import { DailyStats } from './types';

export class DailyStatsModel {
  // 更新今日统计数据
  static async updateTodayStats(oddIncrement: number = 0, evenIncrement: number = 0): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    
    // 使用 UPSERT 语法
    await database.run(
      `INSERT INTO daily_stats (date, total_blocks, odd_count, even_count, updated_at) 
       VALUES (?, 1, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(date) DO UPDATE SET
         total_blocks = total_blocks + 1,
         odd_count = odd_count + ?,
         even_count = even_count + ?,
         updated_at = CURRENT_TIMESTAMP`,
      [today, oddIncrement, evenIncrement, oddIncrement, evenIncrement]
    );
  }

  // 获取今日统计
  static async getTodayStats(): Promise<DailyStats | null> {
    const today = new Date().toISOString().split('T')[0];
    
    const result = await database.get(
      'SELECT * FROM daily_stats WHERE date = ?',
      [today]
    );
    
    return result || null;
  }

  // 获取指定日期统计
  static async getStatsByDate(date: string): Promise<DailyStats | null> {
    const result = await database.get(
      'SELECT * FROM daily_stats WHERE date = ?',
      [date]
    );
    
    return result || null;
  }

  // 获取最近N天的统计数据
  static async getRecentStats(days: number = 30): Promise<DailyStats[]> {
    const results = await database.all(
      'SELECT * FROM daily_stats ORDER BY date DESC LIMIT ?',
      [days]
    );
    
    return results;
  }

  // 获取月度统计汇总
  static async getMonthlyStats(year: number, month: number): Promise<{
    totalBlocks: number;
    totalOdd: number;
    totalEven: number;
    daysCount: number;
  }> {
    const monthStr = `${year}-${month.toString().padStart(2, '0')}`;
    
    const result = await database.get(
      `SELECT 
        SUM(total_blocks) as totalBlocks,
        SUM(odd_count) as totalOdd,
        SUM(even_count) as totalEven,
        COUNT(*) as daysCount
       FROM daily_stats 
       WHERE date LIKE ?`,
      [`${monthStr}%`]
    );
    
    return {
      totalBlocks: result?.totalBlocks || 0,
      totalOdd: result?.totalOdd || 0,
      totalEven: result?.totalEven || 0,
      daysCount: result?.daysCount || 0
    };
  }

  // 获取历史趋势数据（用于图表）
  static async getTrendData(days: number = 7): Promise<Array<{
    date: string;
    total: number;
    odd: number;
    even: number;
    oddRate: number;
  }>> {
    const results = await database.all(
      `SELECT 
        date,
        total_blocks as total,
        odd_count as odd,
        even_count as even,
        CASE 
          WHEN total_blocks > 0 THEN ROUND((odd_count * 100.0 / total_blocks), 2)
          ELSE 0 
        END as oddRate
       FROM daily_stats 
       ORDER BY date DESC 
       LIMIT ?`,
      [days]
    );
    
    return results.reverse(); // 按日期正序返回
  }

  // 手动重新计算统计数据（数据修复功能）
  static async recalculateStats(date: string): Promise<DailyStats> {
    // 从区块表重新计算指定日期的统计
    const result = await database.get(
      `SELECT 
        COUNT(*) as total_blocks,
        SUM(CASE WHEN is_odd = 1 THEN 1 ELSE 0 END) as odd_count,
        SUM(CASE WHEN is_odd = 0 THEN 1 ELSE 0 END) as even_count
       FROM blocks 
       WHERE date(datetime(timestamp/1000, 'unixepoch')) = ?`,
      [date]
    );

    const statsData = {
      date,
      total_blocks: result?.total_blocks || 0,
      odd_count: result?.odd_count || 0,
      even_count: result?.even_count || 0
    };

    // 更新或插入统计数据
    await database.run(
      `INSERT INTO daily_stats (date, total_blocks, odd_count, even_count, updated_at) 
       VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(date) DO UPDATE SET
         total_blocks = ?,
         odd_count = ?,
         even_count = ?,
         updated_at = CURRENT_TIMESTAMP`,
      [
        statsData.date,
        statsData.total_blocks,
        statsData.odd_count,
        statsData.even_count,
        statsData.total_blocks,
        statsData.odd_count,
        statsData.even_count
      ]
    );

    return statsData;
  }

  // 清理过期统计数据
  static async cleanupOldStats(keepDays: number = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - keepDays);
    const cutoffDateStr = cutoffDate.toISOString().split('T')[0];
    
    const result = await database.run(
      'DELETE FROM daily_stats WHERE date < ?',
      [cutoffDateStr]
    );
    
    return result.changes || 0;
  }
}