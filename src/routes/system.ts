import express from 'express';
import { database } from '../database';
import { BlockModel } from '../models/BlockModel';
import { ApiResponse } from '../models/types';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// 获取系统状态
router.get('/status', authenticateToken, async (req, res: express.Response<ApiResponse>) => {
  try {
    const dbStats = await BlockModel.getDbStats();
    
    res.json({
      success: true,
      data: {
        rpcPolling: {
          isActive: true,
          interval: 3000,
          lastBlockTime: Date.now(),
          consecutiveErrors: 0
        },
        database: {
          isConnected: database.isConnectedToDb(),
          totalBlocks: dbStats.totalBlocks,
          todayBlocks: dbStats.todayBlocks,
          oldestBlock: dbStats.oldestBlock,
          newestBlock: dbStats.newestBlock
        },
        uptime: process.uptime(),
        lastUpdate: Date.now(),
        memory: {
          used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
        }
      }
    });
  } catch (error) {
    console.error('获取系统状态失败:', error);
    res.status(500).json({
      success: false,
      error: '服务器内部错误'
    });
  }
});

export default router;