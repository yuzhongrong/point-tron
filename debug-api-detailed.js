#!/usr/bin/env node

const http = require('http');

// 详细测试API返回的实际数据
async function detailedAPITest() {
  console.log('🔍 详细测试区块打点API数据...');
  
  try {
    // 1. 登录获取token
    const loginResponse = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, JSON.stringify({ username: 'admin', password: 'admin123' }));
    
    const token = loginResponse.body.data.token;
    
    // 2. 详细测试区块打点接口
    console.log('🔄 测试区块打点接口...');
    const pointsResponse = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/blocks/points?timeRange=1day&limit=10',
      method: 'GET',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (pointsResponse.status === 200) {
      const data = pointsResponse.body.data;
      console.log('✅ API响应正常');
      console.log('返回的打点数据数量:', data.points.length);
      console.log('统计信息:', JSON.stringify(data.stats, null, 2));
      
      if (data.points.length > 0) {
        console.log('\n📊 前5个区块数据:');
        data.points.slice(0, 5).forEach((point, index) => {
          console.log(`${index + 1}. 区块${point.block_number}: 分数${point.cumulative_score} (${point.point_change > 0 ? '+' : ''}${point.point_change})`);
        });
        
        console.log('\n📊 后5个区块数据:');
        data.points.slice(-5).forEach((point, index) => {
          console.log(`${index + 1}. 区块${point.block_number}: 分数${point.cumulative_score} (${point.point_change > 0 ? '+' : ''}${point.point_change})`);
        });
        
        // 分析分数分布
        const scores = data.points.map(p => p.cumulative_score);
        const actualMin = Math.min(...scores);
        const actualMax = Math.max(...scores);
        const actualRange = actualMax - actualMin;
        
        console.log('\n🔍 实际分数分析:');
        console.log('API返回的统计:', data.stats);
        console.log('实际计算的最小值:', actualMin);
        console.log('实际计算的最大值:', actualMax);
        console.log('实际变化范围:', actualRange);
        
        if (actualMin !== data.stats.minScore || actualMax !== data.stats.maxScore) {
          console.log('⚠️  发现不一致！API统计与实际数据不符');
        }
      }
    } else {
      console.log('❌ API响应异常:', pointsResponse.body);
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

detailedAPITest();