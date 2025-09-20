#!/usr/bin/env node

const sqlite3 = require('sqlite3').verbose();

// 测试修复后的查询逻辑
async function testFixedQuery() {
  console.log('🔍 测试修复后的查询逻辑...');
  
  const db = new sqlite3.Database('./data/point-tron.db');
  
  // 模拟1天时间范围
  const now = Date.now();
  const oneDayAgo = now - (24 * 60 * 60 * 1000);
  const limit = 1000;
  
  console.log('查询参数:');
  console.log('当前时间:', new Date(now).toLocaleString());
  console.log('开始时间:', new Date(oneDayAgo).toLocaleString());
  console.log('限制条数:', limit);
  
  // 使用修复后的查询逻辑
  db.all(`
    SELECT * FROM (
      SELECT * FROM block_points 
      WHERE timestamp >= ?
      ORDER BY block_number DESC 
      LIMIT ?
    ) ORDER BY block_number ASC
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
      
      // 计算统计信息
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
      
      console.log('\n📈 修复后的统计信息:');
      console.log(JSON.stringify(stats, null, 2));
      
      // 检查分数变化
      const uniqueScores = [...new Set(scores)];
      console.log('\n🔄 分数变化分析:');
      console.log('不同分数值:', uniqueScores.sort((a, b) => a - b));
      console.log('分数变化次数:', uniqueScores.length);
      console.log('分数范围:', Math.min(...scores), '到', Math.max(...scores));
      
      if (uniqueScores.length > 1) {
        console.log('✅ 分数有正常变化，修复成功！');
      } else {
        console.log('⚠️  分数仍然没有变化');
      }
    }
    
    db.close();
  });
}

testFixedQuery();