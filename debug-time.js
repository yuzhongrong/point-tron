#!/usr/bin/env node

// 测试时间范围计算
function testTimeRange() {
  const now = Date.now();
  const oneDayAgo = now - (24 * 60 * 60 * 1000);
  
  console.log('🕒 时间范围测试:');
  console.log('当前时间:', new Date(now).toLocaleString());
  console.log('24小时前:', new Date(oneDayAgo).toLocaleString());
  console.log('当前时间戳:', now);
  console.log('24小时前时间戳:', oneDayAgo);
  
  // 测试SQL查询条件
  const sqlite3 = require('sqlite3').verbose();
  const db = new sqlite3.Database('./data/point-tron.db');
  
  // 直接用API相同的查询条件
  db.all(`
    SELECT 
      MIN(cumulative_score) as min_score, 
      MAX(cumulative_score) as max_score, 
      COUNT(*) as count,
      MIN(timestamp) as min_time,
      MAX(timestamp) as max_time
    FROM block_points 
    WHERE timestamp >= ?
  `, [oneDayAgo], (err, rows) => {
    if (err) {
      console.error('❌ 查询失败:', err.message);
      return;
    }
    
    const row = rows[0];
    console.log('\n📊 API查询条件结果:');
    console.log('记录数:', row.count);
    console.log('最小分数:', row.min_score);
    console.log('最大分数:', row.max_score);
    console.log('时间范围:', new Date(row.min_time).toLocaleString(), '-', new Date(row.max_time).toLocaleString());
    
    // 关闭数据库
    db.close();
  });
}

testTimeRange();