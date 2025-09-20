const fetch = require('node-fetch');

const API_BASE = 'http://localhost:3000/api';

// 测试K线数据API
async function testKLineAPI() {
    try {
        console.log('🧪 测试K线数据API...');
        
        // 测试基本K线数据
        console.log('\n1. 测试基本K线数据...');
        const klineResponse = await fetch(`${API_BASE}/blocks/kline?period=1h&limit=50`);
        const klineData = await klineResponse.json();
        
        if (klineData.success) {
            console.log('✅ K线数据获取成功');
            console.log(`   - 数据数量: ${klineData.data.klineData.length}`);
            console.log(`   - 周期: ${klineData.data.period}`);
            
            if (klineData.data.klineData.length > 0) {
                const sample = klineData.data.klineData[0];
                console.log(`   - 样本数据: 开盘=${sample.open}, 最高=${sample.high}, 最低=${sample.low}, 收盘=${sample.close}, 成交量=${sample.volume}`);
            }
        } else {
            console.log('❌ K线数据获取失败:', klineData.error);
        }

        // 测试实时K线数据
        console.log('\n2. 测试实时K线数据...');
        const realtimeResponse = await fetch(`${API_BASE}/blocks/kline?period=1h&limit=50&realtime=true`);
        const realtimeData = await realtimeResponse.json();
        
        if (realtimeData.success) {
            console.log('✅ 实时K线数据获取成功');
            console.log(`   - 历史数据数量: ${realtimeData.data.klineData.length}`);
            
            if (realtimeData.data.currentCandle) {
                const current = realtimeData.data.currentCandle;
                console.log(`   - 当前K线: 开盘=${current.open}, 最高=${current.high}, 最低=${current.low}, 收盘=${current.close}`);
            } else {
                console.log('   - 当前无正在进行的K线');
            }
        } else {
            console.log('❌ 实时K线数据获取失败:', realtimeData.error);
        }

        // 测试技术指标
        console.log('\n3. 测试技术指标...');
        const indicatorsResponse = await fetch(`${API_BASE}/blocks/kline/indicators?period=1h&limit=50`);
        const indicatorsData = await indicatorsResponse.json();
        
        if (indicatorsData.success) {
            console.log('✅ 技术指标获取成功');
            const indicators = indicatorsData.data.indicators;
            console.log(`   - MA5长度: ${indicators.ma5.length}`);
            console.log(`   - MA10长度: ${indicators.ma10.length}`);
            console.log(`   - MA20长度: ${indicators.ma20.length}`);
            console.log(`   - RSI长度: ${indicators.rsi.length}`);
        } else {
            console.log('❌ 技术指标获取失败:', indicatorsData.error);
        }

        // 测试价格变化统计
        console.log('\n4. 测试价格变化统计...');
        const statsResponse = await fetch(`${API_BASE}/blocks/kline/stats?period=1h`);
        const statsData = await statsResponse.json();
        
        if (statsData.success) {
            console.log('✅ 价格变化统计获取成功');
            const stats = statsData.data.stats;
            console.log(`   - 总变化: ${stats.totalChange}`);
            console.log(`   - 最大涨幅: ${stats.maxGain}`);
            console.log(`   - 最大跌幅: ${stats.maxLoss}`);
            console.log(`   - 上涨周期: ${stats.positiveCount}`);
            console.log(`   - 下跌周期: ${stats.negativeCount}`);
            console.log(`   - 平均成交量: ${stats.avgVolume.toFixed(2)}`);
        } else {
            console.log('❌ 价格变化统计获取失败:', statsData.error);
        }

        console.log('\n🎉 K线API测试完成！');

    } catch (error) {
        console.error('❌ 测试过程中发生错误:', error.message);
    }
}

// 测试不同周期
async function testDifferentPeriods() {
    const periods = ['1m', '5m', '15m', '1h', '4h', '1d'];
    
    console.log('\n📊 测试不同周期的K线数据...');
    
    for (const period of periods) {
        try {
            const response = await fetch(`${API_BASE}/blocks/kline?period=${period}&limit=20`);
            const data = await response.json();
            
            if (data.success) {
                console.log(`✅ ${period}: ${data.data.klineData.length}条数据`);
            } else {
                console.log(`❌ ${period}: ${data.error}`);
            }
        } catch (error) {
            console.log(`❌ ${period}: ${error.message}`);
        }
    }
}

// 主函数
async function main() {
    console.log('🚀 Point-Tron K线功能测试');
    console.log('================================');
    
    // 等待服务器启动
    console.log('等待服务器启动...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    await testKLineAPI();
    await testDifferentPeriods();
    
    console.log('\n📋 测试总结:');
    console.log('- 已创建KLineModel模型，支持多种周期的K线数据生成');
    console.log('- 已添加/api/blocks/kline相关API接口');
    console.log('- 已创建K线图表前端页面 /kline');
    console.log('- 支持实时数据更新和技术指标计算');
    console.log('\n💡 使用说明:');
    console.log('1. 启动服务器后访问 http://localhost:3000/kline');
    console.log('2. 可以选择不同的时间周期和数据数量');
    console.log('3. 支持开启实时更新模式');
    console.log('4. 包含移动平均线和RSI技术指标');
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = { testKLineAPI, testDifferentPeriods };