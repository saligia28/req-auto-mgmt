/**
 * MeterSphere Store
 * 管理测试用例数据的状态
 */
import { create } from 'zustand';

// MeterSphere 服务地址
const METERSPHERE_API = 'http://localhost:3404';

// 测试用例类型
export interface TestCase {
  id: string;
  name: string;
  priority?: string;
  status?: string;
  module?: string;
  tags?: string[];
  createUser?: string;
  updateTime?: string;
}

// 测试用例列表响应
interface TestCaseListResponse {
  success: boolean;
  data: TestCase[];
  error?: string;
}

// Store 状态
interface MeterSphereState {
  // 连接状态
  connected: boolean;
  connecting: boolean;

  // 测试用例数据
  testCases: TestCase[];
  loading: boolean;
  error: string | null;

  // 搜索相关
  searchKeyword: string;
  filteredTestCases: TestCase[];

  // 操作
  testConnection: () => Promise<boolean>;
  fetchTestCases: () => Promise<void>;
  searchTestCases: (keyword: string) => Promise<void>;
  setSearchKeyword: (keyword: string) => void;
  clearError: () => void;
}

export const useMeterSphereStore = create<MeterSphereState>()((set, get) => ({
  // 初始状态
  connected: false,
  connecting: false,
  testCases: [],
  loading: false,
  error: null,
  searchKeyword: '',
  filteredTestCases: [],

  // 测试连接
  testConnection: async () => {
    set({ connecting: true, error: null });
    try {
      const response = await fetch(`${METERSPHERE_API}/api/test-connection`);
      const data = await response.json();

      if (data.success && data.connected) {
        set({ connected: true, connecting: false });
        return true;
      } else {
        set({
          connected: false,
          connecting: false,
          error: 'MeterSphere 连接失败',
        });
        return false;
      }
    } catch (err) {
      set({
        connected: false,
        connecting: false,
        error: `连接错误: ${err instanceof Error ? err.message : '未知错误'}`,
      });
      return false;
    }
  },

  // 获取所有测试用例
  fetchTestCases: async () => {
    set({ loading: true, error: null });
    try {
      const response = await fetch(`${METERSPHERE_API}/api/test-cases`);
      const data: TestCaseListResponse = await response.json();

      if (data.success) {
        set({
          testCases: data.data || [],
          filteredTestCases: data.data || [],
          loading: false,
          connected: true,
        });
      } else {
        set({
          loading: false,
          error: data.error || '获取测试用例失败',
        });
      }
    } catch (err) {
      set({
        loading: false,
        error: `获取测试用例失败: ${err instanceof Error ? err.message : '未知错误'}`,
      });
    }
  },

  // 搜索测试用例
  searchTestCases: async (keyword: string) => {
    set({ loading: true, error: null, searchKeyword: keyword });

    if (!keyword.trim()) {
      // 如果关键词为空，显示所有用例
      set({
        filteredTestCases: get().testCases,
        loading: false,
      });
      return;
    }

    try {
      const response = await fetch(
        `${METERSPHERE_API}/api/test-cases/search?keyword=${encodeURIComponent(keyword)}`
      );
      const data: TestCaseListResponse = await response.json();

      if (data.success) {
        set({
          filteredTestCases: data.data || [],
          loading: false,
        });
      } else {
        set({
          loading: false,
          error: data.error || '搜索测试用例失败',
        });
      }
    } catch (err) {
      set({
        loading: false,
        error: `搜索失败: ${err instanceof Error ? err.message : '未知错误'}`,
      });
    }
  },

  // 设置搜索关键词（本地过滤）
  setSearchKeyword: (keyword: string) => {
    set({ searchKeyword: keyword });

    if (!keyword.trim()) {
      set({ filteredTestCases: get().testCases });
      return;
    }

    const filtered = get().testCases.filter(
      (tc) =>
        tc.name.toLowerCase().includes(keyword.toLowerCase()) ||
        tc.id.toLowerCase().includes(keyword.toLowerCase()) ||
        tc.module?.toLowerCase().includes(keyword.toLowerCase())
    );
    set({ filteredTestCases: filtered });
  },

  // 清除错误
  clearError: () => set({ error: null }),
}));

/**
 * 根据需求 ID 获取关联的测试用例
 * 匹配规则：用例名称中包含需求 ID（如 【1011172】）
 */
export function filterTestCasesByRequirementId(
  testCases: TestCase[],
  requirementId: string
): TestCase[] {
  if (!requirementId) return [];

  // 从 TAPD 需求 ID 中提取数字部分（如 1011172）
  const idMatch = requirementId.match(/\d+/);
  if (!idMatch) return [];

  const numericId = idMatch[0];

  // 在用例名称中查找匹配的 ID
  return testCases.filter((tc) => {
    // 匹配格式：【数字】 或 [数字]
    const nameMatch = tc.name.match(/[【\[](\d+)[】\]]/);
    return nameMatch && nameMatch[1] === numericId;
  });
}
