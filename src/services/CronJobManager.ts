// 定时任务管理器
import cron from 'node-cron';
import { KLineModel } from '../models/KLineModel';
import { BlockPointsModel } from '../models/BlockPointsModel';
import { logger } from '../utils/logger';

export interface CronJob {
  name: string;
  schedule: string;
  task: () => Promise<void>;
  isRunning: boolean;
  lastRun: number | null;
  nextRun: number | null;
  errorCount: number;
}

export class CronJobManager {
  private static instance: CronJobManager;
  private jobs: Map<string, cron.ScheduledTask> = new Map();
  private jobConfigs: Map<string, CronJob> = new Map();

  private constructor() {}

  static getInstance(): CronJobManager {
    if (!CronJobManager.instance) {
      CronJobManager.instance = new CronJobManager();
    }
    return CronJobManager.instance;
  }

  // 初始化所有定时任务
  initialize(): void {
    console.log('🕒 初始化定时任务管理器...');

    // 1. K线缓存预热任务 - 每小时执行
    this.addJob('kline-warmup', '0 * * * *', async () => {
      logger.info('CRON_JOB', 'K线缓存预热任务开始');
      await KLineModel.warmupCache();
      logger.info('CRON_JOB', 'K线缓存预热任务完成');
    });

    // 2. 性能指标重置任务 - 每天午夜执行
    this.addJob('metrics-reset', '0 0 * * *', async () => {
      logger.info('CRON_JOB', '性能指标重置任务开始');
      KLineModel.resetPerformanceMetrics();
      logger.info('CRON_JOB', '性能指标已重置');
    });

    // 3. 日志清理任务 - 每周日凌晨2点执行
    this.addJob('log-cleanup', '0 2 * * 0', async () => {
      logger.info('CRON_JOB', '日志清理任务开始');
      logger.cleanupOldLogs(30); // 保留30天的日志
      logger.info('CRON_JOB', '日志清理任务完成');
    });

    // 4. 数据库清理任务 - 每月1号凌晨3点执行
    this.addJob('database-cleanup', '0 3 1 * *', async () => {
      logger.info('CRON_JOB', '数据库清理任务开始');
      const deletedCount = await BlockPointsModel.cleanupOldData(90); // 清理90天前的数据
      logger.info('CRON_JOB', `数据库清理完成，删除 ${deletedCount} 条记录`);
    });

    // 5. K线数据质量检查 - 每天早上8点执行
    this.addJob('kline-quality-check', '0 8 * * *', async () => {
      logger.info('CRON_JOB', 'K线数据质量检查开始');
      await this.performKlineQualityCheck();
      logger.info('CRON_JOB', 'K线数据质量检查完成');
    });

    // 6. 性能报告生成 - 每天晚上11点执行
    this.addJob('performance-report', '0 23 * * *', async () => {
      logger.info('CRON_JOB', '性能报告生成开始');
      const report = logger.generatePerformanceReport();
      logger.info('CRON_JOB', '每日性能报告', { report });
    });

    console.log(`✅ 定时任务管理器初始化完成，共 ${this.jobConfigs.size} 个任务`);
  }

  // 添加定时任务
  addJob(name: string, schedule: string, taskFn: () => Promise<void>): void {
    if (this.jobs.has(name)) {
      console.log(`⚠️ 任务 ${name} 已存在，跳过添加`);
      return;
    }

    const jobConfig: CronJob = {
      name,
      schedule,
      task: taskFn,
      isRunning: false,
      lastRun: null,
      nextRun: null,
      errorCount: 0
    };

    const scheduledTask = cron.schedule(schedule, async () => {
      await this.executeJob(name);
    }, {
      scheduled: false // 先不启动，等待手动启动
    });

    this.jobs.set(name, scheduledTask);
    this.jobConfigs.set(name, jobConfig);

    logger.info('CRON_JOB', `添加定时任务: ${name}`, { schedule });
  }

  // 执行特定任务
  private async executeJob(name: string): Promise<void> {
    const jobConfig = this.jobConfigs.get(name);
    if (!jobConfig) {
      logger.error('CRON_JOB', `任务不存在: ${name}`);
      return;
    }

    if (jobConfig.isRunning) {
      logger.warn('CRON_JOB', `任务 ${name} 正在运行，跳过本次执行`);
      return;
    }

    jobConfig.isRunning = true;
    const startTime = Date.now();

    try {
      logger.info('CRON_JOB', `开始执行任务: ${name}`);
      await jobConfig.task();
      jobConfig.lastRun = Date.now();
      const duration = jobConfig.lastRun - startTime;
      logger.info('CRON_JOB', `任务 ${name} 执行成功`, { duration });
    } catch (error) {
      jobConfig.errorCount++;
      logger.klineError(`任务 ${name} 执行失败`, error as Error, { 
        errorCount: jobConfig.errorCount,
        duration: Date.now() - startTime
      });
    } finally {
      jobConfig.isRunning = false;
    }
  }

