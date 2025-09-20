#!/bin/bash

echo "🚀 Point-Tron K线功能测试"
echo "================================"

# 先登录获取token
echo "1. 登录获取访问令牌..."
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}')

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
    echo "❌ 登录失败，无法获取访问令牌"
    echo "响应: $LOGIN_RESPONSE"
    exit 1
fi

echo "✅ 登录成功，获取到访问令牌"

# 测试K线API
echo ""
echo "2. 测试K线数据API..."
KLINE_RESPONSE=$(curl -s "http://localhost:3000/api/blocks/kline?period=1h&limit=5" \
  -H "Authorization: Bearer $TOKEN")

echo "K线数据响应:"
echo $KLINE_RESPONSE | python3 -m json.tool 2>/dev/null || echo $KLINE_RESPONSE

# 测试技术指标API
echo ""
echo "3. 测试技术指标API..."
INDICATORS_RESPONSE=$(curl -s "http://localhost:3000/api/blocks/kline/indicators?period=1h&limit=5" \
  -H "Authorization: Bearer $TOKEN")

echo "技术指标响应:"
echo $INDICATORS_RESPONSE | python3 -m json.tool 2>/dev/null || echo $INDICATORS_RESPONSE

# 测试统计数据API
echo ""
echo "4. 测试统计数据API..."
STATS_RESPONSE=$(curl -s "http://localhost:3000/api/blocks/kline/stats?period=1h" \
  -H "Authorization: Bearer $TOKEN")

echo "统计数据响应:"
echo $STATS_RESPONSE | python3 -m json.tool 2>/dev/null || echo $STATS_RESPONSE

echo ""
echo "🎉 测试完成！"
echo ""
echo "💡 使用说明:"
echo "1. 访问 http://localhost:3000/kline 查看K线图表"
echo "2. 先登录 http://localhost:3000/login (用户名: admin, 密码: admin123)"
echo "3. 然后访问K线页面查看图表"