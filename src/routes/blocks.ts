import express from 'express';
import { BlockModel } from '../models/BlockModel';
import { DailyStatsModel } from '../models/DailyStatsModel';
import { BlockPointsModel, TimeRange } from '../models/BlockPointsModel';
import { KLineModel } from '../models/KLineModel';
import { KLinePeriod, ApiResponse } from '../models/types';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// 获取实时区块统计
router.get('/stats', authenticateToken, async (req, res: express.Response<ApiResponse>) => {
  try {
    const [todayStats, currentBlock, hourlyStats] = await Promise.all([
      BlockModel.getTodayStats(),
      BlockModel.getLatest(),
      BlockModel.getTodayHourlyStats()
    ]);

    res.json({
      success: true,
      data: {
        todayTotal: todayStats.total,
        todayOdd: todayStats.odd,
        todayEven: todayStats.even,
        hourlyStats: hourlyStats,
        currentBlock: currentBlock ? {
          number: currentBlock.block_number,
          hash: currentBlock.block_hash,
          timestamp: currentBlock.timestamp,
          lastDigit: currentBlock.last_digit,
          isOdd: currentBlock.is_odd
        } : null
      }
    });

  } catch (error) {
    console.error('获取统计数据错误:', error);
    res.status(500).json({
      success: false,
      error: '服务器内部错误'
    });
  }
});

// 获取历史数据
router.get('/history', authenticateToken, async (req, res: express.Response<ApiResponse>) => {
  try {
    const date = req.query.date as string;
    const limit = parseInt(req.query.limit as string) || 100;

    if (date) {
      const dayStats = await DailyStatsModel.getStatsByDate(date);
      res.json({
        success: true,
        data: dayStats
      });
    } else {
      const historyBlocks = await BlockModel.getHistoryStats(limit);
      res.json({
        success: true,
        data: historyBlocks
      });
    }

  } catch (error) {
    console.error('获取历史数据错误:', error);
    res.status(500).json({
      success: false,
      error: '服务器内部错误'
    });
  }
});

// 获取区块打点数据
router.get('/points', authenticateToken, async (req, res: express.Response<ApiResponse>) => {
  try {
    const timeRange = (req.query.timeRange as TimeRange) || '1day';
    const limit = parseInt(req.query.limit as string) || 1000;
    
    const [points, stats] = await Promise.all([
      BlockPointsModel.getPointsByTimeRange(timeRange, limit),
      BlockPointsModel.getPointsStats(timeRange)
    ]);
    
    res.json({
      success: true,
      data: {
        points: points,
        stats: stats,
        timeRange: timeRange
      }
    });

  } catch (error) {
    console.error('获取区块打点数据错误:', error);
    res.status(500).json({
      success: false,
      error: '服务器内部错误'
    });
  }
});

// 获取打点趋势数据
router.get('/points/trend', authenticateToken, async (req, res: express.Response<ApiResponse>) => {
  try {
    const timeRange = (req.query.timeRange as TimeRange) || '1day';
    
    let trendData;
    
    switch (timeRange) {
      case '1day':
        trendData = await BlockPointsModel.getHourlyPoints();
        break;
      case '1week':
        trendData = await BlockPointsModel.getDailyPoints(7);
        break;
      case '1month':
        trendData = await BlockPointsModel.getDailyPoints(30);
        break;
      default:
        trendData = await BlockPointsModel.getHourlyPoints();
    }
    
    res.json({
      success: true,
      data: {
        trend: trendData,
        timeRange: timeRange
      }
    });

  } catch (error) {
    console.error('获取打点趋势数据错误:', error);
    res.status(500).json({
      success: false,
      error: '服务器内部错误'
    });
  }
});

// 获取K线数据
router.get('/kline', authenticateToken, async (req, res: express.Response<ApiResponse>) => {
  try {
    const period = (req.query.period as KLinePeriod) || '1h';
    const limit = parseInt(req.query.limit as string) || 100;
    const realtime = req.query.realtime === 'true';
    
    if (realtime) {
      const data = await KLineModel.getRealTimeKLineData(period, limit);
      res.json({
        success: true,
        data: {
          klineData: data.historical,
          currentCandle: data.current,
          period
        }
      });
    } else {
      const klineData = await KLineModel.generateKLineData(period, undefined, undefined, limit);
      res.json({
        success: true,
        data: {
          klineData,
          period
        }
      });
    }

  } catch (error) {
    console.error('获取K线数据错误:', error);
    res.status(500).json({
      success: false,
      error: '服务器内部错误'
    });
  }
});

// 新增：专门的1分钟K线接口（每分钟20条3秒记录）
router.get('/kline/1minute', authenticateToken, async (req, res: express.Response<ApiResponse>) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100; // 默认生成100个1分钟K线
    
    console.log(`接收到1分钟K线请求: 生成${limit}个K线`);
    
    const klineData = await KLineModel.generateOneMinuteKLine(limit);
    
    res.json({
      success: true,
      data: {
        klineData,
        timeFrame: '1分钟',
        candleCount: klineData.length,
        recordsPerCandle: 20,
        description: `每个1分钟K线由20条3秒记录生成，共${klineData.length}个K线`
      }
    });

  } catch (error) {
    console.error('获取1分钟K线数据错误:', error);
    res.status(500).json({
      success: false,
      error: '服务器内部错误'
    });
  }
});

// 获取技术指标数据
router.get('/kline/indicators', authenticateToken, async (req, res: express.Response<ApiResponse>) => {
  try {
    const period = (req.query.period as KLinePeriod) || '1h';
    const limit = parseInt(req.query.limit as string) || 100;
    
    const indicators = await KLineModel.getTechnicalIndicators(period, limit);
    
    res.json({
      success: true,
      data: {
        indicators,
        period
      }
    });

  } catch (error) {
    console.error('获取技术指标数据错误:', error);
    res.status(500).json({
      success: false,
      error: '服务器内部错误'
    });
  }
});

// 获取价格变化统计
router.get('/kline/stats', authenticateToken, async (req, res: express.Response<ApiResponse>) => {
  try {
    const period = (req.query.period as KLinePeriod) || '1h';
    
    const stats = await KLineModel.getPriceChangeStats(period);
    
    res.json({
      success: true,
      data: {
        stats,
        period
      }
    });

  } catch (error) {
    console.error('获取价格变化统计错误:', error);
    res.status(500).json({
      success: false,
      error: '服务器内部错误'
    });
  }
});

export default router;