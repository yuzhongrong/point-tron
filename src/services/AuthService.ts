import jwt from 'jsonwebtoken';
import config from '../config';
import { User } from '../models/types';

interface JWTPayload {
  userId: number;
  username: string;
  iat?: number;
  exp?: number;
}

export class AuthService {
  // 生成JWT令牌
  static generateToken(user: User): string {
    const payload: JWTPayload = {
      userId: user.id!,
      username: user.username
    };

    return jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn
    } as jwt.SignOptions);
  }

  // 验证JWT令牌
  static verifyToken(token: string): JWTPayload | null {
    try {
      const decoded = jwt.verify(token, config.jwt.secret) as JWTPayload;
      return decoded;
    } catch (error: any) {
      console.error('JWT验证失败:', error?.message);
      return null;
    }
  }

  // 从请求头中提取令牌
  static extractTokenFromHeader(authHeader: string | undefined): string | null {
    if (!authHeader) {
      return null;
    }

    // 支持 "Bearer token" 格式
    const parts = authHeader.split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer') {
      return parts[1];
    }

    // 直接返回令牌
    return authHeader;
  }

  // 检查令牌是否即将过期（剩余时间少于1小时）
  static isTokenExpiringSoon(token: string): boolean {
    try {
      const decoded = jwt.decode(token) as JWTPayload;
      if (!decoded || !decoded.exp) {
        return true;
      }

      const now = Math.floor(Date.now() / 1000);
      const timeLeft = decoded.exp - now;
      
      // 如果剩余时间少于1小时，认为即将过期
      return timeLeft < 3600;
    } catch (error) {
      return true;
    }
  }

  // 刷新令牌
  static refreshToken(oldToken: string): string | null {
    try {
      const decoded = jwt.verify(oldToken, config.jwt.secret) as JWTPayload;
      
      // 生成新令牌
      const newPayload: JWTPayload = {
        userId: decoded.userId,
        username: decoded.username
      };

      return jwt.sign(newPayload, config.jwt.secret, {
        expiresIn: config.jwt.expiresIn
      } as jwt.SignOptions);
    } catch (error: any) {
      console.error('刷新令牌失败:', error?.message);
      return null;
    }
  }

  // 获取令牌剩余时间（秒）
  static getTokenRemainingTime(token: string): number {
    try {
      const decoded = jwt.decode(token) as JWTPayload;
      if (!decoded || !decoded.exp) {
        return 0;
      }

      const now = Math.floor(Date.now() / 1000);
      return Math.max(0, decoded.exp - now);
    } catch (error) {
      return 0;
    }
  }
}