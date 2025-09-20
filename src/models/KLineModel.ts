import { database } from '../database';
import { KLineData, KLinePeriod } from './types';
import { logger } from '../utils/logger';

// K线数据缓存接口
interface KLineCache {
  data: KLineData[];
  timestamp: number;
  period: KLinePeriod;
  limit: number;
}

// 缓存管理器
class CacheManager {
  private cache: Map<string, KLineCache> = new Map();
  private readonly CACHE_TTL = 60000; // 1分钟缓存时间
  private readonly MAX_CACHE_SIZE = 50; // 最大缓存条目数

  // 生成缓存键
  private getCacheKey(period: KLinePeriod, limit: number, isRealtime: boolean = false): string {
    return `${period}_${limit}_${isRealtime}`;
  }

  // 获取缓存数据
  get(period: KLinePeriod, limit: number, isRealtime: boolean = false): KLineData[] | null {
    const key = this.getCacheKey(period, limit, isRealtime);
    const cached = this.cache.get(key);
    
    if (!cached) return null;
    
    // 检查缓存是否过期
    if (Date.now() - cached.timestamp > this.CACHE_TTL) {
      this.cache.delete(key);
      return null;
    }
    
    return cached.data;
  }

  // 设置缓存数据
  set(period: KLinePeriod, limit: number, data: KLineData[], isRealtime: boolean = false): void {
    // 如果缓存过大，清理最老的条目
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    const key = this.getCacheKey(period, limit, isRealtime);
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      period,
      limit
    });
  }

  // 清理过期缓存
  cleanup(): void {
    const now = Date.now();
    for (const [key, cached] of this.cache.entries()) {
      if (now - cached.timestamp > this.CACHE_TTL) {
        this.cache.delete(key);
      }
    }
  }

  // 清空所有缓存
  clear(): void {
    this.cache.clear();
  }

  // 获取缓存统计信息
  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}

export class KLineModel {
  private static cacheManager = new CacheManager();
  private static performanceMetrics = {
    queryTime: 0,
    processTime: 0,
    cacheHits: 0,
    cacheMisses: 0
  };

  // 定期清理缓存
  static initCacheCleanup(): void {
    setInterval(() => {
      this.cacheManager.cleanup();
    }, 5 * 60 * 1000); // 每5分钟清理一次
  }

  // 获取性能指标
  static getPerformanceMetrics() {
    const stats = this.cacheManager.getStats();
    return {
      ...this.performanceMetrics,
      cacheStats: stats
    };
  }

