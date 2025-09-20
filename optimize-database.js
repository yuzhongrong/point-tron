// 数据库性能优化脚本
const sqlite3 = require('sqlite3');
const path = require('path');

async function optimizeDatabase() {
  const dbPath = path.join(__dirname, 'data', 'point-tron.db');
  console.log('🚀 开始数据库性能优化...\n');
  
  const db = new sqlite3.Database(dbPath);
  
  // 执行SQL的Promise封装
  function runSQL(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve(this);
      });
    });
  }
  
  function getSQL(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }
  
  function allSQL(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
  
  try {
    // 1. 创建高级索引
    console.log('📋 1. 创建高级性能索引');
    
    const indexes = [
      {
        name: 'idx_block_points_timestamp_cumulative',
        sql: 'CREATE INDEX IF NOT EXISTS idx_block_points_timestamp_cumulative ON block_points(timestamp DESC, cumulative_score)',
        description: '时间戳和累积分数复合索引（降序优化）'
      },
      {
        name: 'idx_block_points_block_number_desc',
        sql: 'CREATE INDEX IF NOT EXISTS idx_block_points_block_number_desc ON block_points(block_number DESC)',
        description: '区块号降序索引（用于最新数据查询）'
      },
      {
        name: 'idx_block_points_created_at',
        sql: 'CREATE INDEX IF NOT EXISTS idx_block_points_created_at ON block_points(created_at)',
        description: '创建时间索引（用于数据清理）'
      },
      {
        name: 'idx_block_points_time_range',
        sql: 'CREATE INDEX IF NOT EXISTS idx_block_points_time_range ON block_points(timestamp, block_number) WHERE timestamp > 0',
        description: '时间范围查询索引（部分索引优化）'
      }
    ];
    
    for (const index of indexes) {
      try {
        await runSQL(index.sql);
        console.log(`✅ 创建索引: ${index.name} - ${index.description}`);
      } catch (error) {
        console.log(`⚠️  索引可能已存在: ${index.name}`);
      }
    }
    
    // 2. 数据库统计信息更新
    console.log('\n📋 2. 更新数据库统计信息');
    await runSQL('ANALYZE');
    console.log('✅ 数据库统计信息已更新');
    
    // 3. 检查数据库性能参数
    console.log('\n📋 3. 数据库性能检查');
    
    // 检查表大小和记录数
    const tableInfo = await getSQL(`
      SELECT 
        COUNT(*) as record_count,
        MIN(timestamp) as min_time,
        MAX(timestamp) as max_time,
        MAX(block_number) - MIN(block_number) as block_span
      FROM block_points
    `);
    
    console.log('📊 数据库状态:');
    console.log(`   记录总数: ${tableInfo.record_count.toLocaleString()}`);
    console.log(`   时间跨度: ${new Date(tableInfo.min_time).toLocaleDateString()} 至 ${new Date(tableInfo.max_time).toLocaleDateString()}`);
    console.log(`   区块跨度: ${tableInfo.block_span.toLocaleString()} 个区块`);
    
    // 4. 查询性能测试
    console.log('\n📋 4. 查询性能基准测试');
    
    const queryTests = [
      {
        name: '最新1000条记录查询',
        sql: 'SELECT * FROM block_points ORDER BY block_number DESC LIMIT 1000'
      },
      {
        name: '最新2000条记录查询（100个K线）',
        sql: 'SELECT timestamp, cumulative_score, block_number FROM block_points ORDER BY block_number DESC LIMIT 2000'
      },
      {
        name: '时间范围查询（24小时）',
        sql: 'SELECT * FROM block_points WHERE timestamp >= ? ORDER BY timestamp DESC LIMIT 1000',
        params: [Date.now() - 24 * 60 * 60 * 1000]
      },
      {
        name: '累积分数统计查询',
        sql: 'SELECT MIN(cumulative_score) as min_score, MAX(cumulative_score) as max_score, AVG(cumulative_score) as avg_score FROM block_points WHERE timestamp >= ?',
        params: [Date.now() - 7 * 24 * 60 * 60 * 1000]
      }
    ];
    
    for (const test of queryTests) {
      const start = Date.now();
      try {
        const result = await allSQL(test.sql, test.params || []);
        const duration = Date.now() - start;
        console.log(`✅ ${test.name}: ${duration}ms (${result.length} 条记录)`);
        
        // 性能警告
        if (duration > 1000) {
          console.log(`⚠️  警告: 查询时间超过1秒，可能需要进一步优化`);
        }
      } catch (error) {
        console.log(`❌ ${test.name}: 查询失败 - ${error.message}`);
      }
    }
    
    // 5. 内存和存储优化
    console.log('\n📋 5. 内存和存储优化');
    
    // 设置SQLite性能参数
    const pragmaSettings = [
      'PRAGMA journal_mode = WAL',           // 使用WAL模式提高并发性能
      'PRAGMA synchronous = NORMAL',         // 平衡性能和数据安全
      'PRAGMA cache_size = -64000',          // 设置64MB缓存
      'PRAGMA temp_store = MEMORY',          // 临时数据存储在内存中
      'PRAGMA mmap_size = 268435456',        // 设置256MB内存映射
      'PRAGMA optimize'                      // 优化查询计划
    ];
    
    for (const pragma of pragmaSettings) {
      try {
        await runSQL(pragma);
        console.log(`✅ 应用设置: ${pragma}`);
      } catch (error) {
        console.log(`⚠️  设置失败: ${pragma} - ${error.message}`);
      }
    }
    
    // 6. 数据清理建议
    console.log('\n📋 6. 数据维护建议');
    
    // 检查数据分布
    const dataDistribution = await allSQL(`
      SELECT 
        DATE(datetime(timestamp/1000, 'unixepoch')) as date,
        COUNT(*) as count
      FROM block_points 
      WHERE timestamp > ?
      GROUP BY date 
      ORDER BY date DESC 
      LIMIT 30
    `, [Date.now() - 30 * 24 * 60 * 60 * 1000]);
    
    if (dataDistribution.length > 0) {
      console.log('📊 最近30天数据分布:');
      dataDistribution.slice(0, 7).forEach(row => {
        console.log(`   ${row.date}: ${row.count.toLocaleString()} 条记录`);
      });
      
      const totalRecords = dataDistribution.reduce((sum, row) => sum + row.count, 0);
      const avgPerDay = Math.round(totalRecords / dataDistribution.length);
      console.log(`📈 平均每日记录数: ${avgPerDay.toLocaleString()}`);
      
      // 数据清理建议
      if (tableInfo.record_count > 100000) {
        console.log('\n💡 优化建议:');
        console.log('   - 考虑定期清理90天前的历史数据');
        console.log('   - 可以实施数据归档策略');
        console.log('   - 建议启用自动VACUUM以回收空间');
      }
    }
    
    // 7. 索引使用分析
    console.log('\n📋 7. 索引使用分析');
    
    // 检查索引统计信息
    const indexes_info = await allSQL(`
      SELECT name, tbl_name, sql 
      FROM sqlite_master 
      WHERE type = 'index' AND tbl_name = 'block_points'
      ORDER BY name
    `);
    
    console.log('📊 当前索引列表:');
    indexes_info.forEach(idx => {
      if (idx.sql) { // 排除自动创建的主键索引
        console.log(`   - ${idx.name}`);
      }
    });
    
    console.log('\n🎯 性能优化完成! 主要改进:');
    console.log('   ✅ 创建了4个高性能索引');
    console.log('   ✅ 优化了数据库配置参数');
    console.log('   ✅ 启用了WAL模式提高并发性能');
    console.log('   ✅ 设置了64MB查询缓存');
    console.log('   ✅ 完成了查询性能基准测试');
    
  } catch (error) {
    console.error('❌ 优化过程中发生错误:', error);
  } finally {
    db.close();
  }
}

// 运行优化
optimizeDatabase().catch(console.error);