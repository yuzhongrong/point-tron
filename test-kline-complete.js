// K线功能完整测试脚本
const { KLineModel } = require('./src/models/KLineModel');
const { database } = require('./src/database');

async function testKLineFunctionality() {
    console.log('🧪 开始K线功能完整测试...\n');

    try {
        // 1. 数据库连接测试
        console.log('📋 1. 数据库连接测试');
        await database.connect();
        await database.initializeTables();
        console.log('✅ 数据库连接和初始化成功\n');

        // 2. 数据获取测试
        console.log('📋 2. 验证区块打点数据');
        const totalRecords = await database.get('SELECT COUNT(*) as count FROM block_points');
        console.log(`📊 数据库中共有 ${totalRecords.count} 条区块打点记录`);
        
        if (totalRecords.count < 100) {
            console.log('⚠️  警告: 数据量较少，可能影响K线生成效果');
        }

        // 3. 1分钟K线生成测试
        console.log('\n📋 3. 1分钟K线生成测试');
        const testCases = [
            { limit: 5, description: '生成5个1分钟K线' },
            { limit: 10, description: '生成10个1分钟K线' },
            { limit: 50, description: '生成50个1分钟K线' }
        ];

        for (const testCase of testCases) {
            console.log(`\n🔍 测试: ${testCase.description}`);
            const startTime = Date.now();
            const klineData = await KLineModel.generateOneMinuteKLine(testCase.limit, false);
            const endTime = Date.now();
            
            console.log(`✅ 成功生成 ${klineData.length} 个K线，耗时: ${endTime - startTime}ms`);
            
            if (klineData.length > 0) {
                const firstKline = klineData[0];
                const lastKline = klineData[klineData.length - 1];
                
                console.log(`📈 第一个K线: 开盘=${firstKline.open}, 收盘=${firstKline.close}, 时间=${new Date(firstKline.timestamp).toLocaleString()}`);
                console.log(`📈 最后K线: 开盘=${lastKline.open}, 收盘=${lastKline.close}, 时间=${new Date(lastKline.timestamp).toLocaleString()}`);
                console.log(`📊 总变化: ${lastKline.close - firstKline.open}`);
            }
        }

        // 4. 技术指标测试
        console.log('\n📋 4. 技术指标计算测试');
        const indicators = await KLineModel.getTechnicalIndicators('1m', 50);
        console.log(`📊 MA5数据点: ${indicators.ma5.filter(v => !isNaN(v)).length}`);
        console.log(`📊 MA10数据点: ${indicators.ma10.filter(v => !isNaN(v)).length}`);
        console.log(`📊 MA20数据点: ${indicators.ma20.filter(v => !isNaN(v)).length}`);
        console.log(`📊 RSI数据点: ${indicators.rsi.filter(v => !isNaN(v)).length}`);

        // 5. 价格变化统计测试
        console.log('\n📋 5. 价格变化统计测试');
        const stats = await KLineModel.getPriceChangeStats('1m', 100);
        console.log('📊 统计结果:');
        console.log(`   总变化: ${stats.totalChange}`);
        console.log(`   最大涨幅: ${stats.maxGain}`);
        console.log(`   最大跌幅: ${stats.maxLoss}`);
        console.log(`   上涨周期: ${stats.positiveCount}`);
        console.log(`   下跌周期: ${stats.negativeCount}`);
        console.log(`   平均成交量: ${stats.avgVolume.toFixed(2)}`);
        console.log(`   波动率: ${stats.volatility ? stats.volatility.toFixed(4) : 'N/A'}`);
        console.log(`   胜率: ${stats.winRate ? stats.winRate.toFixed(2) + '%' : 'N/A'}`);

        // 6. 缓存性能测试
        console.log('\n📋 6. 缓存性能测试');
        console.log('🔄 第一次请求(无缓存):');
        const start1 = Date.now();
        await KLineModel.generateOneMinuteKLine(20, true);
        const time1 = Date.now() - start1;
        console.log(`   耗时: ${time1}ms`);

        console.log('🔄 第二次请求(有缓存):');
        const start2 = Date.now();
        await KLineModel.generateOneMinuteKLine(20, true);
        const time2 = Date.now() - start2;
        console.log(`   耗时: ${time2}ms`);
        console.log(`   缓存效果: ${time1 > time2 ? '✅ 生效' : '⚠️  可能未生效'}`);

        // 7. 性能指标
        console.log('\n📋 7. 性能指标测试');
        const perfMetrics = KLineModel.getPerformanceMetrics();
        console.log('📊 性能指标:');
        console.log(`   查询时间: ${perfMetrics.queryTime}ms`);
        console.log(`   处理时间: ${perfMetrics.processTime}ms`);
        console.log(`   缓存命中: ${perfMetrics.cacheHits}`);
        console.log(`   缓存未命中: ${perfMetrics.cacheMisses}`);
        console.log(`   缓存大小: ${perfMetrics.cacheStats.size}`);

        console.log('\n🎉 K线功能测试全部通过！');
        
        await database.close();
        
    } catch (error) {
        console.error('❌ 测试过程中发生错误:', error);
        process.exit(1);
    }
}

// 运行测试
testKLineFunctionality().catch(console.error);