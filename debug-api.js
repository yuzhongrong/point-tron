#!/usr/bin/env node

const http = require('http');

// 测试API的简单脚本
async function testAPI() {
  console.log('🔍 开始测试区块打点API...');
  
  try {
    // 1. 健康检查
    console.log('1. 测试健康检查接口...');
    const healthResponse = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/health',
      method: 'GET'
    });
    console.log('健康检查:', healthResponse.status === 200 ? '✅ 正常' : '❌ 异常');
    
    // 2. 登录获取token
    console.log('2. 测试登录接口...');
    const loginResponse = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, JSON.stringify({ username: 'admin', password: 'admin123' }));
    
    if (loginResponse.status !== 200) {
      console.log('❌ 登录失败');
      return;
    }
    
    const token = loginResponse.body.data.token;
    console.log('✅ 登录成功，获取到token');
    
    // 3. 测试区块统计接口
    console.log('3. 测试区块统计接口...');
    const statsResponse = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/blocks/stats',
      method: 'GET',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (statsResponse.status === 200) {
      console.log('✅ 区块统计接口正常');
      console.log('统计数据:', JSON.stringify(statsResponse.body.data, null, 2));
    } else {
      console.log('❌ 区块统计接口异常:', statsResponse.body);
    }
    
    // 4. 测试区块打点接口
    console.log('4. 测试区块打点接口...');
    const pointsResponse = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/blocks/points?timeRange=1day',
      method: 'GET',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (pointsResponse.status === 200) {
      console.log('✅ 区块打点接口正常');
      const data = pointsResponse.body.data;
      console.log(`打点数据: ${data.points.length} 个区块`);
      console.log('统计信息:', JSON.stringify(data.stats, null, 2));
      
      if (data.points.length > 0) {
        console.log('最新区块:', data.points[data.points.length - 1]);
      } else {
        console.log('⚠️  没有区块打点数据 - 这可能是问题所在！');
      }
    } else {
      console.log('❌ 区块打点接口异常:', pointsResponse.body);
    }
    
  } catch (error) {
    console.error('测试失败:', error.message);
  }
}

// HTTP请求工具函数
function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const jsonBody = body ? JSON.parse(body) : null;
          resolve({ status: res.statusCode, body: jsonBody });
        } catch (e) {
          resolve({ status: res.statusCode, body: body });
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(data);
    }
    req.end();
  });
}

// 运行测试
testAPI();