import sqlite3 from 'sqlite3';
import config from '../config';
import fs from 'fs';
import path from 'path';

// SQLite 数据库类
export class Database {
  private db!: sqlite3.Database;
  private isConnected: boolean = false;

  constructor() {
    // 确保数据目录存在
    const dbDir = path.dirname(config.database.path);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
  }

  // 连接数据库
  public async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(config.database.path, (err) => {
        if (err) {
          console.error('数据库连接失败:', err);
          reject(err);
        } else {
          console.log('SQLite 数据库连接成功');
          this.isConnected = true;
          resolve();
        }
      });
    });
  }

  // 执行查询
  public async run(sql: string, params: any[] = []): Promise<sqlite3.RunResult> {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve(this);
      });
    });
  }

  // 查询单行
  public async get(sql: string, params: any[] = []): Promise<any> {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  // 查询多行
  public async all(sql: string, params: any[] = []): Promise<any[]> {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  }

  // 执行事务
  public async transaction(operations: (() => Promise<any>)[]): Promise<void> {
    await this.run('BEGIN TRANSACTION');
    try {
      for (const operation of operations) {
        await operation();
      }
      await this.run('COMMIT');
    } catch (error) {
      await this.run('ROLLBACK');
      throw error;
    }
  }

  // 初始化数据库表
  public async initializeTables(): Promise<void> {
    try {
      // 创建用户表
      await this.run(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username VARCHAR(50) UNIQUE NOT NULL,
          password VARCHAR(255) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // 创建区块数据表
      await this.run(`
        CREATE TABLE IF NOT EXISTS blocks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          block_number BIGINT UNIQUE NOT NULL,
          block_hash VARCHAR(66) NOT NULL,
          timestamp BIGINT NOT NULL,
          last_digit INTEGER NOT NULL,
          is_odd BOOLEAN NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // 创建每日统计表
      await this.run(`
        CREATE TABLE IF NOT EXISTS daily_stats (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          date DATE UNIQUE NOT NULL,
          total_blocks INTEGER DEFAULT 0,
          odd_count INTEGER DEFAULT 0,
          even_count INTEGER DEFAULT 0,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // 创建系统配置表
      await this.run(`
        CREATE TABLE IF NOT EXISTS config (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          key VARCHAR(100) UNIQUE NOT NULL,
          value TEXT NOT NULL,
          description VARCHAR(255),
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // 创建区块打点计分表
      await this.run(`
        CREATE TABLE IF NOT EXISTS block_points (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          block_number BIGINT UNIQUE NOT NULL,
          block_hash VARCHAR(66) NOT NULL,
          timestamp BIGINT NOT NULL,
          last_digit INTEGER NOT NULL,
          is_odd BOOLEAN NOT NULL,
          point_change INTEGER NOT NULL,  -- +1 or -1
          cumulative_score INTEGER NOT NULL,  -- 累积分数
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // 创建索引
      await this.run('CREATE INDEX IF NOT EXISTS idx_blocks_number ON blocks(block_number)');
      await this.run('CREATE INDEX IF NOT EXISTS idx_blocks_timestamp ON blocks(timestamp)');
      await this.run('CREATE INDEX IF NOT EXISTS idx_daily_stats_date ON daily_stats(date)');
      await this.run('CREATE INDEX IF NOT EXISTS idx_block_points_number ON block_points(block_number)');
      await this.run('CREATE INDEX IF NOT EXISTS idx_block_points_timestamp ON block_points(timestamp)');

      // 初始化打点计分初始值
      await this.initializePointsScore();

      console.log('数据库表初始化完成');
    } catch (error) {
      console.error('数据库表初始化失败:', error);
      throw error;
    }
  }

  // 初始化打点计分初始值
  private async initializePointsScore(): Promise<void> {
    try {
      // 检查是否已经有数据
      const existingData = await this.get('SELECT COUNT(*) as count FROM block_points');
      
      if (existingData.count === 0) {
        console.log('初始化打点计分系统...');
        // 如果没有数据，从已有的区块数据中生成打点数据
        await this.generatePointsFromExistingBlocks();
      }
    } catch (error) {
      console.error('初始化打点计分失败:', error);
    }
  }

  // 从已有区块数据生成打点数据
  private async generatePointsFromExistingBlocks(): Promise<void> {
    try {
      // 获取所有区块数据，按区块号排序
      const blocks = await this.all(
        'SELECT * FROM blocks ORDER BY block_number ASC'
      );

      if (blocks.length === 0) {
        console.log('没有区块数据，跳过打点初始化');
        return;
      }

      let cumulativeScore = 0; // 初始化为0
      
      // 先清空现有的打点数据
      await this.run('DELETE FROM block_points');
      console.log('已清空现有打点数据，重新生成...');

      // 逐条插入以确保累积分数正确计算
      for (const block of blocks) {
        const isOdd = Boolean(block.is_odd);
        const pointChange = isOdd ? -1 : 1; // 单数-1，双数+1
        cumulativeScore += pointChange;

        await this.run(
          `INSERT INTO block_points (
            block_number, block_hash, timestamp, last_digit, 
            is_odd, point_change, cumulative_score
          ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            block.block_number,
            block.block_hash,
            block.timestamp,
            block.last_digit,
            isOdd,
            pointChange,
            cumulativeScore
          ]
        );
      }

      console.log(`✅ 成功生成${blocks.length}个区块的打点数据，当前累积分数: ${cumulativeScore}`);
    } catch (error) {
      console.error('生成打点数据失败:', error);
    }
  }

  // 关闭数据库连接
  public async close(): Promise<void> {
    if (this.db && this.isConnected) {
      return new Promise((resolve, reject) => {
        this.db.close((err) => {
          if (err) {
            reject(err);
          } else {
            this.isConnected = false;
            console.log('数据库连接已关闭');
            resolve();
          }
        });
      });
    }
  }

  // 检查连接状态
  public isConnectedToDb(): boolean {
    return this.isConnected;
  }
}

// 单例模式导出数据库实例
export const database = new Database();