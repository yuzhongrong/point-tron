# Point-Tron - 波场网络区块链数据统计后台管理系统

## 📖 项目简介

Point-Tron 是一个基于 TypeScript 和 Node.js 开发的波场网络区块链数据统计后台管理系统。该系统实时监控波场网络每 3 秒的出块情况，统计区块哈希最后一个阿拉伯数字的单双数规律，并提供可视化的数据分析界面。

## ✨ 核心功能

- 🔄 **实时数据采集**：每 3 秒自动获取 TRON 网络最新区块数据
- 🧮 **智能数据解析**：自动提取区块哈希最后数字并判断单双数
- 📊 **统计分析**：提供今日、历史数据统计和趋势分析
- 🖥️ **后台管理**：现代化的 Web 管理界面
- 🔐 **安全认证**：JWT 令牌认证和用户权限管理
- 🛡️ **错误处理**：完善的错误重试和异常处理机制

## 🏗️ 技术栈

- **后端**: Node.js + TypeScript + Express.js
- **数据库**: SQLite
- **前端**: EJS 模板 + Bootstrap 5 + ECharts
- **认证**: JWT (JSON Web Token)
- **区块链**: TRON RPC API
- **样式**: 自定义 CSS (草深绿主题)

## 📁 项目结构

```
point-tron/
├── src/
│   ├── config/           # 配置管理
│   ├── database/         # 数据库连接和操作
│   ├── models/           # 数据模型
│   ├── services/         # 业务服务层
│   ├── routes/           # API 路由
│   ├── middleware/       # 中间件
│   ├── views/            # EJS 模板
│   └── index.ts          # 应用入口
├── public/               # 静态资源
├── data/                 # 数据库文件
├── dist/                 # 编译输出
└── package.json
```

## 🚀 快速开始

### 环境要求

- Node.js >= 16.0.0
- npm >= 8.0.0

### 安装依赖

```bash
npm install
```

### 配置环境变量

复制 `.env` 文件并根据需要修改配置：

```bash
# 服务器配置
PORT=3000
NODE_ENV=development

# 数据库配置
DB_PATH=./data/point-tron.db

# JWT 配置
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=7d

# TRON 网络配置
TRON_RPC_URL=https://api.trongrid.io
TRON_TIMEOUT=5000
TRON_RETRY_TIMES=3
TRON_POLLING_INTERVAL=3000

# 默认管理员账户
DEFAULT_ADMIN_USERNAME=admin
DEFAULT_ADMIN_PASSWORD=admin123
```

### 编译和启动

```bash
# 编译 TypeScript
npm run build

# 启动服务器
npm start

# 开发模式（推荐）
npm run dev
```

### 访问系统

- **服务器地址**: http://localhost:3000
- **登录页面**: http://localhost:3000/login
- **管理后台**: http://localhost:3000/admin
- **健康检查**: http://localhost:3000/health

### 默认登录凭据

- **用户名**: admin
- **密码**: admin123

## 📊 数据统计功能

### 实时监控

系统每 3 秒自动从 TRON 网络获取最新区块，并实时统计：

- 区块总数（按日统计）
- 单数区块数量（哈希末位为 1,3,5,7,9）
- 双数区块数量（哈希末位为 0,2,4,6,8）
- 单双数比例分析

### 数据展示

- 📈 实时统计卡片
- 🥧 单双数分布饼图
- 📊 24小时趋势图表
- 📋 区块详细信息表格

## 🔧 API 接口

### 认证相关

```bash
# 用户登录
POST /api/auth/login
Content-Type: application/json
{
  "username": "admin",
  "password": "admin123"
}

# 验证令牌
POST /api/auth/verify
Authorization: Bearer {token}
```

### 数据查询

```bash
# 获取实时统计
GET /api/blocks/stats
Authorization: Bearer {token}

# 获取历史数据
GET /api/blocks/history?date=2024-01-01
Authorization: Bearer {token}

# 获取系统状态
GET /api/system/status
Authorization: Bearer {token}
```

## 🧪 测试

运行内置的测试脚本：

```bash
node test.js
```

测试涵盖：
- ✅ 系统健康检查
- ✅ 用户登录认证
- ✅ 区块数据获取
- ✅ 系统状态查询
- ✅ 配置信息获取

## 📊 数据库设计

### 核心表结构

```sql
-- 用户表
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username VARCHAR(50) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 区块数据表
CREATE TABLE blocks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  block_number BIGINT UNIQUE NOT NULL,
  block_hash VARCHAR(66) NOT NULL,
  timestamp BIGINT NOT NULL,
  last_digit INTEGER NOT NULL,
  is_odd BOOLEAN NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 每日统计表
CREATE TABLE daily_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date DATE UNIQUE NOT NULL,
  total_blocks INTEGER DEFAULT 0,
  odd_count INTEGER DEFAULT 0,
  even_count INTEGER DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## 🔧 配置说明

### TRON 网络配置

- **RPC 节点**: https://api.trongrid.io
- **轮询间隔**: 3 秒（可配置）
- **重试次数**: 3 次
- **请求超时**: 5 秒

### 安全配置

- JWT 令牌有效期: 7 天
- 密码加密: bcryptjs
- 速率限制: 每分钟 200 次请求
- CORS 支持

## 📝 开发说明

### 新增功能

1. 在 `src/routes/` 中添加新的路由
2. 在 `src/services/` 中实现业务逻辑
3. 在 `src/models/` 中定义数据模型
4. 更新相应的 TypeScript 类型定义

### 代码规范

- 使用 TypeScript 严格模式
- 遵循 ESLint 代码规范
- 函数和变量使用驼峰命名
- 类名使用帕斯卡命名

## 🐛 故障排除

### 常见问题

1. **数据库连接失败**
   - 检查 `data/` 目录是否存在
   - 确保有写入权限

2. **TRON 网络连接超时**
   - 检查网络连接
   - 尝试更换 RPC 节点地址

3. **端口占用**
   - 修改 `.env` 中的 `PORT` 配置
   - 或使用 `lsof -ti:3000` 查找占用进程

### 日志查看

系统运行时会输出详细的日志信息：

```
🚀 Point-Tron服务器启动成功
📡 服务地址: http://localhost:3000
🔗 TRON网络: https://api.trongrid.io
⏰ 轮询间隔: 3000ms
📦 处理新区块: 75729642, 哈希末位数字: 4 (双数)
✅ 区块 75729642 处理完成
```

## 📄 许可证

MIT License

## 🤝 贡献

欢迎提交 Issue 和 Pull Request 来改进项目！

## 📞 联系方式

如有问题或建议，请通过以下方式联系：

- GitHub Issues
- 邮箱: [your-email@example.com]

---

🎉 感谢使用 Point-Tron 波场网络区块链数据统计系统！