import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import http from 'http';
import path from 'path';
import config from './config';
import { database } from './database';
import { corsOptions, errorHandler, requestLogger, securityHeaders, rateLimit } from './middleware/auth';
import { UserModel } from './models/UserModel';
import { TronRPCService } from './services/TronRPCService';
import { BlockDataService } from './services/BlockDataService';
import { WebSocketService } from './services/WebSocketService';
import { RealTimeUpdateService } from './services/RealTimeUpdateService';
import { CronJobManager } from './services/CronJobManager';

// 导入路由
import authRoutes from './routes/auth';
import blockRoutes from './routes/blocks';
import configRoutes from './routes/config';
import systemRoutes from './routes/system';
import webRoutes from './routes/web';

class App {
  public app: express.Application;
  private tronRPCService: TronRPCService;
  private blockDataService: BlockDataService;
  private webSocketService: WebSocketService;
  private realTimeUpdateService: RealTimeUpdateService;
  private cronJobManager: CronJobManager;

  constructor() {
    this.app = express();
    this.tronRPCService = new TronRPCService();
    this.blockDataService = new BlockDataService(this.tronRPCService);
    this.webSocketService = WebSocketService.getInstance();
    this.realTimeUpdateService = RealTimeUpdateService.getInstance();
    this.cronJobManager = CronJobManager.getInstance();
    
    this.initializeMiddlewares();
    this.initializeRoutes();
    this.initializeErrorHandling();
  }

  private initializeMiddlewares(): void {
    // 安全中间件
    this.app.use(helmet({
      contentSecurityPolicy: false, // 为了支持EJS模板
    }));
    this.app.use(cors(corsOptions));
    this.app.use(securityHeaders);
    this.app.use(rateLimit(200, 60000)); // 每分钟最多200个请求

    // 基础中间件
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    this.app.use(requestLogger);

    // 静态文件服务
    this.app.use('/static', express.static(path.join(__dirname, '../public')));

    // 视图引擎设置
    this.app.set('view engine', 'ejs');
    this.app.set('views', path.join(__dirname, 'views'));
  }

  private initializeRoutes(): void {
    // API路由
    this.app.use('/api/auth', authRoutes);
    this.app.use('/api/blocks', blockRoutes);
    this.app.use('/api/config', configRoutes);
    this.app.use('/api/system', systemRoutes);
    
    // Web页面路由
    this.app.use('/', webRoutes);

    // 健康检查端点
    this.app.get('/health', (req, res) => {
      res.json({
        success: true,
        data: {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          database: database.isConnectedToDb(),
          rpcPolling: this.tronRPCService.getPollingStatus().isActive
        }
      });
    });

    // 404处理
    this.app.use('*', (req, res) => {
      res.status(404).json({
        success: false,
        error: '页面不存在'
      });
    });
  }

  private initializeErrorHandling(): void {
    this.app.use(errorHandler);
  }

  public async start(): Promise<void> {
    try {
      // 初始化数据库
      await database.connect();
      await database.initializeTables();
      
      // 创建默认管理员账户
      await this.createDefaultAdmin();
      
      // 启动TRON区块数据采集
      await this.blockDataService.start();
      
      // 启动WebSocket服务
      const server = this.app.listen(config.port, () => {
        console.log(`🚀 Point-Tron服务器启动成功`);
        console.log(`📡 服务地址: http://localhost:${config.port}`);
        console.log(`🔗 TRON网络: ${config.tron.rpcUrl}`);
        console.log(`⏰ 轮询间隔: ${config.tron.pollingInterval}ms`);
        console.log(`📊 后台管理: http://localhost:${config.port}/admin`);
      });
      
      // 初始化WebSocket服务
      this.webSocketService.initialize(server);
      console.log(`🔌 WebSocket服务已启动`);
      
      // 启动实时更新服务
      this.realTimeUpdateService.start();
      console.log(`⚡ 实时更新服务已启动`);
      
      // 启动定时任务管理器
      this.cronJobManager.initialize();
      this.cronJobManager.startAll();
      console.log(`⏰ 定时任务管理器已启动`);
      
    } catch (error) {
      console.error('应用启动失败:', error);
      process.exit(1);
    }
  }

  private async createDefaultAdmin(): Promise<void> {
    try {
      const existingAdmin = await UserModel.findByUsername(config.admin.username);
      if (!existingAdmin) {
        await UserModel.create({
          username: config.admin.username,
          password: config.admin.password
        });
        console.log(`✅ 默认管理员账户已创建: ${config.admin.username}`);
      } else {
        console.log(`ℹ️  管理员账户已存在: ${config.admin.username}`);
      }
    } catch (error) {
      console.error('创建默认管理员失败:', error);
    }
  }

  public async shutdown(): Promise<void> {
    console.log('正在关闭应用...');
    
    // 停止定时任务管理器
    this.cronJobManager.stopAll();
    console.log('✓ 定时任务管理器已停止');
    
    // 停止实时更新服务
    this.realTimeUpdateService.stop();
    console.log('✓ 实时更新服务已停止');
    
    // 停止TRON数据采集
    this.blockDataService.stop();
    console.log('✓ TRON数据采集已停止');
    
    // 关闭数据库连接
    await database.close();
    console.log('✓ 数据库连接已关闭');
    
    console.log('应用已安全关闭');
    process.exit(0);
  }
}

// 创建应用实例
const app = new App();

// 处理进程信号
process.on('SIGTERM', () => app.shutdown());
process.on('SIGINT', () => app.shutdown());

// 启动应用
app.start().catch(error => {
  console.error('启动失败:', error);
  process.exit(1);
});
