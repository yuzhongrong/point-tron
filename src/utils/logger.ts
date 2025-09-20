import fs from 'fs';
import path from 'path';

// 日志级别枚举
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

// 日志接口
export interface LogEntry {
  timestamp: string;
  level: string;
  category: string;
  message: string;
  data?: any;
  performance?: {
    duration?: number;
    memoryUsage?: NodeJS.MemoryUsage;
  };
}

// K线专用监控指标
export interface KLineMetrics {
  generationTime: number;
  recordsProcessed: number;
  candlesGenerated: number;
  cacheHitRate: number;
  errorCount: number;
  avgQueryTime: number;
}

export class Logger {
  private static instance: Logger;
  private logDir: string;
  private currentLogLevel: LogLevel;
  private klineMetrics: KLineMetrics;

  private constructor() {
    this.logDir = path.join(process.cwd(), 'logs');
    this.currentLogLevel = process.env.NODE_ENV === 'development' ? LogLevel.DEBUG : LogLevel.INFO;
    this.klineMetrics = {
      generationTime: 0,
      recordsProcessed: 0,
      candlesGenerated: 0,
      cacheHitRate: 0,
      errorCount: 0,
      avgQueryTime: 0
    };
    
    this.ensureLogDirectory();
  }

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private ensureLogDirectory(): void {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  private formatTimestamp(): string {
    return new Date().toISOString();
  }

  private getLogFileName(category: string): string {
    const date = new Date().toISOString().split('T')[0];
    return path.join(this.logDir, `${category}-${date}.log`);
  }

  private writeLogEntry(entry: LogEntry): void {
    const logLine = JSON.stringify(entry) + '\n';
    const fileName = this.getLogFileName(entry.category);
    
    try {
      fs.appendFileSync(fileName, logLine);
    } catch (error) {
      console.error('Failed to write log entry:', error);
    }
  }

  private log(level: LogLevel, category: string, message: string, data?: any, performance?: any): void {
    if (level < this.currentLogLevel) {
      return;
    }

    const entry: LogEntry = {
      timestamp: this.formatTimestamp(),
      level: LogLevel[level],
      category,
      message,
      data,
      performance
    };

    // 写入文件
    this.writeLogEntry(entry);

    // 控制台输出（开发环境）
    if (process.env.NODE_ENV === 'development') {
      const levelEmojis = {
        [LogLevel.DEBUG]: '🔍',
        [LogLevel.INFO]: 'ℹ️',
        [LogLevel.WARN]: '⚠️',
        [LogLevel.ERROR]: '❌'
      };
      
      const emoji = levelEmojis[level];
      const timestamp = new Date().toLocaleTimeString();
      console.log(`${emoji} [${timestamp}] [${category}] ${message}`, data ? data : '');
    }
  }

  // 基础日志方法
  debug(category: string, message: string, data?: any): void {
    this.log(LogLevel.DEBUG, category, message, data);
  }

  info(category: string, message: string, data?: any): void {
    this.log(LogLevel.INFO, category, message, data);
  }

  warn(category: string, message: string, data?: any): void {
    this.log(LogLevel.WARN, category, message, data);
  }

  error(category: string, message: string, error?: Error | any): void {
    const errorData = error instanceof Error ? {
      name: error.name,
      message: error.message,
      stack: error.stack
    } : error;
    
    this.log(LogLevel.ERROR, category, message, errorData);
  }

  // K线专用日志方法
  klineGeneration(message: string, data: {
    limit: number;
    duration: number;
    recordsProcessed: number;
    candlesGenerated: number;
    cacheUsed: boolean;
  }): void {
    this.updateKlineMetrics(data);
    
    const performance = {
      duration: data.duration,
      memoryUsage: process.memoryUsage()
    };
    
    this.log(LogLevel.INFO, 'KLINE_GENERATION', message, data, performance);
  }

  klineQuery(message: string, data: {
    queryType: string;
    duration: number;
    recordCount: number;
  }): void {
    const performance = {
      duration: data.duration,
      memoryUsage: process.memoryUsage()
    };
    
    this.log(LogLevel.DEBUG, 'KLINE_QUERY', message, data, performance);
  }

  klineCache(message: string, data: {
    operation: 'HIT' | 'MISS' | 'SET' | 'CLEAR';
    key: string;
    size?: number;
  }): void {
    this.log(LogLevel.DEBUG, 'KLINE_CACHE', message, data);
  }

  klineError(message: string, error: Error, context?: any): void {
    this.klineMetrics.errorCount++;
    
    const errorData = {
      name: error.name,
      message: error.message,
      stack: error.stack,
      context
    };
    
    this.log(LogLevel.ERROR, 'KLINE_ERROR', message, errorData);
  }

  apiRequest(message: string, data: {
    method: string;
    endpoint: string;
    duration: number;
    statusCode: number;
    userId?: string;
  }): void {
    const performance = {
      duration: data.duration,
      memoryUsage: process.memoryUsage()
    };
    
    this.log(LogLevel.INFO, 'API_REQUEST', message, data, performance);
  }

  // 更新K线指标
  private updateKlineMetrics(data: any): void {
    if (data.duration) {
      this.klineMetrics.generationTime = data.duration;
    }
    if (data.recordsProcessed) {
      this.klineMetrics.recordsProcessed += data.recordsProcessed;
    }
    if (data.candlesGenerated) {
      this.klineMetrics.candlesGenerated += data.candlesGenerated;
    }
  }

  // 获取K线性能指标
  getKlineMetrics(): KLineMetrics {
    return { ...this.klineMetrics };
  }

  // 重置K线指标
  resetKlineMetrics(): void {
    this.klineMetrics = {
      generationTime: 0,
      recordsProcessed: 0,
      candlesGenerated: 0,
      cacheHitRate: 0,
      errorCount: 0,
      avgQueryTime: 0
    };
  }

  // 获取系统健康状态
  getSystemHealth(): {
    memory: NodeJS.MemoryUsage;
    uptime: number;
    klineMetrics: KLineMetrics;
    logFiles: string[];
  } {
    const logFiles = fs.readdirSync(this.logDir)
      .filter(file => file.endsWith('.log'))
      .sort();

    return {
      memory: process.memoryUsage(),
      uptime: process.uptime(),
      klineMetrics: this.getKlineMetrics(),
      logFiles
    };
  }

  // 清理旧日志文件
  cleanupOldLogs(daysToKeep: number = 30): void {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    try {
      const files = fs.readdirSync(this.logDir);
      let cleanedCount = 0;
      
      for (const file of files) {
        if (!file.endsWith('.log')) continue;
        
        const filePath = path.join(this.logDir, file);
        const stats = fs.statSync(filePath);
        
        if (stats.mtime < cutoffDate) {
          fs.unlinkSync(filePath);
          cleanedCount++;
        }
      }
      
      if (cleanedCount > 0) {
        this.info('LOG_CLEANUP', `Cleaned up ${cleanedCount} old log files`);
      }
    } catch (error) {
      this.error('LOG_CLEANUP', 'Failed to cleanup old logs', error);
    }
  }

  // 生成性能报告
  generatePerformanceReport(): string {
    const health = this.getSystemHealth();
    const memoryMB = Math.round(health.memory.heapUsed / 1024 / 1024);
    const uptimeHours = Math.round(health.uptime / 3600);
    
    const report = `
Performance Report - ${new Date().toISOString()}
==============================================

System Status:
- Memory Usage: ${memoryMB} MB
- Uptime: ${uptimeHours} hours
- Log Files: ${health.logFiles.length}

K-Line Metrics:
- Generation Time: ${health.klineMetrics.generationTime}ms
- Records Processed: ${health.klineMetrics.recordsProcessed.toLocaleString()}
- Candles Generated: ${health.klineMetrics.candlesGenerated.toLocaleString()}
- Error Count: ${health.klineMetrics.errorCount}
- Cache Hit Rate: ${health.klineMetrics.cacheHitRate.toFixed(2)}%

Recent Log Files:
${health.logFiles.slice(-5).map(f => `- ${f}`).join('\n')}
    `.trim();
    
    return report;
  }
}

// 单例导出
export const logger = Logger.getInstance();

// 性能监控装饰器
export function performanceMonitor(category: string) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const start = Date.now();
      const startMemory = process.memoryUsage();
      
      try {
        const result = await method.apply(this, args);
        const duration = Date.now() - start;
        const endMemory = process.memoryUsage();
        
        logger.debug(category, `${propertyName} completed`, {
          duration,
          memoryDelta: {
            heapUsed: endMemory.heapUsed - startMemory.heapUsed,
            heapTotal: endMemory.heapTotal - startMemory.heapTotal
          },
          args: args.length
        });
        
        return result;
      } catch (error) {
        const duration = Date.now() - start;
        logger.error(category, `${propertyName} failed after ${duration}ms`, error);
        throw error;
      }
    };

    return descriptor;
  };
}