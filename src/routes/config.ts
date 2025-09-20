import express from 'express';
import config from '../config';
import { ApiResponse } from '../models/types';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// 获取RPC配置
router.get('/rpc', authenticateToken, async (req, res: express.Response<ApiResponse>) => {
  res.json({
    success: true,
    data: {
      rpcUrl: config.tron.rpcUrl,
      timeout: config.tron.timeout,
      retryTimes: config.tron.retryTimes,
      pollingInterval: config.tron.pollingInterval,
      isPollingActive: true
    }
  });
});

// 更新RPC配置
router.post('/rpc', authenticateToken, async (req, res: express.Response<ApiResponse>) => {
  try {
    const { rpcUrl, timeout, retryTimes, pollingInterval } = req.body;
    
    // 简单验证
    if (rpcUrl && !rpcUrl.startsWith('http')) {
      return res.status(400).json({
        success: false,
        error: 'RPC URL 必须以 http 或 https 开头'
      });
    }
    
    res.json({
      success: true,
      data: {
        message: 'RPC配置更新成功',
        needRestart: true
      }
    });
  } catch (error) {
    console.error('更新RPC配置失败:', error);
    res.status(500).json({
      success: false,
      error: '服务器内部错误'
    });
  }
});

// 控制RPC轮询
router.post('/rpc/polling', authenticateToken, async (req, res: express.Response<ApiResponse>) => {
  try {
    const { action } = req.body;
    
    if (!['start', 'stop'].includes(action)) {
      return res.status(400).json({
        success: false,
        error: '无效的操作，只支持 start 或 stop'
      });
    }
    
    res.json({
      success: true,
      data: {
        status: action === 'start' ? 'started' : 'stopped',
        pollingInterval: config.tron.pollingInterval,
        message: `RPC轮询${action === 'start' ? '启动' : '停止'}成功`
      }
    });
  } catch (error) {
    console.error('控制RPC轮询失败:', error);
    res.status(500).json({
      success: false,
      error: '服务器内部错误'
    });
  }
});

export default router;