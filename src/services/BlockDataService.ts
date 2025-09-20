import { TronRPCService } from './TronRPCService';
import { BlockModel } from '../models/BlockModel';
import { DailyStatsModel } from '../models/DailyStatsModel';
import { BlockPointsModel } from '../models/BlockPointsModel';
import { BlockInfo } from '../models/types';

export class BlockDataService {
  private tronRPCService: TronRPCService;
  private isRunning: boolean = false;
  private lastProcessedBlock: number = 0;
  private statsCache: {
    todayTotal: number;
    todayOdd: number;
    todayEven: number;
    lastUpdate: number;
  } = {
    todayTotal: 0,
    todayOdd: 0,
    todayEven: 0,
    lastUpdate: 0
  };

  constructor(tronRPCService: TronRPCService) {
    this.tronRPCService = tronRPCService;
  }

  // 启动区块数据采集服务
  public async start(): Promise<void> {
    if (this.isRunning) {
      console.warn('区块数据采集服务已在运行中');
      return;
    }

    try {
      // 初始化统计缓存
      await this.refreshStatsCache();
      
      // 获取最后处理的区块号
      const latestBlock = await BlockModel.getLatest();
      if (latestBlock) {
        this.lastProcessedBlock = latestBlock.block_number;
        console.log(`📊 最后处理的区块: ${this.lastProcessedBlock}`);
      }

      // 启动TRON RPC轮询
      this.tronRPCService.startPolling(this.onNewBlock.bind(this));
      
      this.isRunning = true;
      console.log('✅ 区块数据采集服务已启动');
      
    } catch (error) {
      console.error('启动区块数据采集服务失败:', error);
      throw error;
    }
  }