  // 重置性能指标
  static resetPerformanceMetrics(): void {
    this.performanceMetrics = {
      queryTime: 0,
      processTime: 0,
      cacheHits: 0,
      cacheMisses: 0
    };
    this.cacheManager.clear();
  }
  // 专门用于1分钟K线的数据生成（每分钟20条3秒记录）
  static async generateOneMinuteKLine(
    limit: number = 100, // 生成多少个1分钟K线
    useCache: boolean = true // 是否使用缓存
  ): Promise<KLineData[]> {
    const startTime = Date.now();

    try {
      logger.info('KLINE_GENERATION', `开始生成1分钟K线`, { limit, useCache });
      
      // 检查缓存
      if (useCache) {
        const cached = this.cacheManager.get('1m', limit);
        if (cached) {
          this.performanceMetrics.cacheHits++;
          logger.klineCache('缓存命中', { operation: 'HIT', key: `1m_${limit}`, size: cached.length });
          logger.info('KLINE_GENERATION', `从缓存获取1分钟K线数据`, { count: cached.length });
          return cached;
        }
        this.performanceMetrics.cacheMisses++;
        logger.klineCache('缓存未命中', { operation: 'MISS', key: `1m_${limit}` });
      }

      const recordsNeeded = limit * 20; // 需要的总记录数
      logger.debug('KLINE_GENERATION', `需要处理记录数`, { recordsNeeded, limit });
      
      const queryStart = Date.now();
      
      // 使用优化的查询，利用新创建的索引
      const points = await database.all(
        `SELECT timestamp, cumulative_score, block_number, point_change
         FROM block_points 
         ORDER BY block_number DESC 
         LIMIT ?`,
        [recordsNeeded]
      );

      const queryTime = Date.now() - queryStart;
      this.performanceMetrics.queryTime = queryTime;
      logger.klineQuery('数据库查询完成', {
        queryType: '最新记录查询',
        duration: queryTime,
        recordCount: points.length
      });

      if (points.length === 0) {
        logger.warn('KLINE_GENERATION', '没有找到区块打点数据');
        return [];
      }
      
      const processStart = Date.now();
      
      // 将数据按时间正序排列（从旧到新）
      const sortedPoints = points.reverse();
      
      const klineData: KLineData[] = [];
      
      // 每20条记录生成一个1分钟K线
      for (let i = 0; i < sortedPoints.length; i += 20) {
        const minutePoints = sortedPoints.slice(i, i + 20);
        
        // 确保有完整的20条记录才生成K线
        if (minutePoints.length < 20) {
          logger.debug('KLINE_GENERATION', `剩余记录不足20条，跳过生成`, { remaining: minutePoints.length });
          break;
        }
        
        // 优化的OHLCV计算
        const kline = this.calculateOHLCV(minutePoints);
        klineData.push(kline);
        
        // 记录详细K线信息（仅开发模式）
        if (process.env.NODE_ENV === 'development' && klineData.length <= 3) {
          const changePercent = kline.open !== 0 ? ((kline.close - kline.open) / Math.abs(kline.open) * 100).toFixed(2) : '0.00';
          const changeDirection = kline.close > kline.open ? '📈' : kline.close < kline.open ? '📉' : '➡️';
          
          logger.debug('KLINE_GENERATION', `生成K线 #${klineData.length}`, {
            direction: changeDirection,
            time: new Date(kline.timestamp).toLocaleString(),
            open: kline.open,
            close: kline.close,
            high: kline.high,
            low: kline.low,
            change: kline.close - kline.open,
            changePercent,
            volume: kline.volume
          });
        }
      }
      
      const processTime = Date.now() - processStart;
      this.performanceMetrics.processTime = processTime;
      
      // 缓存结果
      if (useCache && klineData.length > 0) {
        this.cacheManager.set('1m', limit, klineData);
      }
      
      const totalTime = Date.now() - startTime;
      console.log(`✅ 成功生成${klineData.length}个1分钟K线，总耗时: ${totalTime}ms (查询: ${queryTime}ms, 处理: ${processTime}ms)`);
      
      return klineData;
    } catch (error) {
      console.error('生成1分钟K线数据失败:', error);
      throw error;
    }
  }

  // 优化的OHLCV计算方法
  private static calculateOHLCV(points: any[]): KLineData {
    if (points.length === 0) {
      throw new Error('数据点不能为空');
    }

    // 提取分数数组
    const scores = points.map(p => p.cumulative_score);
    
    // 计算OHLCV
    const open = points[0].cumulative_score;
    const close = points[points.length - 1].cumulative_score;
    const high = Math.max(...scores);
    const low = Math.min(...scores);
    const volume = points.length;
    
    // 计算分钟级别的时间戳（向下取整到分钟）
    const timestamp = Math.floor(points[0].timestamp / 60000) * 60000;
    
    return {
      timestamp,
      open,
      high,
      low,
      close,
      volume
    };
  }

