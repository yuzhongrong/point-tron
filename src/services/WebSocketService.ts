// WebSocket服务 - 为K线实时更新提供支持
import { Server } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { realtimeService, RealTimeUpdate } from './RealTimeUpdateService';

export interface WSClient {
  id: string;
  ws: WebSocket;
  subscriptions: Set<string>;
  lastPing: number;
}

export class WebSocketService {
  private static instance: WebSocketService;
  private wss: WebSocketServer | null = null;
  private clients: Map<string, WSClient> = new Map();
  private server: Server | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  private constructor() {}

  static getInstance(): WebSocketService {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService();
    }
    return WebSocketService.instance;
  }

  // 初始化WebSocket服务器
  initialize(server: Server): void {
    this.server = server;
    this.wss = new WebSocketServer({ server });

    console.log('🌐 WebSocket服务器初始化完成');

    // 处理新连接
    this.wss.on('connection', (ws, request) => {
      const clientId = this.generateClientId();
      const client: WSClient = {
        id: clientId,
        ws,
        subscriptions: new Set(),
        lastPing: Date.now()
      };

      this.clients.set(clientId, client);
      console.log(`📡 新WebSocket连接: ${clientId}，当前连接数: ${this.clients.size}`);

      // 发送欢迎消息
      this.sendToClient(clientId, {
        type: 'welcome',
        clientId,
        timestamp: Date.now(),
        data: {
          message: '欢迎连接Point-Tron实时K线服务',
          supportedSubscriptions: ['kline', 'block', 'stats'],
          serverTime: new Date().toISOString()
        }
      });

      // 处理客户端消息
      ws.on('message', (data) => {
        this.handleClientMessage(clientId, data);
      });

      // 处理连接关闭
      ws.on('close', () => {
        this.handleClientDisconnect(clientId);
      });

      // 处理连接错误
      ws.on('error', (error) => {
        console.error(`❌ WebSocket客户端错误 ${clientId}:`, error);
        this.handleClientDisconnect(clientId);
      });

      // 处理ping/pong心跳
      ws.on('pong', () => {
        const client = this.clients.get(clientId);
        if (client) {
          client.lastPing = Date.now();
        }
      });
    });

    // 启动心跳检测
    this.startHeartbeat();

    // 监听实时更新事件
    this.setupRealTimeListeners();
  }

  // 生成客户端ID
  private generateClientId(): string {
    return 'client_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
  }

  // 处理客户端消息
  private handleClientMessage(clientId: string, data: any): void {
    try {
      const message = JSON.parse(data.toString());
      const client = this.clients.get(clientId);
      
      if (!client) return;

      console.log(`📨 收到客户端消息 ${clientId}:`, message);

      switch (message.type) {
        case 'subscribe':
          this.handleSubscribe(clientId, message.channel);
          break;
          
        case 'unsubscribe':
          this.handleUnsubscribe(clientId, message.channel);
          break;
          
        case 'ping':
          this.sendToClient(clientId, {
            type: 'pong',
            timestamp: Date.now()
          });
          break;
          
        case 'getStatus':
          this.sendStatus(clientId);
          break;
          
        default:
          this.sendToClient(clientId, {
            type: 'error',
            timestamp: Date.now(),
            data: { message: '未知消息类型: ' + message.type }
          });
      }
    } catch (error) {
      console.error(`❌ 解析客户端消息失败 ${clientId}:`, error);
      this.sendToClient(clientId, {
        type: 'error',
        timestamp: Date.now(),
        data: { message: '消息格式错误' }
      });
    }
  }

  // 处理订阅
  private handleSubscribe(clientId: string, channel: string): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    const validChannels = ['kline', 'block', 'stats'];
    if (!validChannels.includes(channel)) {
      this.sendToClient(clientId, {
        type: 'error',
        timestamp: Date.now(),
        data: { message: '无效的订阅频道: ' + channel }
      });
      return;
    }

    client.subscriptions.add(channel);
    realtimeService.subscribe(clientId);

    this.sendToClient(clientId, {
      type: 'subscribed',
      timestamp: Date.now(),
      data: {
        channel,
        message: `已订阅 ${channel} 频道`,
        totalSubscriptions: client.subscriptions.size
      }
    });

    console.log(`📡 客户端 ${clientId} 订阅频道: ${channel}`);
  }

  // 处理取消订阅
  private handleUnsubscribe(clientId: string, channel: string): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    client.subscriptions.delete(channel);
    
    if (client.subscriptions.size === 0) {
      realtimeService.unsubscribe(clientId);
    }

    this.sendToClient(clientId, {
      type: 'unsubscribed',
      timestamp: Date.now(),
      data: {
        channel,
        message: `已取消订阅 ${channel} 频道`,
        totalSubscriptions: client.subscriptions.size
      }
    });

    console.log(`📡 客户端 ${clientId} 取消订阅频道: ${channel}`);
  }

  // 发送状态信息
  private sendStatus(clientId: string): void {
    const realtimeStatus = realtimeService.getStatus();
    
    this.sendToClient(clientId, {
      type: 'status',
      timestamp: Date.now(),
      data: {
        websocket: {
          connectedClients: this.clients.size,
          totalSubscriptions: Array.from(this.clients.values())
            .reduce((sum, client) => sum + client.subscriptions.size, 0)
        },
        realtime: realtimeStatus,
        server: {
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          timestamp: Date.now()
        }
      }
    });
  }

  // 处理客户端断开连接
  private handleClientDisconnect(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      realtimeService.unsubscribe(clientId);
      this.clients.delete(clientId);
      console.log(`📡 WebSocket连接断开: ${clientId}，当前连接数: ${this.clients.size}`);
    }
  }

  // 向特定客户端发送消息
  private sendToClient(clientId: string, message: any): void {
    const client = this.clients.get(clientId);
    if (!client || client.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    try {
      client.ws.send(JSON.stringify(message));
    } catch (error) {
      console.error(`❌ 发送消息失败 ${clientId}:`, error);
      this.handleClientDisconnect(clientId);
    }
  }

  // 广播消息给所有订阅的客户端
  private broadcast(channel: string, message: any): void {
    let sentCount = 0;
    
    for (const [clientId, client] of this.clients) {
      if (client.subscriptions.has(channel) && client.ws.readyState === WebSocket.OPEN) {
        this.sendToClient(clientId, {
          type: 'update',
          channel,
          timestamp: Date.now(),
          data: message
        });
        sentCount++;
      }
    }

    if (sentCount > 0) {
      console.log(`📡 广播消息到 ${channel} 频道，接收客户端: ${sentCount}`);
    }
  }

  // 设置实时更新监听器
  private setupRealTimeListeners(): void {
    realtimeService.on('update', (update: RealTimeUpdate) => {
      this.broadcast(update.type, update.data);
    });

    realtimeService.on('error', (error: Error) => {
      this.broadcast('error', {
        message: '实时更新服务错误',
        error: error.message,
        timestamp: Date.now()
      });
    });

    console.log('📡 实时更新监听器已设置');
  }

  // 启动心跳检测
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      const now = Date.now();
      const timeoutMs = 60000; // 60秒超时
      
      for (const [clientId, client] of this.clients) {
        if (client.ws.readyState === WebSocket.OPEN) {
          // 发送ping
          client.ws.ping();
          
          // 检查是否超时
          if (now - client.lastPing > timeoutMs) {
            console.log(`⏰ 客户端 ${clientId} 心跳超时，断开连接`);
            client.ws.terminate();
            this.handleClientDisconnect(clientId);
          }
        } else {
          this.handleClientDisconnect(clientId);
        }
      }
    }, 30000); // 每30秒检查一次

    console.log('💓 WebSocket心跳检测已启动');
  }

  // 停止WebSocket服务
  stop(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    for (const [clientId, client] of this.clients) {
      client.ws.close();
    }
    this.clients.clear();

    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }

    console.log('🛑 WebSocket服务已停止');
  }

  // 获取服务状态
  getStatus(): {
    isRunning: boolean;
    clientCount: number;
    totalSubscriptions: number;
  } {
    return {
      isRunning: this.wss !== null,
      clientCount: this.clients.size,
      totalSubscriptions: Array.from(this.clients.values())
        .reduce((sum, client) => sum + client.subscriptions.size, 0)
    };
  }
}

// 单例导出
export const wsService = WebSocketService.getInstance();