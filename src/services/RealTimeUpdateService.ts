// 实时更新服务
import { EventEmitter } from 'events';
import { KLineModel } from '../models/KLineModel';
import { BlockPointsModel } from '../models/BlockPointsModel';

export interface RealTimeUpdate {
  type: 'kline' | 'block' | 'stats';
  timestamp: number;
  data: any;
}

export class RealTimeUpdateService extends EventEmitter {
  private static instance: RealTimeUpdateService;
  private updateInterval: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private subscribers: Set<string> = new Set();
  private lastUpdate: number = 0;

  private constructor() {
    super();
  }

  static getInstance(): RealTimeUpdateService {
    if (!RealTimeUpdateService.instance) {
      RealTimeUpdateService.instance = new RealTimeUpdateService();
    }
    return RealTimeUpdateService.instance;
  }

  // 启动实时更新服务
  start(intervalMs: number = 30000): void {
    if (this.isRunning) {
      console.log('⚠️ 实时更新服务已在运行');
      return;
    }

    console.log(`🚀 启动实时更新服务，更新间隔: ${intervalMs}ms`);
    this.isRunning = true;
    this.lastUpdate = Date.now();

    this.updateInterval = setInterval(() => {
      this.performUpdate();
    }, intervalMs);

    // 立即执行一次更新
    this.performUpdate();
  }

  // 停止实时更新服务
  stop(): void {
    if (!this.isRunning) {
      console.log('⚠️ 实时更新服务未在运行');
      return;
    }

    console.log('🛑 停止实时更新服务');
    this.isRunning = false;

    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  // 添加订阅者
  subscribe(id: string): void {
    this.subscribers.add(id);
    console.log(`📡 新增订阅者: ${id}，当前订阅数: ${this.subscribers.size}`);
  }

  // 移除订阅者
  unsubscribe(id: string): void {
    this.subscribers.delete(id);
    console.log(`📡 移除订阅者: ${id}，当前订阅数: ${this.subscribers.size}`);
  }

  // 获取订阅者数量
  getSubscriberCount(): number {
    return this.subscribers.size;
  }

  // 手动触发更新
  async triggerUpdate(): Promise<void> {
    if (!this.isRunning) {
      console.log('⚠️ 实时更新服务未运行，无法手动触发');
      return;
    }

    console.log('🔄 手动触发实时更新');
    await this.performUpdate();
  }

  // 执行更新
  private async performUpdate(): Promise<void> {
    try {
      const updateStartTime = Date.now();
      console.log('🔄 开始执行实时更新检查...');

      // 1. 检查是否有新的区块数据
      const latestBlock = await BlockPointsModel.getLatestPoint();
      if (latestBlock && latestBlock.timestamp > this.lastUpdate) {
        console.log(`📦 检测到新区块: #${latestBlock.block_number}`);
        
        // 发送区块更新事件
        this.emit('update', {
          type: 'block',
          timestamp: Date.now(),
          data: {
            blockNumber: latestBlock.block_number,
            blockHash: latestBlock.block_hash,
            lastDigit: latestBlock.last_digit,
            isOdd: latestBlock.is_odd,
            cumulativeScore: latestBlock.cumulative_score,
            pointChange: latestBlock.point_change
          }
        } as RealTimeUpdate);
      }

      // 2. 生成最新的K线数据
      const klineData = await KLineModel.generateOneMinuteKLine(10, true); // 获取最新10个K线
      if (klineData.length > 0) {
        const latestKline = klineData[klineData.length - 1];
        
        // 发送K线更新事件
        this.emit('update', {
          type: 'kline',
          timestamp: Date.now(),
          data: {
            kline: latestKline,
            totalCandles: klineData.length,
            recentKlines: klineData.slice(-5) // 最新5个K线
          }
        } as RealTimeUpdate);

        console.log(`📈 K线数据已更新，最新价格: ${latestKline.close}`);
      }

      // 3. 获取统计数据
      const stats = await KLineModel.getPriceChangeStats('1m', 50);
      this.emit('update', {
        type: 'stats',
        timestamp: Date.now(),
        data: stats
      } as RealTimeUpdate);

      this.lastUpdate = updateStartTime;
      const updateDuration = Date.now() - updateStartTime;
      console.log(`✅ 实时更新完成，耗时: ${updateDuration}ms，订阅者: ${this.subscribers.size}`);

    } catch (error) {
      console.error('❌ 实时更新失败:', error);
      this.emit('error', error);
    }
  }

  // 获取服务状态
  getStatus(): {
    isRunning: boolean;
    subscriberCount: number;
    lastUpdate: number;
    uptime: number;
  } {
    return {
      isRunning: this.isRunning,
      subscriberCount: this.subscribers.size,
      lastUpdate: this.lastUpdate,
      uptime: this.isRunning ? Date.now() - this.lastUpdate : 0
    };
  }
}

// 单例导出
export const realtimeService = RealTimeUpdateService.getInstance();