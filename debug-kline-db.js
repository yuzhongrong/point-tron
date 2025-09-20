const sqlite3 = require('sqlite3');
const path = require('path');

// 检查数据库表结构和索引
async function checkDatabase() {
  const dbPath = path.join(__dirname, 'data', 'point-tron.db');
  console.log('数据库路径:', dbPath);
  
  const db = new sqlite3.Database(dbPath);
  
  // 检查block_points表结构
  console.log('\n=== 检查block_points表结构 ===');
  db.all("PRAGMA table_info(block_points)", (err, rows) => {
    if (err) {
      console.error('查询表结构失败:', err);
      return;
    }
    
    console.log('表字段:');
    rows.forEach(row => {
      console.log(`- ${row.name}: ${row.type} ${row.pk ? '(主键)' : ''} ${row.notnull ? '(非空)' : ''}`);
    });
  });
  
  // 检查现有索引
  console.log('\n=== 检查现有索引 ===');
  db.all("SELECT name, sql FROM sqlite_master WHERE type='index' AND tbl_name='block_points'", (err, rows) => {
    if (err) {
      console.error('查询索引失败:', err);
      return;
    }
    
    console.log('现有索引:');
    rows.forEach(row => {
      if (row.sql) { // 过滤自动创建的主键索引
        console.log(`- ${row.name}: ${row.sql}`);
      }
    });
  });
  
  // 检查数据统计
  console.log('\n=== 数据统计 ===');
  db.get("SELECT COUNT(*) as total FROM block_points", (err, row) => {
    if (err) {
      console.error('统计数据失败:', err);
      return;
    }
    console.log(`总记录数: ${row.total}`);
    
    // 检查最新的几条记录
    db.all("SELECT * FROM block_points ORDER BY block_number DESC LIMIT 5", (err, rows) => {
      if (err) {
        console.error('查询最新记录失败:', err);
        return;
      }
      
      console.log('\n最新5条记录:');
      rows.forEach(row => {
        console.log(`区块#${row.block_number}: 时间=${new Date(row.timestamp).toLocaleString()}, 分数=${row.cumulative_score}, 变化=${row.point_change}`);
      });
      
      // 创建K线所需的优化索引
      console.log('\n=== 创建K线优化索引 ===');
      
      // 为K线生成创建复合索引
      db.run("CREATE INDEX IF NOT EXISTS idx_block_points_timestamp_score ON block_points(timestamp, cumulative_score)", (err) => {
        if (err) {
          console.error('创建时间-分数复合索引失败:', err);
        } else {
          console.log('✅ 创建时间-分数复合索引成功');
        }
      });
      
      // 为按区块号倒序查询创建索引
      db.run("CREATE INDEX IF NOT EXISTS idx_block_points_number_desc ON block_points(block_number DESC)", (err) => {
        if (err) {
          console.error('创建区块号倒序索引失败:', err);
        } else {
          console.log('✅ 创建区块号倒序索引成功');
        }
      });
      
      // 测试K线生成查询性能
      console.log('\n=== 测试K线查询性能 ===');
      const start = Date.now();
      
      // 模拟获取2000条记录用于生成100个1分钟K线
      db.all(
        "SELECT timestamp, cumulative_score, block_number, point_change FROM block_points ORDER BY block_number DESC LIMIT 2000",
        (err, rows) => {
          if (err) {
            console.error('测试查询失败:', err);
          } else {
            const end = Date.now();
            console.log(`查询2000条记录耗时: ${end - start}ms`);
            console.log(`可生成K线数量: ${Math.floor(rows.length / 20)}`);
            
            if (rows.length >= 20) {
              // 测试生成一个K线
              const first20 = rows.slice(0, 20).reverse(); // 转为时间正序
              const scores = first20.map(r => r.cumulative_score);
              const kline = {
                timestamp: Math.floor(first20[0].timestamp / 60000) * 60000,
                open: first20[0].cumulative_score,
                close: first20[19].cumulative_score,
                high: Math.max(...scores),
                low: Math.min(...scores),
                volume: 20
              };
              
              console.log('\n示例K线数据:');
              console.log(`时间: ${new Date(kline.timestamp).toLocaleString()}`);
              console.log(`开盘: ${kline.open}, 收盘: ${kline.close}`);
              console.log(`最高: ${kline.high}, 最低: ${kline.low}`);
              console.log(`变化: ${kline.close - kline.open} (${((kline.close - kline.open) / Math.abs(kline.open) * 100).toFixed(2)}%)`);
            }
          }
          
          db.close();
        }
      );
    });
  });
}

checkDatabase().catch(console.error);