  // 启动所有任务
  startAll(): void {
    console.log('🚀 启动所有定时任务...');
    for (const [name, task] of this.jobs) {
      task.start();
      console.log(`✅ 任务 ${name} 已启动`);
    }
    logger.info('CRON_JOB', '所有定时任务已启动', { taskCount: this.jobs.size });
  }

  // 停止所有任务
  stopAll(): void {
    console.log('🛑 停止所有定时任务...');
    for (const [name, task] of this.jobs) {
      task.stop();
      const jobConfig = this.jobConfigs.get(name);
      if (jobConfig) {
        jobConfig.isRunning = false;
      }
      console.log(`🛑 任务 ${name} 已停止`);
    }
    logger.info('CRON_JOB', '所有定时任务已停止');
  }

  // 启动特定任务
  startJob(name: string): boolean {
    const task = this.jobs.get(name);
    if (!task) {
      logger.error('CRON_JOB', `任务不存在: ${name}`);
      return false;
    }

    task.start();
    logger.info('CRON_JOB', `任务 ${name} 已启动`);
    return true;
  }

  // 停止特定任务
  stopJob(name: string): boolean {
    const task = this.jobs.get(name);
    const jobConfig = this.jobConfigs.get(name);
    
    if (!task || !jobConfig) {
      logger.error('CRON_JOB', `任务不存在: ${name}`);
      return false;
    }

    task.stop();
    jobConfig.isRunning = false;
    logger.info('CRON_JOB', `任务 ${name} 已停止`);
    return true;
  }

  // 手动执行任务
  async runJobNow(name: string): Promise<boolean> {
    const jobConfig = this.jobConfigs.get(name);
    if (!jobConfig) {
      logger.error('CRON_JOB', `任务不存在: ${name}`);
      return false;
    }

    logger.info('CRON_JOB', `手动执行任务: ${name}`);
    await this.executeJob(name);
    return true;
  }

  // 获取所有任务状态
  getJobsStatus(): CronJob[] {
    return Array.from(this.jobConfigs.values());
  }

  // 获取特定任务状态
  getJobStatus(name: string): CronJob | null {
    return this.jobConfigs.get(name) || null;
  }

  // K线数据质量检查
  private async performKlineQualityCheck(): Promise<void> {
    try {
      // 检查最新的K线数据
      const recentKlines = await KLineModel.generateOneMinuteKLine(10, false);
      
      if (recentKlines.length === 0) {
        logger.warn('QUALITY_CHECK', 'K线数据为空');
        return;
      }

      // 检查数据完整性
      const issues: string[] = [];
      
      for (let i = 0; i < recentKlines.length; i++) {
        const kline = recentKlines[i];
        
        // 检查OHLC数据逻辑
        if (kline.high < kline.low) {
          issues.push(`K线 ${i}: 最高价小于最低价`);
        }
        
        if (kline.high < kline.open || kline.high < kline.close) {
          issues.push(`K线 ${i}: 最高价小于开盘价或收盘价`);
        }
        
        if (kline.low > kline.open || kline.low > kline.close) {
          issues.push(`K线 ${i}: 最低价大于开盘价或收盘价`);
        }
        
        // 检查成交量
        if (kline.volume !== 20) {
          issues.push(`K线 ${i}: 成交量不等于20 (实际: ${kline.volume})`);
        }
      }

      // 记录检查结果
      if (issues.length > 0) {
        logger.warn('QUALITY_CHECK', 'K线数据质量检查发现问题', { issues });
      } else {
        logger.info('QUALITY_CHECK', 'K线数据质量检查通过', { 
          checkedKlines: recentKlines.length 
        });
      }

      // 检查性能指标
      const metrics = KLineModel.getPerformanceMetrics();
      if (metrics.queryTime > 1000) {
        logger.warn('QUALITY_CHECK', '查询性能告警', { queryTime: metrics.queryTime });
      }

    } catch (error) {
      logger.klineError('K线数据质量检查失败', error as Error);
    }
  }
}

// 单例导出
export const cronManager = CronJobManager.getInstance();