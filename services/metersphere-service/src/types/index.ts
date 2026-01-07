export interface MeterSphereConfig {
  baseUrl: string;
  accessKey: string;
  secretKey: string;
}

export interface TestCase {
  id: string;
  name: string;
  priority: string;
  status: string;
  steps?: TestCaseStep[];
  expectedResult?: string;
  prerequisite?: string;
  remark?: string;
  moduleId?: string;
  moduleName?: string;
  createTime?: number;
  updateTime?: number;
  createUser?: string;
  maintainer?: string;
  tags?: string[];
  customFields?: Record<string, unknown>;
}

export interface TestCaseStep {
  num: number;
  desc: string;
  result: string;
}

export interface TestCaseListResponse {
  success: boolean;
  data: {
    listObject: TestCase[];
    itemCount: number;
  };
  message?: string;
}

export interface ProjectInfo {
  id: string;
  name: string;
  description?: string;
  workspaceId: string;
}

/** 需求与测试用例的关联数据 */
export interface RequirementTestCaseLink {
  requirementId: string;
  testCases: TestCase[];
  totalCount: number;
  coveredCount: number;
  passedCount: number;
  failedCount: number;
}
