/**
 * TAPD Service Types
 */

// TAPD 配置
export interface TapdConfig {
  apiBase: string;
  workspaceId: string;
  token?: string;
  username?: string;
  password?: string;
}

// 迭代
export interface TapdIteration {
  id: string;
  name: string;
  status?: string;
  startdate?: string;
  enddate?: string;
}

// 原始需求数据
export interface TapdStoryRaw {
  id: string;
  name?: string;
  title?: string;
  description?: string;
  status?: string;
  v_status?: string;
  priority?: string;
  owner?: string;
  creator?: string;
  created?: string;
  modified?: string;
  iteration_id?: string;
  module?: string;
  workspace_id?: string;
  custom_field_four?: string; // 前端
  [key: string]: any;
}

// 需求摘要（列表展示用）
export interface StorySummary {
  id: string;
  title: string;
  status?: string | null;
  statusLabel?: string | null;
  owners: string[];
  frontend?: string | null;
  iteration?: string | null;
  iterationId?: string | null;
  updatedAt?: string | null;
  url?: string | null;
}

// 需求详情
export interface StoryDetail extends StorySummary {
  description: string;
  priority?: string;
  creator?: string;
  createdAt?: string;
  module?: string;
  raw?: TapdStoryRaw;
}

// API 响应
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// 状态映射
export const STATUS_VALUE_MAP: Record<string, string> = {
  'planning': '规划中',
  'status_8': '待开发',
  'status_2': '开发中',
  'status_4': '联调中',
  'status_5': '联调完成',
  'status_12': '已提测',
  'status_6': '测试中',
  'status_7': '测试完成',
  'status_10': '产品验收',
  'status_3': '已完成',
  'status_11': '关闭',
};
