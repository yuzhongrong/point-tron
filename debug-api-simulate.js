#!/usr/bin/env node

const sqlite3 = require('sqlite3').verbose();

// 模拟API查询逻辑
async function simulateAPIQuery() {
  console.log('🔍 模拟API查询逻辑...');
  
  const db = new sqlite3.Database('./data/point-tron.db');
  
  // 模拟1天时间范围
  const now = Date.now();
  const oneDayAgo = now - (24 * 60 * 60 * 1000);
  const limit = 1000;
  
  console.log('查询参数:');
  console.log('当前时间:', new Date(now).toLocaleString());
  console.log('开始时间:', new Date(oneDayAgo).toLocaleString());
  console.log('限制条数:', limit);
  
  // 1. 获取数据 (模拟 getPointsByTimeRange)
  db.all(`
    SELECT * FROM block_points 
    WHERE timestamp >= ?
    ORDER BY block_number ASC 
    LIMIT ?
  `, [oneDayAgo, limit], (err, points) => {
    if (err) {
      console.error('❌ 查询失败:', err.message);
      return;
    }
    
    console.log(`\n📊 查询到 ${points.length} 条记录`);
    
    if (points.length > 0) {
      console.log('第一条记录:', {
        block_number: points[0].block_number,
        cumulative_score: points[0].cumulative_score,
        time: new Date(points[0].timestamp).toLocaleString()
      });
      
      console.log('最后一条记录:', {
        block_number: points[points.length - 1].block_number,
        cumulative_score: points[points.length - 1].cumulative_score,
        time: new Date(points[points.length - 1].timestamp).toLocaleString()
      });
      
      // 2. 计算统计信息 (模拟 getPointsStats)
      const oddBlocks = points.filter(p => p.is_odd).length;
      const evenBlocks = points.filter(p => !p.is_odd).length;
      const scores = points.map(p => p.cumulative_score);
      
      const stats = {
        totalBlocks: points.length,
        oddBlocks,
        evenBlocks,
        totalPointChange: points[points.length - 1].cumulative_score - points[0].cumulative_score,
        currentScore: points[points.length - 1].cumulative_score,
        startScore: points[0].cumulative_score,
        maxScore: Math.max(...scores),
        minScore: Math.min(...scores)
      };
      
      console.log('\n📈 计算的统计信息:');
      console.log(JSON.stringify(stats, null, 2));
      
      // 检查是否有分数变化
      const uniqueScores = [...new Set(scores)];
      console.log('\n🔄 分数变化分析:');
      console.log('不同分数值:', uniqueScores.sort((a, b) => a - b));
      console.log('分数变化次数:', uniqueScores.length);
      
      if (uniqueScores.length === 1) {
        console.log('⚠️  所有记录的累积分数都相同！这可能是问题所在。');
        
        // 检查是否是查询时间范围的问题
        console.log('\n🔍 检查是否查询了旧数据...');
        db.get(`
          SELECT MAX(timestamp) as latest_time, MAX(block_number) as latest_block
          FROM block_points
        `, (err, latest) => {
          if (err) {
            console.error('❌ 查询失败:', err.message);
            return;
          }
          
          console.log('数据库中最新记录时间:', new Date(latest.latest_time).toLocaleString());
          console.log('数据库中最新区块号:', latest.latest_block);
          console.log('查询到的最新区块号:', points[points.length - 1].block_number);
          
          if (latest.latest_block > points[points.length - 1].block_number) {
            console.log('🚨 发现问题：查询没有获取到最新的数据！');
            console.log('数据库最新区块:', latest.latest_block);
            console.log('查询最新区块:', points[points.length - 1].block_number);
            console.log('相差区块数:', latest.latest_block - points[points.length - 1].block_number);
          }
          
          db.close();
        });
      } else {
        console.log('✅ 分数有正常变化');
        db.close();
      }
    } else {
      console.log('❌ 没有查询到数据');
      db.close();
    }
  });
}

simulateAPIQuery();