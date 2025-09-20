import dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

interface Config {
  port: number;
  nodeEnv: string;
  database: {
    path: string;
  };
  jwt: {
    secret: string;
    expiresIn: string;
  };
  tron: {
    rpcUrl: string;
    timeout: number;
    retryTimes: number;
    pollingInterval: number;
  };
  admin: {
    username: string;
    password: string;
  };
  sessionSecret: string;
}

const config: Config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  database: {
    path: process.env.DB_PATH || './data/point-tron.db',
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  tron: {
    rpcUrl: process.env.TRON_RPC_URL || 'https://api.trongrid.io',
    timeout: parseInt(process.env.TRON_TIMEOUT || '5000', 10),
    retryTimes: parseInt(process.env.TRON_RETRY_TIMES || '3', 10),
    pollingInterval: parseInt(process.env.TRON_POLLING_INTERVAL || '3000', 10),
  },
  admin: {
    username: process.env.DEFAULT_ADMIN_USERNAME || 'admin',
    password: process.env.DEFAULT_ADMIN_PASSWORD || 'admin123',
  },
  sessionSecret: process.env.SESSION_SECRET || 'your-session-secret-change-in-production',
};

export default config;