import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/AuthService';
import { UserModel } from '../models/UserModel';
import { ApiResponse } from '../models/types';

// 扩展Express Request接口
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        username: string;
      };
    }
  }
}

// JWT认证中间件
export const authenticateToken = async (
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = AuthService.extractTokenFromHeader(authHeader);

    if (!token) {
      res.status(401).json({
        success: false,
        error: '访问令牌缺失'
      });
      return;
    }

    const decoded = AuthService.verifyToken(token);
    if (!decoded) {
      res.status(401).json({
        success: false,
        error: '无效的访问令牌'
      });
      return;
    }

    // 验证用户是否仍然存在
    const user = await UserModel.findById(decoded.userId);
    if (!user) {
      res.status(401).json({
        success: false,
        error: '用户不存在'
      });
      return;
    }

    // 将用户信息添加到请求对象
    req.user = {
      id: user.id!,
      username: user.username
    };

    next();
  } catch (error) {
    console.error('认证中间件错误:', error);
    res.status(500).json({
      success: false,
      error: '服务器内部错误'
    });
  }
};

// 错误处理中间件
export const errorHandler = (
  error: Error,
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction
): void => {
  console.error('未处理的错误:', error);

  // 数据库错误
  if (error.message.includes('SQLITE')) {
    res.status(500).json({
      success: false,
      error: '数据库操作失败'
    });
    return;
  }

  // JWT错误
  if (error.name === 'JsonWebTokenError') {
    res.status(401).json({
      success: false,
      error: '无效的访问令牌'
    });
    return;
  }

  // 默认错误
  res.status(500).json({
    success: false,
    error: '服务器内部错误'
  });
};

// 请求日志中间件
export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(
      `${req.method} ${req.path} - ${res.statusCode} - ${duration}ms - ${req.ip}`
    );
  });
  
  next();
};

// CORS中间件配置
export const corsOptions = {
  origin: function (origin: string | undefined, callback: Function) {
    // 允许所有来源（开发环境）
    // 生产环境中应该配置具体的域名
    callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

// 安全头中间件
export const securityHeaders = (req: Request, res: Response, next: NextFunction): void => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
};

// 速率限制中间件（简单实现）
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

export const rateLimit = (maxRequests: number = 100, windowMs: number = 60000) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
    const now = Date.now();
    
    const clientData = rateLimitMap.get(clientIp);
    
    if (!clientData || now > clientData.resetTime) {
      // 重置或初始化
      rateLimitMap.set(clientIp, {
        count: 1,
        resetTime: now + windowMs
      });
      next();
      return;
    }
    
    if (clientData.count >= maxRequests) {
      res.status(429).json({
        success: false,
        error: '请求过于频繁，请稍后再试'
      });
      return;
    }
    
    clientData.count++;
    next();
  };
};