  // 直接从数据库获取最新数据生成K线
  static async generateKLineFromDatabase(
    limit: number = 1000,
    candleSize: number = 20 // 每个K线蜡烛包含的记录数
  ): Promise<KLineData[]> {
    try {
      console.log(`开始生成K线数据，获取最新${limit}条记录，每${candleSize}条记录组成一个K线`);
      
      // 直接从数据库获取最新的区块打点数据
      const points = await database.all(
        `SELECT timestamp, cumulative_score, block_number, point_change
         FROM block_points 
         ORDER BY block_number DESC 
         LIMIT ?`,
        [limit]
      );

      if (points.length === 0) {
        console.log('没有找到区块打点数据');
        return [];
      }

      console.log(`获取到${points.length}条区块打点记录`);
      
      // 将数据按时间正序排列（从旧到新）
      const sortedPoints = points.reverse();
      
      const klineData: KLineData[] = [];
      
      // 按照指定的记录数分组生成K线
      for (let i = 0; i < sortedPoints.length; i += candleSize) {
        const candlePoints = sortedPoints.slice(i, i + candleSize);
        
        if (candlePoints.length === 0) break;
        
        // 计算这个K线蜡烛的OHLCV数据
        const scores = candlePoints.map(p => p.cumulative_score);
        const open = candlePoints[0].cumulative_score;
        const close = candlePoints[candlePoints.length - 1].cumulative_score;
        const high = Math.max(...scores);
        const low = Math.min(...scores);
        const volume = candlePoints.length;
        
        // 使用第一个记录的时间戳作为K线时间
        const timestamp = candlePoints[0].timestamp;
        
        klineData.push({
          timestamp,
          open,
          high,
          low,
          close,
          volume
        });
        
        console.log(`K线${klineData.length}: 时间=${new Date(timestamp).toLocaleString()}, 开盘=${open}, 收盘=${close}, 最高=${high}, 最低=${low}, 记录数=${volume}`);
      }
      
      console.log(`成功生成${klineData.length}个K线蜡烛`);
      return klineData;
    } catch (error) {
      console.error('从数据库生成K线数据失败:', error);
      throw error;
    }
  }

  // 生成K线数据
  static async generateKLineData(
    period: KLinePeriod, 
    startTime?: number, 
    endTime?: number,
    limit: number = 200
  ): Promise<KLineData[]> {
    const periodMs = this.getPeriodMs(period);
    const now = endTime || Date.now();
    const start = startTime || (now - (limit * periodMs));
    
    try {
      // 获取时间范围内的所有打点数据
      const points = await database.all(
        `SELECT timestamp, cumulative_score, block_number 
         FROM block_points 
         WHERE timestamp >= ? AND timestamp <= ?
         ORDER BY timestamp ASC`,
        [start, now]
      );

      if (points.length === 0) {
        return [];
      }

      const klineData: KLineData[] = [];
      
      // 按周期分组计算K线数据
      for (let t = Math.ceil(start / periodMs) * periodMs; t <= now; t += periodMs) {
        const periodStart = t;
        const periodEnd = t + periodMs;
        
        // 获取这个周期内的所有数据点
        const periodPoints = points.filter(p => 
          p.timestamp >= periodStart && p.timestamp < periodEnd
        );
        
        if (periodPoints.length === 0) {
          continue;
        }
        
        // 计算OHLC
        const scores = periodPoints.map(p => p.cumulative_score);
        const open = periodPoints[0].cumulative_score;
        const close = periodPoints[periodPoints.length - 1].cumulative_score;
        const high = Math.max(...scores);
        const low = Math.min(...scores);
        const volume = periodPoints.length;
        
        klineData.push({
          timestamp: periodStart,
          open,
          high,
          low,
          close,
          volume
        });
      }
      
      return klineData;
    } catch (error) {
      console.error('生成K线数据失败:', error);
      throw error;
    }
  }

