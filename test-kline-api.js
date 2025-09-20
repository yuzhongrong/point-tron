const https = require('https');
const http = require('http');
const { URL } = require('url');
const fetch = require('node-fetch');

// HTTP请求封装
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const protocol = urlObj.protocol === 'https:' ? https : http;
    
    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: options.headers || {}
    };
    
    const req = protocol.request(requestOptions, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({ data: jsonData, status: res.statusCode });
        } catch (error) {
          resolve({ data: data, status: res.statusCode });
        }
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    if (options.data) {
      req.write(JSON.stringify(options.data));
    }
    
    req.end();
  });
}

async function testKlineAPI() {
    try {
        console.log('🧪 测试1分钟K线API...');
        
        // 测试不需要认证的状态
        const response = await fetch('http://localhost:3000/api/blocks/kline/1minute?limit=5');
        const result = await response.json();
        
        console.log('📊 API响应状态:', response.status);
        console.log('📋 API响应内容:', JSON.stringify(result, null, 2));
        
        if (result.success) {
            console.log('✅ API测试成功！');
            console.log('📈 K线数据数量:', result.klineData ? result.klineData.length : 0);
        } else {
            console.log('❌ API测试失败:', result.error);
        }
        
    } catch (error) {
        console.error('🚨 测试错误:', error.message);
    }
}

testKlineAPI();

// 测试K线API接口
async function testKLineAPI() {
  const baseURL = 'http://localhost:3000';
  
  // 首先需要登录获取token
  console.log('🔐 正在登录获取访问令牌...');
  
  try {
    const loginResponse = await makeRequest(`${baseURL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      data: { username: 'admin', password: 'admin123' }
    });
    
    if (!loginResponse.data.success) {
      console.error('❌ 登录失败:', loginResponse.data.error);
      return;
    }
    
    const token = loginResponse.data.data.token;
    console.log('✅ 登录成功，获取到访问令牌');
    
    // 设置请求头
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
    
    console.log('\n=== 测试K线API接口 ===');
    
    // 1. 测试1分钟K线接口
    console.log('\n📊 测试1分钟K线接口...');
    const oneMinuteResponse = await makeRequest(`${baseURL}/api/blocks/kline/1minute?limit=10`, { headers });
    
    if (oneMinuteResponse.data.success) {
      const data = oneMinuteResponse.data.data;
      console.log('✅ 1分钟K线接口响应成功');
      console.log('📈 生成的K线数量:', data.candleCount);
      console.log('⏱️ 时间范围:', data.timeFrame);
      console.log('📝 描述:', data.description);
      
      if (data.klineData && data.klineData.length > 0) {
        console.log('\n📋 前3个K线数据样本:');
        data.klineData.slice(0, 3).forEach((kline, index) => {
          const change = kline.close - kline.open;
          const changePercent = kline.open !== 0 ? ((change / Math.abs(kline.open)) * 100).toFixed(2) : '0.00';
          const direction = change > 0 ? '📈' : change < 0 ? '📉' : '➡️';
          
          console.log(`${direction} K线${index + 1}:`, {
            时间: new Date(kline.timestamp).toLocaleString(),
            开盘: kline.open,
            收盘: kline.close,
            最高: kline.high,
            最低: kline.low,
            变化: `${change} (${changePercent}%)`,
            成交量: kline.volume
          });
        });
      }
    } else {
      console.error('❌ 1分钟K线接口失败:', oneMinuteResponse.data.error);
    }
    
    // 2. 测试通用K线接口
    console.log('\n📊 测试通用K线接口...');
    const generalResponse = await makeRequest(`${baseURL}/api/blocks/kline?period=1m&limit=5`, { headers });
    
    if (generalResponse.data.success) {
      const data = generalResponse.data.data;
      console.log('✅ 通用K线接口响应成功');
      console.log('📈 生成的K线数量:', data.klineData.length);
      console.log('⏱️ 周期:', data.period);
    } else {
      console.error('❌ 通用K线接口失败:', generalResponse.data.error);
    }
    
    // 3. 测试实时K线接口
    console.log('\n📊 测试实时K线接口...');
    const realtimeResponse = await makeRequest(`${baseURL}/api/blocks/kline?period=1m&limit=5&realtime=true`, { headers });
    
    if (realtimeResponse.data.success) {
      const data = realtimeResponse.data.data;
      console.log('✅ 实时K线接口响应成功');
      console.log('📈 历史K线数量:', data.klineData.length);
      if (data.currentCandle) {
        console.log('🔄 当前K线:', {
          时间: new Date(data.currentCandle.timestamp).toLocaleString(),
          当前价格: data.currentCandle.close,
          当前成交量: data.currentCandle.volume
        });
      }
    } else {
      console.error('❌ 实时K线接口失败:', realtimeResponse.data.error);
    }
    
    // 4. 测试技术指标接口
    console.log('\n📊 测试技术指标接口...');
    const indicatorsResponse = await makeRequest(`${baseURL}/api/blocks/kline/indicators?period=1m&limit=50`, { headers });
    
    if (indicatorsResponse.data.success) {
      const indicators = indicatorsResponse.data.data.indicators;
      console.log('✅ 技术指标接口响应成功');
      console.log('📊 MA5数据点数:', indicators.ma5.filter(v => !isNaN(v)).length);
      console.log('📊 MA10数据点数:', indicators.ma10.filter(v => !isNaN(v)).length);
      console.log('📊 MA20数据点数:', indicators.ma20.filter(v => !isNaN(v)).length);
      console.log('📊 RSI数据点数:', indicators.rsi.filter(v => !isNaN(v)).length);
    } else {
      console.error('❌ 技术指标接口失败:', indicatorsResponse.data.error);
    }
    
    // 5. 测试价格变化统计接口
    console.log('\n📊 测试价格变化统计接口...');
    const statsResponse = await makeRequest(`${baseURL}/api/blocks/kline/stats?period=1m`, { headers });
    
    if (statsResponse.data.success) {
      const stats = statsResponse.data.data.stats;
      console.log('✅ 价格变化统计接口响应成功');
      console.log('📈 统计信息:', {
        总变化: stats.totalChange,
        最大涨幅: stats.maxGain,
        最大跌幅: stats.maxLoss,
        上涨周期: stats.positiveCount,
        下跌周期: stats.negativeCount,
        平均成交量: stats.avgVolume.toFixed(2),
        波动率: stats.volatility ? stats.volatility.toFixed(4) : 'N/A',
        胜率: stats.winRate ? stats.winRate.toFixed(2) + '%' : 'N/A'
      });
    } else {
      console.error('❌ 价格变化统计接口失败:', statsResponse.data.error);
    }
    
    console.log('\n🎉 K线API接口测试完成！');
    
  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error.message);
    if (error.response) {
      console.error('📋 错误详情:', error.response.data);
    }
  }
}

// 执行测试
testKLineAPI().catch(console.error);