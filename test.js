#!/usr/bin/env node

const http = require('http');

// 测试配置
const BASE_URL = 'http://localhost:3000';
let authToken = '';

// 测试用例
const tests = [
  {
    name: '健康检查',
    method: 'GET',
    path: '/health',
    expectedStatus: 200
  },
  {
    name: '登录测试',
    method: 'POST',
    path: '/api/auth/login',
    data: { username: 'admin', password: 'admin123' },
    expectedStatus: 200,
    saveToken: true
  },
  {
    name: '获取区块统计',
    method: 'GET',
    path: '/api/blocks/stats',
    expectedStatus: 200,
    requireAuth: true
  },
  {
    name: '获取系统状态',
    method: 'GET',
    path: '/api/system/status',
    expectedStatus: 200,
    requireAuth: true
  },
  {
    name: '获取RPC配置',
    method: 'GET',
    path: '/api/config/rpc',
    expectedStatus: 200,
    requireAuth: true
  }
];

// HTTP请求封装
function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const jsonBody = body ? JSON.parse(body) : null;
          resolve({ status: res.statusCode, body: jsonBody, headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, body: body, headers: res.headers });
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

// 执行测试
async function runTests() {
  console.log('🚀 开始执行 Point-Tron 系统测试\n');
  
  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      const options = {
        hostname: 'localhost',
        port: 3000,
        path: test.path,
        method: test.method,
        headers: {
          'Content-Type': 'application/json'
        }
      };

      // 添加认证头
      if (test.requireAuth && authToken) {
        options.headers['Authorization'] = `Bearer ${authToken}`;
      }

      const response = await makeRequest(options, test.data);

      // 保存令牌
      if (test.saveToken && response.body && response.body.data && response.body.data.token) {
        authToken = response.body.data.token;
      }

      // 验证结果
      if (response.status === test.expectedStatus) {
        console.log(`✅ ${test.name} - 通过 (${response.status})`);
        passed++;
      } else {
        console.log(`❌ ${test.name} - 失败 (期望: ${test.expectedStatus}, 实际: ${response.status})`);
        failed++;
      }

      // 显示响应数据
      if (response.body && typeof response.body === 'object') {
        if (test.name === '获取区块统计' && response.body.success) {
          const data = response.body.data;
          console.log(`   📊 今日统计: 总计${data.todayTotal}, 单数${data.todayOdd}, 双数${data.todayEven}`);
        }
      }

    } catch (error) {
      console.log(`❌ ${test.name} - 错误: ${error.message}`);
      failed++;
    }
  }

  console.log(`\n📋 测试结果: ${passed} 通过, ${failed} 失败`);
  
  if (failed === 0) {
    console.log('🎉 所有测试通过！系统运行正常。');
  } else {
    console.log('⚠️  部分测试失败，请检查系统状态。');
  }
}

// 启动测试
runTests().catch(console.error);