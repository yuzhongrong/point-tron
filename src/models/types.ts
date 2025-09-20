// 区块信息接口
export interface BlockInfo {
  id?: number;
  block_number: number;
  block_hash: string;
  timestamp: number;
  last_digit: number;
  is_odd: boolean;
  created_at?: string;
}

// 用户信息接口
export interface User {
  id?: number;
  username: string;
  password: string;
  created_at?: string;
  updated_at?: string;
}

// 每日统计接口
export interface DailyStats {
  id?: number;
  date: string;
  total_blocks: number;
  odd_count: number;
  even_count: number;
  updated_at?: string;
}

// 系统配置接口
export interface SystemConfig {
  id?: number;
  key: string;
  value: string;
  description?: string;
  updated_at?: string;
}

// 统计数据响应接口
export interface StatsResponse {
  todayTotal: number;
  todayOdd: number;
  todayEven: number;
  currentBlock: {
    number: number;
    hash: string;
    timestamp: number;
    lastDigit: number;
    isOdd: boolean;
  };
}

// API 响应接口
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

// K线数据接口
export interface KLineData {
  timestamp: number;
  open: number;    // 开盘价（周期开始分数）
  high: number;    // 最高价（周期内最高分数）
  low: number;     // 最低价（周期内最低分数）
  close: number;   // 收盘价（周期结束分数）
  volume: number;  // 成交量（周期内区块数量）
}

// K线周期类型
export type KLinePeriod = '1m' | '5m' | '15m' | '1h' | '4h' | '1d';