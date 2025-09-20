# API接口参考文档

<cite>
**本文档引用的文件**
- [src/routes/auth.ts](file://src/routes/auth.ts)
- [src/routes/blocks.ts](file://src/routes/blocks.ts)
- [src/routes/system.ts](file://src/routes/system.ts)
- [src/routes/web.ts](file://src/routes/web.ts)
- [src/middleware/auth.ts](file://src/middleware/auth.ts)
- [src/models/types.ts](file://src/models/types.ts)
- [src/services/AuthService.ts](file://src/services/AuthService.ts)
- [src/models/UserModel.ts](file://src/models/UserModel.ts)
- [src/models/BlockModel.ts](file://src/models/BlockModel.ts)
- [src/index.ts](file://src/index.ts)
- [src/config/index.ts](file://src/config/index.ts)
</cite>

## 目录
1. [简介](#简介)
2. [认证机制](#认证机制)
3. [API接口概览](#api接口概览)
4. [认证接口](#认证接口)
5. [区块数据接口](#区块数据接口)
6. [系统状态接口](#系统状态接口)
7. [Web页面接口](#web页面接口)
8. [通用响应格式](#通用响应格式)
9. [错误处理规范](#错误处理规范)
10. [使用示例](#使用示例)
11. [故障排除指南](#故障排除指南)

## 简介

Point-Tron是一个基于TRON区块链的区块数据分析系统，提供了完整的RESTful API接口用于数据查询、系统管理和用户认证。该系统采用JWT Bearer认证机制，支持实时区块数据监控、历史数据分析和系统状态查询等功能。

## 认证机制

### JWT Bearer认证

系统使用JSON Web Token (JWT) 进行身份验证，所有受保护的API接口都需要在请求头中包含有效的访问令牌。

#### 认证流程

```mermaid
sequenceDiagram
participant Client as 客户端
participant API as API服务器
participant Auth as 认证服务
participant DB as 数据库
Client->>API : POST /api/auth/login
API->>Auth : 验证用户凭据
Auth->>DB : 查询用户信息
DB-->>Auth : 返回用户数据
Auth->>Auth : 生成JWT令牌
Auth-->>API : 返回令牌
API-->>Client : {token, user}
Client->>API : GET /api/blocks/stats<br/>Authorization : Bearer token
API->>Auth : 验证JWT令牌
Auth->>Auth : 解析并验证令牌
Auth-->>API : 用户信息
API->>DB : 查询区块数据
DB-->>API : 返回数据
API-->>Client : 区块统计数据
```

**图表来源**
- [src/routes/auth.ts](file://src/routes/auth.ts#L10-L35)
- [src/middleware/auth.ts](file://src/middleware/auth.ts#L15-L50)
- [src/services/AuthService.ts](file://src/services/AuthService.ts#L15-L35)

#### 认证中间件实现

认证中间件负责验证每个请求的JWT令牌有效性，并将用户信息附加到请求对象中。

**节点来源**
- [src/middleware/auth.ts](file://src/middleware/auth.ts#L15-L50)

## API接口概览

系统提供以下主要API接口：

```mermaid
graph TB
subgraph "认证接口"
A1[/api/auth/login]
A2[/api/auth/verify]
end
subgraph "区块数据接口"
B1[/api/blocks/stats]
B2[/api/blocks/history]
B3[/api/blocks/points]
B4[/api/blocks/points/trend]
end
subgraph "系统接口"
S1[/api/system/status]
S2[/api/system/config]
end
subgraph "Web页面接口"
W1[/login]
W2[/admin]
W3[/admin/blocks]
end
A1 --> B1
A1 --> B2
A1 --> B3
A1 --> B4
A1 --> S1
A1 --> S2
A2 --> B1
A2 --> B2
A2 --> B3
A2 --> B4
A2 --> S1
A2 --> S2
```

**图表来源**
- [src/routes/auth.ts](file://src/routes/auth.ts#L1-L62)
- [src/routes/blocks.ts](file://src/routes/blocks.ts#L1-L141)
- [src/routes/system.ts](file://src/routes/system.ts#L1-L47)
- [src/routes/web.ts](file://src/routes/web.ts#L1-L50)

## 认证接口

### 登录接口

**端点**: `POST /api/auth/login`

**功能**: 用户登录并获取访问令牌

**请求头**:
```
Content-Type: application/json
```

**请求体**:
```json
{
  "username": "string",
  "password": "string"
}
```

**响应格式**:
```json
{
  "success": true,
  "data": {
    "token": "string",
    "user": {
      "id": "number",
      "username": "string"
    }
  }
}
```

**错误响应**:
```json
{
  "success": false,
  "error": "用户名和密码不能为空"
}
```

**状态码**:
- `200`: 登录成功
- `400`: 请求参数错误
- `401`: 用户名或密码错误
- `500`: 服务器内部错误

**节点来源**
- [src/routes/auth.ts](file://src/routes/auth.ts#L10-L35)

### 令牌验证接口

**端点**: `POST /api/auth/verify`

**功能**: 验证JWT令牌的有效性

**请求头**:
```
Authorization: Bearer <token>
Content-Type: application/json
```

**请求体**: 无

**响应格式**:
```json
{
  "success": true,
  "data": {
    "valid": true,
    "user": {
      "id": "number",
      "username": "string"
    }
  }
}
```

**状态码**:
- `200`: 令牌有效
- `401`: 访问令牌缺失或无效
- `500`: 服务器内部错误

**节点来源**
- [src/routes/auth.ts](file://src/routes/auth.ts#L37-L45)

## 区块数据接口

### 实时区块统计

**端点**: `GET /api/blocks/stats`

**功能**: 获取当前实时区块统计数据

**认证**: 需要JWT令牌

**响应格式**:
```json
{
  "success": true,
  "data": {
    "todayTotal": "number",
    "todayOdd": "number",
    "todayEven": "number",
    "hourlyStats": [
      {
        "hour": "string",
        "total": "number",
        "odd": "number",
        "even": "number"
      }
    ],
    "currentBlock": {
      "number": "number",
      "hash": "string",
      "timestamp": "number",
      "lastDigit": "number",
      "isOdd": "boolean"
    }
  }
}
```

**节点来源**
- [src/routes/blocks.ts](file://src/routes/blocks.ts#L10-L35)

### 历史数据查询

**端点**: `GET /api/blocks/history`

**功能**: 获取历史区块统计数据

**查询参数**:
- `date` (可选): 指定日期格式 (YYYY-MM-DD)
- `limit` (可选): 结果数量限制，默认100

**响应格式**:
```json
{
  "success": true,
  "data": [
    {
      "id": "number",
      "date": "string",
      "total_blocks": "number",
      "odd_count": "number",
      "even_count": "number"
    }
  ]
}
```

**节点来源**
- [src/routes/blocks.ts](file://src/routes/blocks.ts#L37-L55)

### 区块打点数据

**端点**: `GET /api/blocks/points`

**功能**: 获取指定时间段的区块打点数据

**查询参数**:
- `timeRange` (可选): 时间范围 ('1day', '1week', '1month')
- `limit` (可选): 结果数量限制，默认1000

**响应格式**:
```json
{
  "success": true,
  "data": {
    "points": [
      {
        "block_number": "number",
        "timestamp": "number",
        "last_digit": "number",
        "is_odd": "boolean"
      }
    ],
    "stats": {
      "total": "number",
      "odd": "number",
      "even": "number"
    },
    "timeRange": "string"
  }
}
```

**节点来源**
- [src/routes/blocks.ts](file://src/routes/blocks.ts#L57-L80)

### 打点趋势数据

**端点**: `GET /api/blocks/points/trend`

**功能**: 获取打点趋势数据

**查询参数**:
- `timeRange` (可选): 时间范围 ('1day', '1week', '1month')

**响应格式**:
```json
{
  "success": true,
  "data": {
    "trend": [
      {
        "timestamp": "number",
        "total": "number",
        "odd": "number",
        "even": "number"
      }
    ],
    "timeRange": "string"
  }
}
```

**节点来源**
- [src/routes/blocks.ts](file://src/routes/blocks.ts#L82-L115)

## 系统状态接口

### 系统状态查询

**端点**: `GET /api/system/status`

**功能**: 获取系统运行状态信息

**认证**: 需要JWT令牌

**响应格式**:
```json
{
  "success": true,
  "data": {
    "rpcPolling": {
      "isActive": "boolean",
      "interval": "number",
      "lastBlockTime": "number",
      "consecutiveErrors": "number"
    },
    "database": {
      "isConnected": "boolean",
      "totalBlocks": "number",
      "todayBlocks": "number",
      "oldestBlock": "number",
      "newestBlock": "number"
    },
    "uptime": "number",
    "lastUpdate": "number",
    "memory": {
      "used": "number",
      "total": "number"
    }
  }
}
```

**节点来源**
- [src/routes/system.ts](file://src/routes/system.ts#L10-L45)

### 系统配置接口

**端点**: `GET /api/system/config`

**功能**: 获取系统配置信息

**认证**: 需要JWT令牌

**响应格式**:
```json
{
  "success": true,
  "data": {
    "port": "number",
    "nodeEnv": "string",
    "database": {
      "path": "string"
    },
    "jwt": {
      "expiresIn": "string"
    },
    "tron": {
      "rpcUrl": "string",
      "pollingInterval": "number"
    }
  }
}
```

**节点来源**
- [src/routes/system.ts](file://src/routes/system.ts#L10-L45)

## Web页面接口

### 登录页面

**端点**: `GET /login`

**功能**: 提供用户登录页面

**响应**: EJS模板渲染的HTML页面

**节点来源**
- [src/routes/web.ts](file://src/routes/web.ts#L15-L25)

### 管理后台首页

**端点**: `GET /admin`

**功能**: 提供管理后台主页面

**响应**: EJS模板渲染的HTML页面

**节点来源**
- [src/routes/web.ts](file://src/routes/web.ts#L27-L37)

### 区块页面重定向

**端点**: `GET /admin/blocks`

**功能**: 重定向到管理后台的区块页面

**响应**: HTTP 302 重定向到 `/admin#blocks`

**节点来源**
- [src/routes/web.ts](file://src/routes/web.ts#L39-L42)

### 根路径重定向

**端点**: `GET /`

**功能**: 重定向到登录页面

**响应**: HTTP 302 重定向到 `/login`

**节点来源**
- [src/routes/web.ts](file://src/routes/web.ts#L44-L47)

## 通用响应格式

### 成功响应

所有API接口的成功响应都遵循统一格式：

```typescript
interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}
```

**示例**:
```json
{
  "success": true,
  "data": {
    "key": "value"
  }
}
```

### 错误响应

错误响应包含详细的错误信息：

```json
{
  "success": false,
  "error": "错误描述信息"
}
```

**节点来源**
- [src/models/types.ts](file://src/models/types.ts#L45-L55)

## 错误处理规范

### HTTP状态码

- `200`: 请求成功
- `400`: 请求参数错误
- `401`: 认证失败
- `404`: 资源不存在
- `429`: 请求过于频繁
- `500`: 服务器内部错误

### 错误类型

```mermaid
flowchart TD
A[API请求] --> B{认证检查}
B --> |失败| C[401 Unauthorized]
B --> |成功| D{业务逻辑}
D --> |正常| E[200 OK]
D --> |参数错误| F[400 Bad Request]
D --> |资源不存在| G[404 Not Found]
D --> |频率限制| H[429 Too Many Requests]
D --> |系统错误| I[500 Internal Server Error]
C --> J[返回错误信息]
F --> J
G --> J
H --> J
I --> J
```

**图表来源**
- [src/middleware/auth.ts](file://src/middleware/auth.ts#L52-L85)

### 错误处理中间件

系统实现了统一的错误处理中间件：

**节点来源**
- [src/middleware/auth.ts](file://src/middleware/auth.ts#L52-L85)

## 使用示例

### JavaScript示例

```javascript
// 登录获取令牌
async function login(username, password) {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ username, password })
  });
  
  const data = await response.json();
  if (data.success) {
    return data.data.token;
  }
  throw new Error(data.error);
}

// 获取区块统计数据
async function getBlockStats(token) {
  const response = await fetch('/api/blocks/stats', {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  
  return await response.json();
}
```

### Python示例

```python
import requests

def login(username, password):
    """用户登录"""
    url = "http://localhost:3000/api/auth/login"
    data = {"username": username, "password": password}
    response = requests.post(url, json=data)
    
    if response.status_code == 200:
        return response.json()["data"]["token"]
    else:
        raise Exception(f"登录失败: {response.text}")

def get_block_stats(token):
    """获取区块统计数据"""
    url = "http://localhost:3000/api/blocks/stats"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    response = requests.get(url, headers=headers)
    return response.json()
```

### cURL示例

```bash
# 1. 登录获取令牌
curl -X POST \
  http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"admin123"}'

# 响应：
# {"success":true,"data":{"token":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...","user":{"id":1,"username":"admin"}}}

# 2. 使用令牌获取区块统计数据
curl -X GET \
  http://localhost:3000/api/blocks/stats \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' \
  -H 'Content-Type: application/json'

# 响应：
# {"success":true,"data":{"todayTotal":1234,"todayOdd":617,"todayEven":617,...}}
```

## 故障排除指南

### 常见问题及解决方案

#### 1. 认证失败

**问题**: 收到401错误
```
{"success":false,"error":"访问令牌缺失"}
```

**解决方案**:
- 确保在请求头中包含正确的Authorization头
- 检查令牌格式是否正确：`Bearer <token>`
- 验证令牌是否已过期

#### 2. 请求过于频繁

**问题**: 收到429错误
```
{"success":false,"error":"请求过于频繁，请稍后再试"}
```

**解决方案**:
- 减少API调用频率
- 实现指数退避策略
- 考虑使用缓存机制

#### 3. 数据库连接问题

**问题**: 收到500错误
```
{"success":false,"error":"数据库操作失败"}
```

**解决方案**:
- 检查数据库文件权限
- 验证数据库连接配置
- 查看服务器日志获取详细错误信息

#### 4. 系统配置问题

**常见配置项**:

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| PORT | 3000 | 服务器端口 |
| DB_PATH | ./data/point-tron.db | 数据库文件路径 |
| JWT_SECRET | your-super-secret-jwt-key-change-in-production | JWT密钥 |
| TRON_RPC_URL | https://api.trongrid.io | TRON RPC节点 |
| TRON_POLLING_INTERVAL | 3000 | 区块轮询间隔(毫秒) |

**节点来源**
- [src/config/index.ts](file://src/config/index.ts#L15-L45)

### 性能优化建议

1. **合理设置轮询间隔**: 根据网络状况调整`TRON_POLLING_INTERVAL`
2. **使用适当的缓存策略**: 对于不经常变化的数据实施缓存
3. **限制查询结果数量**: 使用`limit`参数控制返回的数据量
4. **及时清理过期数据**: 系统会自动清理30天前的区块数据

### 监控和维护

#### 健康检查端点

系统提供健康检查端点用于监控服务状态：

**端点**: `GET /health`

**响应**:
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2024-01-01T00:00:00.000Z",
    "uptime": 3600,
    "database": true,
    "rpcPolling": true
  }
}
```

**节点来源**
- [src/index.ts](file://src/index.ts#L75-L85)

#### 日志记录

系统会记录以下类型的日志：
- 请求日志：记录所有API请求的详细信息
- 错误日志：记录系统错误和异常
- 认证日志：记录认证相关的活动

**节点来源**
- [src/middleware/auth.ts](file://src/middleware/auth.ts#L87-L95)

通过以上完整的API文档，开发者可以全面了解Point-Tron系统的接口规范、使用方法和最佳实践。系统提供了丰富的功能和灵活的配置选项，能够满足不同场景下的需求。