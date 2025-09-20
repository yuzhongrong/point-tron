import { database } from '../database';
import { BlockInfo, DailyStats } from './types';

export class BlockModel {
  // 插入新区块数据
  static async create(blockInfo: Omit<BlockInfo, 'id' | 'created_at'>): Promise<number> {
    try {
      const result = await database.run(
        `INSERT INTO blocks (block_number, block_hash, timestamp, last_digit, is_odd) 
         VALUES (?, ?, ?, ?, ?)`,
        [
          blockInfo.block_number,
          blockInfo.block_hash,
          blockInfo.timestamp,
          blockInfo.last_digit,
          blockInfo.is_odd ? 1 : 0
        ]
      );
      return result.lastID!;
    } catch (error: any) {
      // 如果是重复区块号，直接忽略
      if (error?.message?.includes('UNIQUE constraint failed')) {
        console.log(`区块 ${blockInfo.block_number} 已存在，跳过插入`);
        return -1;
      }
      throw error;
    }
  }

  // 根据区块号查询
  static async findByNumber(blockNumber: number): Promise<BlockInfo | null> {
    const result = await database.get(
      'SELECT * FROM blocks WHERE block_number = ?',
      [blockNumber]
    );
    
    if (result) {
      return {
        ...result,
        is_odd: Boolean(result.is_odd)
      };
    }
    return null;
  }

  // 获取最新区块
  static async getLatest(): Promise<BlockInfo | null> {
    const result = await database.get(
      'SELECT * FROM blocks ORDER BY block_number DESC LIMIT 1'
    );
    
    if (result) {
      return {
        ...result,
        is_odd: Boolean(result.is_odd)
      };
    }
    return null;
  }

  // 获取今日区块统计
  static async getTodayStats(): Promise<{ total: number; odd: number; even: number }> {
    const today = new Date().toISOString().split('T')[0];
    const result = await database.get(
      `SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN is_odd = 1 THEN 1 ELSE 0 END) as odd,
        SUM(CASE WHEN is_odd = 0 THEN 1 ELSE 0 END) as even
       FROM blocks 
       WHERE date(datetime(timestamp/1000, 'unixepoch')) = ?`,
      [today]
    );

    return {
      total: result?.total || 0,
      odd: result?.odd || 0,
      even: result?.even || 0
    };
  }

  // 获取历史统计数据
  static async getHistoryStats(limit: number = 30): Promise<BlockInfo[]> {
    const results = await database.all(
      'SELECT * FROM blocks ORDER BY timestamp DESC LIMIT ?',
      [limit]
    );

    return results.map(result => ({
      ...result,
      is_odd: Boolean(result.is_odd)
    }));
  }

  // 按小时统计今日数据
  static async getTodayHourlyStats(): Promise<any[]> {
    const today = new Date().toISOString().split('T')[0];
    const results = await database.all(
      `SELECT 
        strftime('%H', datetime(timestamp/1000, 'unixepoch')) as hour,
        COUNT(*) as total,
        SUM(CASE WHEN is_odd = 1 THEN 1 ELSE 0 END) as odd,
        SUM(CASE WHEN is_odd = 0 THEN 1 ELSE 0 END) as even
       FROM blocks 
       WHERE date(datetime(timestamp/1000, 'unixepoch')) = ?
       GROUP BY hour
       ORDER BY hour`,
      [today]
    );

    return results;
  }

  // 清理过期数据 (保留最近30天)
  static async cleanupOldData(): Promise<number> {
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    const result = await database.run(
      'DELETE FROM blocks WHERE timestamp < ?',
      [thirtyDaysAgo]
    );
    return result.changes || 0;
  }

  // 获取区块打点数据
  static async getBlocksForPoints(limit: number = 200, offset: number = 0): Promise<BlockInfo[]> {
    const results = await database.all(
      `SELECT 
        block_number,
        block_hash,
        timestamp,
        last_digit,
        is_odd
       FROM blocks 
       ORDER BY block_number DESC 
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    return results.map(result => ({
      ...result,
      is_odd: Boolean(result.is_odd)
    }));
  }

  // 获取数据库状态信息
  static async getDbStats(): Promise<{
    totalBlocks: number;
    oldestBlock: number;
    newestBlock: number;
    todayBlocks: number;
  }> {
    const today = new Date().toISOString().split('T')[0];
    
    const [totalResult, rangeResult, todayResult] = await Promise.all([
      database.get('SELECT COUNT(*) as total FROM blocks'),
      database.get('SELECT MIN(block_number) as oldest, MAX(block_number) as newest FROM blocks'),
      database.get(
        `SELECT COUNT(*) as today FROM blocks 
         WHERE date(datetime(timestamp/1000, 'unixepoch')) = ?`,
        [today]
      )
    ]);

    return {
      totalBlocks: totalResult?.total || 0,
      oldestBlock: rangeResult?.oldest || 0,
      newestBlock: rangeResult?.newest || 0,
      todayBlocks: todayResult?.today || 0
    };
  }
}