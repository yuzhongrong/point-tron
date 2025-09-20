import { database } from '../database';
import { User } from './types';
import bcrypt from 'bcryptjs';

export class UserModel {
  // 创建用户
  static async create(userData: Omit<User, 'id' | 'created_at' | 'updated_at'>): Promise<number> {
    // 加密密码
    const hashedPassword = await bcrypt.hash(userData.password, 10);
    
    const result = await database.run(
      'INSERT INTO users (username, password) VALUES (?, ?)',
      [userData.username, hashedPassword]
    );
    
    return result.lastID!;
  }

  // 根据用户名查找用户
  static async findByUsername(username: string): Promise<User | null> {
    const result = await database.get(
      'SELECT * FROM users WHERE username = ?',
      [username]
    );
    
    return result || null;
  }

  // 根据ID查找用户
  static async findById(id: number): Promise<User | null> {
    const result = await database.get(
      'SELECT * FROM users WHERE id = ?',
      [id]
    );
    
    return result || null;
  }

  // 验证用户密码
  static async verifyPassword(username: string, password: string): Promise<User | null> {
    const user = await this.findByUsername(username);
    if (!user) {
      return null;
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return null;
    }

    return user;
  }

  // 更新用户密码
  static async updatePassword(id: number, newPassword: string): Promise<boolean> {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    const result = await database.run(
      'UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [hashedPassword, id]
    );
    
    return (result.changes || 0) > 0;
  }

  // 获取所有用户（不包括密码）
  static async findAll(): Promise<Omit<User, 'password'>[]> {
    const results = await database.all(
      'SELECT id, username, created_at, updated_at FROM users ORDER BY created_at DESC'
    );
    
    return results;
  }

  // 删除用户
  static async delete(id: number): Promise<boolean> {
    const result = await database.run(
      'DELETE FROM users WHERE id = ?',
      [id]
    );
    
    return (result.changes || 0) > 0;
  }

  // 检查用户是否存在
  static async exists(username: string): Promise<boolean> {
    const result = await database.get(
      'SELECT 1 FROM users WHERE username = ?',
      [username]
    );
    
    return !!result;
  }

  // 获取用户总数
  static async count(): Promise<number> {
    const result = await database.get('SELECT COUNT(*) as count FROM users');
    return result?.count || 0;
  }
}