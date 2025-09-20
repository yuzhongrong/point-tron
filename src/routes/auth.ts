import express from 'express';
import { UserModel } from '../models/UserModel';
import { AuthService } from '../services/AuthService';
import { ApiResponse } from '../models/types';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// 用户登录
router.post('/login', async (req, res: express.Response<ApiResponse>) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: '用户名和密码不能为空'
      });
    }

    const user = await UserModel.verifyPassword(username, password);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: '用户名或密码错误'
      });
    }

    const token = AuthService.generateToken(user);

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          username: user.username
        }
      }
    });

  } catch (error) {
    console.error('登录错误:', error);
    res.status(500).json({
      success: false,
      error: '服务器内部错误'
    });
  }
});

// 验证令牌
router.post('/verify', authenticateToken, async (req, res: express.Response<ApiResponse>) => {
  res.json({
    success: true,
    data: {
      valid: true,
      user: req.user
    }
  });
});

export default router;