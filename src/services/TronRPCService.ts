import config from '../config';
import { BlockInfo } from '../models/types';

interface TronBlockResponse {
  blockID: string;
  block_header: {
    raw_data: {
      number: number;
      timestamp: number;
    };
  };
}

interface TronRPCConfig {
  rpcUrl: string;
  timeout: number;
  retryTimes: number;
  pollingInterval: number;
}

export class TronRPCService {
  private rpcUrl: string;
  private timeout: number;
  private retryTimes: number;
  private pollingInterval: number;
  private pollingTimer: NodeJS.Timeout | null = null;
  private isPolling: boolean = false;
  private consecutiveErrors: number = 0;
  private lastBlockTime: number = 0;
  private onBlockCallback: ((blockInfo: BlockInfo) => void) | null = null;

  constructor(rpcConfig?: Partial<TronRPCConfig>) {
    this.rpcUrl = rpcConfig?.rpcUrl || config.tron.rpcUrl;
    this.timeout = rpcConfig?.timeout || config.tron.timeout;
    this.retryTimes = rpcConfig?.retryTimes || config.tron.retryTimes;
    this.pollingInterval = rpcConfig?.pollingInterval || config.tron.pollingInterval;
  }

  // 启动3秒轮询
  public startPolling(callback: (blockInfo: BlockInfo) => void): void {
    if (this.isPolling) {
      console.warn('RPC轮询已在运行中');
      return;
    }

    this.onBlockCallback = callback;
    this.isPolling = true;
    this.consecutiveErrors = 0;

    console.log(`开始TRON RPC轮询，间隔: ${this.pollingInterval}ms`);

    // 立即执行一次
    this.executePolling();

    // 设置定时器
    this.pollingTimer = setInterval(() => {
      this.executePolling();
    }, this.pollingInterval);
  }

  // 停止轮询
  public stopPolling(): void {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
    this.isPolling = false;
    this.onBlockCallback = null;
    console.log('TRON RPC轮询已停止');
  }

  // 执行轮询逻辑
  private async executePolling(): Promise<void> {
    try {
      const latestBlock = await this.getLatestBlock();
      
      if (this.onBlockCallback) {
        this.onBlockCallback(latestBlock);
      }

      // 重置错误计数
      this.consecutiveErrors = 0;
      this.lastBlockTime = Date.now();

    } catch (error: any) {
      this.consecutiveErrors++;
      console.error(`RPC轮询错误 (连续第${this.consecutiveErrors}次):`, error?.message);

      // 如果连续错误过多，可以考虑停止轮询或增加重试间隔
      if (this.consecutiveErrors >= 10) {
        console.error('连续错误次数过多，请检查TRON网络连接');
        // 可以选择停止轮询或者发送告警
      }
    }
  }

  // 获取最新区块信息
  public async getLatestBlock(): Promise<BlockInfo> {
    const response = await this.makeHttpRequest('/wallet/getnowblock', {});
    return this.parseTronBlockResponse(response);
  }

  // 根据区块号获取区块信息
  public async getBlockByNumber(blockNumber: number): Promise<BlockInfo> {
    const response = await this.makeHttpRequest('/wallet/getblockbynum', {
      num: blockNumber
    });
    return this.parseTronBlockResponse(response);
  }

  // 执行HTTP请求
  private async makeHttpRequest(endpoint: string, requestData: any): Promise<TronBlockResponse> {
    let lastError: Error = new Error('未知错误');
    const url = this.rpcUrl + endpoint;

    for (let attempt = 1; attempt <= this.retryTimes; attempt++) {
      try {
        console.log(`尝试第${attempt}次请求: ${url}`);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Point-Tron/1.0'
          },
          body: JSON.stringify(requestData),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        // 检查TRON API错误
        if (data.Error) {
          throw new Error(`TRON API错误: ${data.Error}`);
        }

        return data;

      } catch (error: any) {
        lastError = error as Error;
        console.warn(`请求尝试${attempt}失败:`, error?.message);

        if (attempt < this.retryTimes) {
          // 指数退避重试策略
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          console.log(`等待${delay}ms后重试...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw new Error(`RPC请求失败，已重试${this.retryTimes}次: ${lastError.message}`);
  }

  // 解析TRON区块响应数据
  private parseTronBlockResponse(blockData: TronBlockResponse): BlockInfo {
    try {
      const blockHash = blockData.blockID;
      const blockNumber = blockData.block_header.raw_data.number;
      const timestamp = blockData.block_header.raw_data.timestamp;

      // 从哈希中提取最后一个阿拉伯数字
      const lastDigit = this.parseBlockHash(blockHash);

      return {
        block_number: blockNumber,
        block_hash: blockHash,
        timestamp: timestamp,
        last_digit: lastDigit,
        is_odd: lastDigit % 2 === 1
      };
    } catch (error: any) {
      throw new Error(`解析TRON区块数据失败: ${error?.message}`);
    }
  }

  // 从区块哈希中提取最后一个阿拉伯数字
  private parseBlockHash(hash: string): number {
    // TRON区块哈希格式类似: "0000000002fa5f7e8c23b73b234bd8e0d3d31a25de8e4ce2c9e50c175eb4c2b6"
    // 需要找到最后一个阿拉伯数字 (0-9)
    
    // 移除可能的 0x 前缀
    const cleanHash = hash.replace(/^0x/, '');
    
    // 从末尾开始查找最后一个数字
    for (let i = cleanHash.length - 1; i >= 0; i--) {
      const char = cleanHash[i];
      if (/[0-9]/.test(char)) {
        return parseInt(char, 10);
      }
    }
    
    // 如果没有找到数字，默认返回0
    console.warn(`区块哈希中未找到数字: ${hash}`);
    return 0;
  }

  // 测试连接
  public async testConnection(): Promise<{ success: boolean; latency?: number; error?: string }> {
    const startTime = Date.now();
    
    try {
      await this.getLatestBlock();
      const latency = Date.now() - startTime;
      
      return {
        success: true,
        latency
      };
    } catch (error: any) {
      return {
        success: false,
        error: error?.message || '未知错误'
      };
    }
  }

  // 获取轮询状态
  public getPollingStatus(): {
    isActive: boolean;
    interval: number;
    consecutiveErrors: number;
    lastBlockTime: number;
  } {
    return {
      isActive: this.isPolling,
      interval: this.pollingInterval,
      consecutiveErrors: this.consecutiveErrors,
      lastBlockTime: this.lastBlockTime
    };
  }

  // 更新配置
  public updateConfig(newConfig: Partial<TronRPCConfig>): void {
    if (newConfig.rpcUrl) this.rpcUrl = newConfig.rpcUrl;
    if (newConfig.timeout) this.timeout = newConfig.timeout;
    if (newConfig.retryTimes) this.retryTimes = newConfig.retryTimes;
    if (newConfig.pollingInterval) {
      this.pollingInterval = newConfig.pollingInterval;
      
      // 如果正在轮询，重启以应用新间隔
      if (this.isPolling && this.onBlockCallback) {
        const callback = this.onBlockCallback;
        this.stopPolling();
        this.startPolling(callback);
      }
    }
  }
}