  // 获取实时K线数据（包含未完成的当前周期）
  static async getRealTimeKLineData(
    period: KLinePeriod,
    limit: number = 100
  ): Promise<{
    historical: KLineData[];
    current?: KLineData;
    metadata: {
      lastUpdate: number;
      totalRecords: number;
      cacheUsed: boolean;
    };
  }> {
    const startTime = Date.now();

    try {
      // 对于1分钟周期使用专门的方法
      if (period === '1m') {
        const historical = await this.generateOneMinuteKLine(limit, true);
        
        // 获取当前未完成的1分钟K线数据
        const current = await this.getCurrentMinuteKLine();
        
        return {
          historical,
          current,
          metadata: {
            lastUpdate: Date.now(),
            totalRecords: historical.length + (current ? 1 : 0),
            cacheUsed: this.performanceMetrics.cacheHits > this.performanceMetrics.cacheMisses
          }
        };
      }

      // 其他周期的处理
      const periodMs = this.getPeriodMs(period);
      const now = Date.now();
      const currentPeriodStart = Math.floor(now / periodMs) * periodMs;
      
      // 获取历史K线数据
      const historical = await this.generateKLineData(
        period, 
        undefined, 
        currentPeriodStart, 
        limit
      );
      
      // 获取当前周期的数据
      const currentPoints = await database.all(
        `SELECT timestamp, cumulative_score 
         FROM block_points 
         WHERE timestamp >= ?
         ORDER BY timestamp ASC`,
        [currentPeriodStart]
      );
      
      let current: KLineData | undefined;
      if (currentPoints.length > 0) {
        const scores = currentPoints.map(p => p.cumulative_score);
        current = {
          timestamp: currentPeriodStart,
          open: currentPoints[0].cumulative_score,
          high: Math.max(...scores),
          low: Math.min(...scores),
          close: currentPoints[currentPoints.length - 1].cumulative_score,
          volume: currentPoints.length
        };
      }
      
      return {
        historical,
        current,
        metadata: {
          lastUpdate: Date.now(),
          totalRecords: historical.length + (current ? 1 : 0),
          cacheUsed: false
        }
      };
    } catch (error) {
      console.error('获取实时K线数据失败:', error);
      throw error;
    }
  }

  // 获取当前正在形成的1分钟K线
  private static async getCurrentMinuteKLine(): Promise<KLineData | undefined> {
    try {
      // 获取当前分钟开始时间
      const now = Date.now();
      const currentMinuteStart = Math.floor(now / 60000) * 60000;
      
      // 获取当前分钟的数据点
      const currentPoints = await database.all(
        `SELECT timestamp, cumulative_score, block_number, point_change
         FROM block_points 
         WHERE timestamp >= ? AND timestamp < ?
         ORDER BY block_number ASC`,
        [currentMinuteStart, currentMinuteStart + 60000]
      );
      
      if (currentPoints.length === 0) {
        return undefined;
      }
      
      // 计算当前K线数据
      return this.calculateOHLCV(currentPoints);
    } catch (error) {
      console.error('获取当前分钟K线失败:', error);
      return undefined;
    }
  }

  // 获取技术指标数据
  static async getTechnicalIndicators(
    period: KLinePeriod,
    limit: number = 100
  ): Promise<{
    ma5: number[];
    ma10: number[];
    ma20: number[];
    rsi: number[];
  }> {
    const klineData = await this.generateKLineData(period, undefined, undefined, limit);
    
    if (klineData.length === 0) {
      return { ma5: [], ma10: [], ma20: [], rsi: [] };
    }
    
    const closes = klineData.map(k => k.close);
    
    return {
      ma5: this.calculateMA(closes, 5),
      ma10: this.calculateMA(closes, 10),
      ma20: this.calculateMA(closes, 20),
      rsi: this.calculateRSI(closes, 14)
    };
  }

  // 获取周期对应的毫秒数
  private static getPeriodMs(period: KLinePeriod): number {
    switch (period) {
      case '1m': return 60 * 1000;
      case '5m': return 5 * 60 * 1000;
      case '15m': return 15 * 60 * 1000;
      case '1h': return 60 * 60 * 1000;
      case '4h': return 4 * 60 * 60 * 1000;
      case '1d': return 24 * 60 * 60 * 1000;
      default: return 60 * 1000;
    }
  }

