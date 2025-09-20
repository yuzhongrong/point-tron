// 测试K线API - 直接调用1分钟K线接口
const http = require('http');

async function testOneMinuteKLineAPI() {
  console.log('🚀 直接测试1分钟K线API...');
  
  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/blocks/kline/1minute?limit=5',
    method: 'GET',
    headers: {
      'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsInVzZXJuYW1lIjoiYWRtaW4iLCJpYXQiOjE3MjY4NDQzNzYsImV4cCI6MTcyNzQ0OTE3Nn0.qLZJnNGOkbJpGgHJ6_xO_TcGJ0Xz3KPMOZYp15wP7f8', // 从日志中获取的token
      'Content-Type': 'application/json'
    }
  };

  const req = http.request(options, (res) => {
    let data = '';
    
    console.log(`状态码: ${res.statusCode}`);
    
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      try {
        const response = JSON.parse(data);
        if (response.success) {
          console.log('✅ 1分钟K线API测试成功!');
          console.log('📊 响应数据:', {
            生成K线数量: response.data.candleCount,
            时间范围: response.data.timeFrame, 
            描述: response.data.description
          });
          
          if (response.data.klineData && response.data.klineData.length > 0) {
            console.log('\\n📈 前3个K线数据:');
            response.data.klineData.slice(0, 3).forEach((kline, i) => {
              const change = kline.close - kline.open;
              const direction = change > 0 ? '📈' : change < 0 ? '📉' : '➡️';
              console.log(`${direction} K线${i+1}: 时间=${new Date(kline.timestamp).toLocaleString()}, 开=${kline.open}, 收=${kline.close}, 高=${kline.high}, 低=${kline.low}, 量=${kline.volume}`);
            });
          }
        } else {
          console.error('❌ API响应失败:', response.error);
        }
      } catch (error) {
        console.error('❌ 解析响应失败:', error.message);
        console.log('原始响应:', data);
      }
    });
  });

  req.on('error', (error) => {
    console.error('❌ 请求失败:', error.message);
  });

  req.end();
}

// 运行测试
testOneMinuteKLineAPI();