  // 停止区块数据采集服务
  public stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.tronRPCService.stopPolling();
    this.isRunning = false;
    console.log('🛑 区块数据采集服务已停止');
  }

  // 处理新区块回调
  private async onNewBlock(blockInfo: BlockInfo): Promise<void> {
    try {
      // 检查是否已处理过该区块
      if (blockInfo.block_number <= this.lastProcessedBlock) {
        return;
      }

      console.log(`📦 处理新区块: ${blockInfo.block_number}, 哈希末位数字: ${blockInfo.last_digit} (${blockInfo.is_odd ? '单' : '双'}数)`);

      // 保存区块数据到数据库
      const blockId = await BlockModel.create(blockInfo);
      
      if (blockId > 0) {
        // 更新每日统计
        await DailyStatsModel.updateTodayStats(
          blockInfo.is_odd ? 1 : 0,
          blockInfo.is_odd ? 0 : 1
        );

        // 添加区块打点数据
        await BlockPointsModel.addBlockPoint(
          blockInfo.block_number,
          blockInfo.block_hash,
          blockInfo.timestamp,
          blockInfo.last_digit,
          blockInfo.is_odd
        );

        // 更新本地缓存
        this.updateStatsCache(blockInfo);
        
        // 更新最后处理的区块号
        this.lastProcessedBlock = blockInfo.block_number;
        
        console.log(`✅ 区块 ${blockInfo.block_number} 处理完成`);
      }
      
    } catch (error) {
      console.error(`处理区块 ${blockInfo.block_number} 失败:`, error);
    }
  }

  // 更新统计缓存
  private updateStatsCache(blockInfo: BlockInfo): void {
    // 检查是否是今天的区块
    const blockDate = new Date(blockInfo.timestamp).toISOString().split('T')[0];
    const today = new Date().toISOString().split('T')[0];
    
    if (blockDate === today) {
      this.statsCache.todayTotal++;
      if (blockInfo.is_odd) {
        this.statsCache.todayOdd++;
      } else {
        this.statsCache.todayEven++;
      }
      this.statsCache.lastUpdate = Date.now();
    }
  }

  // 刷新统计缓存
  private async refreshStatsCache(): Promise<void> {
    try {
      const todayStats = await BlockModel.getTodayStats();
      this.statsCache = {
        todayTotal: todayStats.total,
        todayOdd: todayStats.odd,
        todayEven: todayStats.even,
        lastUpdate: Date.now()
      };
      console.log(`📈 今日统计缓存已更新: 总计${todayStats.total}, 单数${todayStats.odd}, 双数${todayStats.even}`);
    } catch (error) {
      console.error('刷新统计缓存失败:', error);
    }
  }

  // 获取服务状态
  public getStatus(): {
    isRunning: boolean;
    lastProcessedBlock: number;
    todayStats: {
      todayTotal: number;
      todayOdd: number;
      todayEven: number;
      lastUpdate: number;
    };
    rpcStatus: any;
  } {
    return {
      isRunning: this.isRunning,
      lastProcessedBlock: this.lastProcessedBlock,
      todayStats: { ...this.statsCache },
      rpcStatus: this.tronRPCService.getPollingStatus()
    };
  }

  // 获取实时统计数据
  public async getRealTimeStats(): Promise<{
    todayTotal: number;
    todayOdd: number;
    todayEven: number;
    currentBlock: BlockInfo | null;
    oddRate: number;
  }> {
    // 如果缓存太旧，刷新缓存
    if (Date.now() - this.statsCache.lastUpdate > 60000) {
      await this.refreshStatsCache();
    }

    const currentBlock = await BlockModel.getLatest();
    const oddRate = this.statsCache.todayTotal > 0 
      ? (this.statsCache.todayOdd / this.statsCache.todayTotal) * 100 
      : 0;

    return {
      todayTotal: this.statsCache.todayTotal,
      todayOdd: this.statsCache.todayOdd,
      todayEven: this.statsCache.todayEven,
      currentBlock,
      oddRate: Math.round(oddRate * 100) / 100
    };
  }

  // 手动同步区块数据（用于补漏或初始化）
  public async syncBlocks(fromBlock?: number, toBlock?: number): Promise<number> {
    if (!fromBlock) {
      const latestBlock = await BlockModel.getLatest();
      fromBlock = latestBlock ? latestBlock.block_number + 1 : 0;
    }

    if (!toBlock) {
      const currentBlock = await this.tronRPCService.getLatestBlock();
      toBlock = currentBlock.block_number;
    }

    let syncedCount = 0;
    console.log(`开始同步区块: ${fromBlock} -> ${toBlock}`);

    for (let blockNumber = fromBlock; blockNumber <= toBlock; blockNumber++) {
      try {
        const blockInfo = await this.tronRPCService.getBlockByNumber(blockNumber);
        const blockId = await BlockModel.create(blockInfo);
        
        if (blockId > 0) {
          await DailyStatsModel.updateTodayStats(
            blockInfo.is_odd ? 1 : 0,
            blockInfo.is_odd ? 0 : 1
          );
          syncedCount++;
        }
        
        // 避免请求过于频繁
        if (blockNumber % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
      } catch (error: any) {
        console.error(`同步区块 ${blockNumber} 失败:`, error?.message);
      }
    }

    console.log(`区块同步完成，成功同步 ${syncedCount} 个区块`);
    await this.refreshStatsCache();
    
    return syncedCount;
  }

  // 数据健康检查
  public async healthCheck(): Promise<{
    database: boolean;
    rpcConnection: boolean;
    dataIntegrity: boolean;
    lastBlockAge: number;
  }> {
    const result = {
      database: false,
      rpcConnection: false,
      dataIntegrity: false,
      lastBlockAge: 0
    };

    try {
      // 检查数据库连接
      const latestBlock = await BlockModel.getLatest();
      result.database = !!latestBlock;
      
      if (latestBlock) {
        result.lastBlockAge = Date.now() - latestBlock.timestamp;
      }

      // 检查RPC连接
      const rpcTest = await this.tronRPCService.testConnection();
      result.rpcConnection = rpcTest.success;

      // 检查数据完整性（简单检查今日统计是否正常）
      const todayStats = await BlockModel.getTodayStats();
      result.dataIntegrity = todayStats.total >= 0 && 
                           (todayStats.odd + todayStats.even) === todayStats.total;

    } catch (error) {
      console.error('健康检查失败:', error);
    }

    return result;
  }
}