  // 计算移动平均线
  private static calculateMA(prices: number[], period: number): number[] {
    const ma: number[] = [];
    
    for (let i = 0; i < prices.length; i++) {
      if (i < period - 1) {
        ma.push(NaN);
      } else {
        const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
        ma.push(sum / period);
      }
    }
    
    return ma;
  }

  // 计算RSI指标
  private static calculateRSI(prices: number[], period: number = 14): number[] {
    const rsi: number[] = [];
    
    if (prices.length < period + 1) {
      return new Array(prices.length).fill(NaN);
    }
    
    for (let i = 0; i < period; i++) {
      rsi.push(NaN);
    }
    
    for (let i = period; i < prices.length; i++) {
      let gains = 0;
      let losses = 0;
      
      for (let j = i - period + 1; j <= i; j++) {
        const change = prices[j] - prices[j - 1];
        if (change > 0) {
          gains += change;
        } else {
          losses += Math.abs(change);
        }
      }
      
      const avgGain = gains / period;
      const avgLoss = losses / period;
      
      if (avgLoss === 0) {
        rsi.push(100);
      } else {
        const rs = avgGain / avgLoss;
        rsi.push(100 - (100 / (1 + rs)));
      }
    }
    
    return rsi;
  }

  // 获取价格变化统计
  static async getPriceChangeStats(period: KLinePeriod, limit: number = 100): Promise<{
    totalChange: number;
    maxGain: number;
    maxLoss: number;
    positiveCount: number;
    negativeCount: number;
    avgVolume: number;
    volatility: number; // 新增波动率指标
    winRate: number; // 新增胜率指标
  }> {
    let klineData: KLineData[];
    
    // 对1分钟周期使用专门的方法
    if (period === '1m') {
      klineData = await this.generateOneMinuteKLine(limit);
    } else {
      klineData = await this.generateKLineData(period, undefined, undefined, limit);
    }
    
    if (klineData.length === 0) {
      return {
        totalChange: 0,
        maxGain: 0,
        maxLoss: 0,
        positiveCount: 0,
        negativeCount: 0,
        avgVolume: 0,
        volatility: 0,
        winRate: 0
      };
    }
    
    let maxGain = 0;
    let maxLoss = 0;
    let positiveCount = 0;
    let negativeCount = 0;
    let totalVolume = 0;
    let sumOfSquaredChanges = 0;
    let sumOfChanges = 0;
    
    for (const candle of klineData) {
      const change = candle.close - candle.open;
      sumOfChanges += change;
      sumOfSquaredChanges += change * change;
      
      if (change > 0) {
        positiveCount++;
        maxGain = Math.max(maxGain, change);
      } else if (change < 0) {
        negativeCount++;
        maxLoss = Math.min(maxLoss, change);
      }
      totalVolume += candle.volume;
    }
    
    const totalChange = klineData[klineData.length - 1].close - klineData[0].open;
    const avgVolume = totalVolume / klineData.length;
    const avgChange = sumOfChanges / klineData.length;
    const variance = (sumOfSquaredChanges / klineData.length) - (avgChange * avgChange);
    const volatility = Math.sqrt(variance);
    const winRate = klineData.length > 0 ? (positiveCount / klineData.length) * 100 : 0;
    
    return {
      totalChange,
      maxGain,
      maxLoss: Math.abs(maxLoss),
      positiveCount,
      negativeCount,
      avgVolume,
      volatility,
      winRate
    };
  }

  // 清理缓存
  static clearCache(): void {
    this.cacheManager.clear();
    console.log('K线缓存已清理');
  }

  // 预热缓存
  static async warmupCache(): Promise<void> {
    console.log('开始预热K线缓存...');
    try {
      // 预生成常用的K线数据
      await this.generateOneMinuteKLine(50, true);
      await this.generateOneMinuteKLine(100, true);
      await this.generateOneMinuteKLine(200, true);
      console.log('K线缓存预热完成');
    } catch (error) {
      console.error('K线缓存预热失败:', error);
    }
  }
}

// 初始化缓存清理
KLineModel.initCacheCleanup();