import { database } from '../database';

// 区块打点信息接口
export interface BlockPoint {
  id?: number;
  block_number: number;
  block_hash: string;
  timestamp: number;
  last_digit: number;
  is_odd: boolean;
  point_change: number;  // +1 or -1
  cumulative_score: number;  // 累积分数
  created_at?: string;
}

// 时间范围类型
export type TimeRange = '1day' | '1week' | '1month';

export class BlockPointsModel {
  // 添加新的区块打点数据
  static async addBlockPoint(
    blockNumber: number,
    blockHash: string,
    timestamp: number,
    lastDigit: number,
    isOdd: boolean
  ): Promise<BlockPoint> {
    try {
      // 获取最新的累积分数
      const lastPoint = await this.getLatestPoint();
      const lastCumulativeScore = lastPoint ? lastPoint.cumulative_score : 0;
      
      // 计算分数变化：双数+1，单数-1
      const pointChange = isOdd ? -1 : 1;
      const newCumulativeScore = lastCumulativeScore + pointChange;

      // 插入新记录
      await database.run(
        `INSERT INTO block_points (
          block_number, block_hash, timestamp, last_digit,
          is_odd, point_change, cumulative_score
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [blockNumber, blockHash, timestamp, lastDigit, isOdd, pointChange, newCumulativeScore]
      );

      console.log(`📊 区块打点: #${blockNumber} ${isOdd ? '单数(-1)' : '双数(+1)'} 累积分数: ${newCumulativeScore}`);

      return {
        block_number: blockNumber,
        block_hash: blockHash,
        timestamp,
        last_digit: lastDigit,
        is_odd: isOdd,
        point_change: pointChange,
        cumulative_score: newCumulativeScore
      };
    } catch (error) {
      console.error('添加区块打点数据失败:', error);
      throw error;
    }
  }

  // 获取最新的打点数据
  static async getLatestPoint(): Promise<BlockPoint | null> {
    const result = await database.get(
      'SELECT * FROM block_points ORDER BY block_number DESC LIMIT 1'
    );
    
    if (result) {
      return {
        ...result,
        is_odd: Boolean(result.is_odd)
      };
    }
    return null;
  }

  // 获取指定时间范围的打点数据
  static async getPointsByTimeRange(timeRange: TimeRange, limit: number = 1000): Promise<BlockPoint[]> {
    let timeCondition = '';
    let params: any[] = [];

    const now = Date.now();
    switch (timeRange) {
      case '1day':
        const oneDayAgo = now - (24 * 60 * 60 * 1000);
        timeCondition = 'WHERE timestamp >= ?';
        params = [oneDayAgo];
        break;
      case '1week':
        const oneWeekAgo = now - (7 * 24 * 60 * 60 * 1000);
        timeCondition = 'WHERE timestamp >= ?';
        params = [oneWeekAgo];
        break;
      case '1month':
        const oneMonthAgo = now - (30 * 24 * 60 * 60 * 1000);
        timeCondition = 'WHERE timestamp >= ?';
        params = [oneMonthAgo];
        break;
    }

    // 修复: 获取时间范围内最新的N条记录，而不是前N条
    const results = await database.all(
      `SELECT * FROM (
         SELECT * FROM block_points 
         ${timeCondition}
         ORDER BY block_number DESC 
         LIMIT ?
       ) ORDER BY block_number ASC`,
      [...params, limit]
    );

    return results.map((result: any) => ({
      ...result,
      is_odd: Boolean(result.is_odd)
    }));
  }

  // 获取打点统计信息
  static async getPointsStats(timeRange: TimeRange): Promise<{
    totalBlocks: number;
    oddBlocks: number;
    evenBlocks: number;
    totalPointChange: number;
    currentScore: number;
    startScore: number;
    maxScore: number;
    minScore: number;
  }> {
    const points = await this.getPointsByTimeRange(timeRange);
    
    if (points.length === 0) {
      return {
        totalBlocks: 0,
        oddBlocks: 0,
        evenBlocks: 0,
        totalPointChange: 0,
        currentScore: 0,
        startScore: 0,
        maxScore: 0,
        minScore: 0
      };
    }

    const oddBlocks = points.filter(p => p.is_odd).length;
    const evenBlocks = points.filter(p => !p.is_odd).length;
    const scores = points.map(p => p.cumulative_score);
    
    return {
      totalBlocks: points.length,
      oddBlocks,
      evenBlocks,
      totalPointChange: points[points.length - 1].cumulative_score - points[0].cumulative_score,
      currentScore: points[points.length - 1].cumulative_score,
      startScore: points[0].cumulative_score,
      maxScore: Math.max(...scores),
      minScore: Math.min(...scores)
    };
  }

  // 获取每小时的打点统计（用于1日图表）
  static async getHourlyPoints(date?: string): Promise<any[]> {
    const targetDate = date || new Date().toISOString().split('T')[0];
    const startTimestamp = new Date(targetDate + 'T00:00:00.000Z').getTime();
    const endTimestamp = startTimestamp + (24 * 60 * 60 * 1000);

    const results = await database.all(
      `SELECT 
        strftime('%H', datetime(timestamp/1000, 'unixepoch')) as hour,
        MIN(cumulative_score) as hour_start_score,
        MAX(cumulative_score) as hour_end_score,
        COUNT(*) as block_count
       FROM block_points 
       WHERE timestamp >= ? AND timestamp < ?
       GROUP BY hour
       ORDER BY hour`,
      [startTimestamp, endTimestamp]
    );

    return results;
  }

  // 获取每日的打点统计（用于1周/1月图表）
  static async getDailyPoints(days: number = 30): Promise<any[]> {
    const endTimestamp = Date.now();
    const startTimestamp = endTimestamp - (days * 24 * 60 * 60 * 1000);

    const results = await database.all(
      `SELECT 
        date(datetime(timestamp/1000, 'unixepoch')) as date,
        MIN(cumulative_score) as day_start_score,
        MAX(cumulative_score) as day_end_score,
        COUNT(*) as block_count
       FROM block_points 
       WHERE timestamp >= ? AND timestamp <= ?
       GROUP BY date
       ORDER BY date`,
      [startTimestamp, endTimestamp]
    );

    return results;
  }

  // 清理过期数据
  static async cleanupOldData(daysToKeep: number = 90): Promise<number> {
    const cutoffTimestamp = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
    const result = await database.run(
      'DELETE FROM block_points WHERE timestamp < ?',
      [cutoffTimestamp]
    );
    return result.changes || 0;
  }

  // 获取当前累积分数
  static async getCurrentScore(): Promise<number> {
    const latestPoint = await this.getLatestPoint();
    return latestPoint ? latestPoint.cumulative_score : 0;
  }
}