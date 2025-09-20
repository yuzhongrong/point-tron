#!/usr/bin/env node

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// 检查数据库数据
async function checkDatabase() {
  const dbPath = './data/point-tron.db';
  
  console.log('🔍 检查数据库数据...');
  console.log('数据库路径:', path.resolve(dbPath));
  
  const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('❌ 数据库连接失败:', err.message);
      return;
    }
    console.log('✅ 数据库连接成功');
  });

  // 检查区块打点表
  db.get("SELECT COUNT(*) as count FROM block_points", (err, row) => {
    if (err) {
      console.error('❌ 查询失败:', err.message);
      return;
    }
    console.log(`📊 总共有 ${row.count} 条区块打点记录`);
  });

  // 检查最新的区块
  db.get("SELECT * FROM block_points ORDER BY block_number DESC LIMIT 1", (err, row) => {
    if (err) {
      console.error('❌ 查询失败:', err.message);
      return;
    }
    if (row) {
      console.log('🆕 最新区块:', {
        block_number: row.block_number,
        timestamp: row.timestamp,
        time: new Date(row.timestamp).toLocaleString(),
        cumulative_score: row.cumulative_score,
        point_change: row.point_change
      });
    }
  });

  // 检查最近24小时的数据
  const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
  db.all("SELECT MIN(cumulative_score) as min_score, MAX(cumulative_score) as max_score, COUNT(*) as count FROM block_points WHERE timestamp >= ?", [oneDayAgo], (err, rows) => {
    if (err) {
      console.error('❌ 查询失败:', err.message);
      return;
    }
    const row = rows[0];
    console.log('📈 最近24小时统计:', {
      count: row.count,
      min_score: row.min_score,
      max_score: row.max_score,
      range: row.max_score - row.min_score
    });
  });

  // 检查分数变化情况
  db.all(`
    SELECT 
      block_number,
      cumulative_score,
      point_change,
      datetime(timestamp/1000, 'unixepoch') as time
    FROM block_points 
    WHERE timestamp >= ? 
    ORDER BY block_number DESC 
    LIMIT 10
  `, [oneDayAgo], (err, rows) => {
    if (err) {
      console.error('❌ 查询失败:', err.message);
      return;
    }
    console.log('\n🔄 最近10个区块的分数变化:');
    rows.forEach(row => {
      console.log(`区块 ${row.block_number}: 分数${row.cumulative_score} (${row.point_change > 0 ? '+' : ''}${row.point_change}) - ${row.time}`);
    });
    
    // 关闭数据库连接
    db.close((err) => {
      if (err) {
        console.error('❌ 关闭数据库失败:', err.message);
      } else {
        console.log('\n✅ 数据库检查完成');
      }
    });
  });
}

checkDatabase();