/**
 * MeterSphere Playwright Client
 * 使用 Playwright 通过账号密码登录 MeterSphere 获取测试用例数据
 */

import { chromium, Browser, BrowserContext, Page } from 'playwright';

export interface MeterSphereConfig {
  /** MeterSphere 服务地址 */
  baseUrl: string;
  /** 登录用户名 */
  username: string;
  /** 登录密码 */
  password: string;
  /** 是否显示浏览器窗口 (调试用) */
  headless?: boolean;
}

export interface TestCase {
  id: string;
  name: string;
  priority?: string;
  status?: string;
  module?: string;
  tags?: string[];
  steps?: TestCaseStep[];
  prerequisite?: string;
  remark?: string;
  createUser?: string;
  updateTime?: string;
}

export interface TestCaseStep {
  num: number;
  desc: string;
  expectedResult: string;
}

export interface ProjectInfo {
  id: string;
  name: string;
}

export interface TestCaseModule {
  id: string;
  name: string;
  children?: TestCaseModule[];
}

/**
 * MeterSphere Playwright 客户端
 */
export class MeterSphereClient {
  private config: MeterSphereConfig;
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private isLoggedIn: boolean = false;

  constructor(config: MeterSphereConfig) {
    this.config = {
      ...config,
      headless: config.headless ?? true,
    };
  }

  /**
   * 初始化浏览器
   */
  private async initBrowser(): Promise<void> {
    if (this.browser) return;

    console.log('[MeterSphere] Launching browser...');
    this.browser = await chromium.launch({
      headless: this.config.headless,
    });

    this.context = await this.browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });

    this.page = await this.context.newPage();

    // 设置默认超时
    this.page.setDefaultTimeout(30000);
  }

  /**
   * 登录 MeterSphere
   */
  async login(): Promise<boolean> {
    if (this.isLoggedIn) return true;

    await this.initBrowser();
    if (!this.page) throw new Error('Browser not initialized');

    console.log('[MeterSphere] Navigating to login page...');

    try {
      // MeterSphere 可能使用不同的登录路径
      // 先访问首页，让它自动跳转到登录页
      await this.page.goto(this.config.baseUrl, { waitUntil: 'networkidle' });

      // 等待页面加载完成
      await this.page.waitForTimeout(2000);

      // 检查当前 URL，如果包含 login 或者页面有登录表单
      const currentUrl = this.page.url();
      console.log(`[MeterSphere] Current URL: ${currentUrl}`);

      // 等待登录表单加载 - 尝试多种选择器
      const loginFormSelectors = [
        'input[type="text"]',
        'input[name="username"]',
        'input[placeholder*="用户"]',
        'input[placeholder*="账号"]',
        'input[placeholder*="Username"]',
        '.el-input__inner',  // Element UI 输入框
        'input.el-input__inner',
      ];

      let foundInput = false;
      for (const selector of loginFormSelectors) {
        try {
          await this.page.waitForSelector(selector, { timeout: 3000 });
          foundInput = true;
          console.log(`[MeterSphere] Found login form with selector: ${selector}`);
          break;
        } catch {
          continue;
        }
      }

      if (!foundInput) {
        console.log('[MeterSphere] No login form found, trying to navigate to /#/login');
        await this.page.goto(`${this.config.baseUrl}/#/login`, { waitUntil: 'networkidle' });
        await this.page.waitForTimeout(2000);
      }

      console.log('[MeterSphere] Filling login form...');

      // 获取所有可见的 input 元素
      const inputs = await this.page.$$('input:visible');
      console.log(`[MeterSphere] Found ${inputs.length} visible inputs`);

      // 尝试填写用户名（第一个 text 类型的 input）
      for (const input of inputs) {
        const type = await input.getAttribute('type');
        if (type === 'text' || type === null || type === '') {
          await input.fill(this.config.username);
          console.log('[MeterSphere] Username filled');
          break;
        }
      }

      // 尝试填写密码（password 类型的 input）
      for (const input of inputs) {
        const type = await input.getAttribute('type');
        if (type === 'password') {
          await input.fill(this.config.password);
          console.log('[MeterSphere] Password filled');
          break;
        }
      }

      // 点击登录按钮
      const loginButtonSelectors = [
        'button[type="submit"]',
        'button:has-text("登录")',
        'button:has-text("登 录")',
        'button:has-text("Login")',
        '.el-button--primary',
        'button.el-button--primary',
        '.login-btn',
        '#login-btn',
      ];

      for (const selector of loginButtonSelectors) {
        try {
          const btn = await this.page.$(selector);
          if (btn && await btn.isVisible()) {
            await btn.click();
            console.log(`[MeterSphere] Login button clicked with selector: ${selector}`);
            break;
          }
        } catch {
          continue;
        }
      }

      // 等待一下让页面响应
      await this.page.waitForTimeout(3000);

      // 检查是否有错误提示
      const errorSelectors = [
        '.el-message--error',
        '.el-message-box',
        '[class*="error"]',
        '.el-alert--error',
      ];

      for (const selector of errorSelectors) {
        try {
          const errorEl = await this.page.$(selector);
          if (errorEl && await errorEl.isVisible()) {
            const errorText = await errorEl.textContent();
            console.log(`[MeterSphere] Error message found: ${errorText}`);
          }
        } catch {
          continue;
        }
      }

      // 检查当前 URL 是否已经跳转
      const afterLoginUrl = this.page.url();
      console.log(`[MeterSphere] URL after login attempt: ${afterLoginUrl}`);

      // 等待登录成功（页面跳转或出现用户菜单）
      await Promise.race([
        this.page.waitForURL((url) => !url.href.includes('login'), {
          timeout: 20000,
        }),
        this.page.waitForSelector('.user-info, .avatar, [class*="user"], .ms-header-user, .el-dropdown', {
          timeout: 20000,
        }),
      ]);

      console.log('[MeterSphere] Login successful!');
      this.isLoggedIn = true;
      return true;
    } catch (error) {
      console.error('[MeterSphere] Login failed:', error);

      // 截图保存以便调试
      if (this.page) {
        await this.page.screenshot({
          path: '/tmp/metersphere-login-error.png',
        });
        console.log('[MeterSphere] Screenshot saved to /tmp/metersphere-login-error.png');
      }

      return false;
    }
  }

  /**
   * 获取项目列表
   */
  async getProjects(): Promise<ProjectInfo[]> {
    if (!this.isLoggedIn) {
      const success = await this.login();
      if (!success) throw new Error('Login failed');
    }

    if (!this.page) throw new Error('Browser not initialized');

    console.log('[MeterSphere] Fetching projects...');

    // 拦截 API 请求获取项目数据
    const projects: ProjectInfo[] = [];

    // 监听网络请求
    const responsePromise = this.page.waitForResponse(
      (response) =>
        response.url().includes('/project') && response.status() === 200,
      { timeout: 10000 }
    ).catch(() => null);

    // 导航到项目页面或首页
    await this.page.goto(`${this.config.baseUrl}`, { waitUntil: 'networkidle' });

    const response = await responsePromise;
    if (response) {
      try {
        const data = await response.json();
        if (Array.isArray(data)) {
          return data.map((p: { id: string; name: string }) => ({
            id: p.id,
            name: p.name,
          }));
        } else if (data.data && Array.isArray(data.data)) {
          return data.data.map((p: { id: string; name: string }) => ({
            id: p.id,
            name: p.name,
          }));
        }
      } catch {
        console.log('[MeterSphere] Could not parse project response');
      }
    }

    // 备选方案：从页面元素提取
    try {
      const projectElements = await this.page.$$('[class*="project"] .name, .project-item');
      for (const el of projectElements) {
        const name = await el.textContent();
        const id = await el.getAttribute('data-id');
        if (name) {
          projects.push({ id: id || name, name: name.trim() });
        }
      }
    } catch {
      console.log('[MeterSphere] Could not extract projects from page');
    }

    return projects;
  }

  /**
   * 导航到功能测试用例页面
   */
  async navigateToTestCases(projectId?: string): Promise<void> {
    if (!this.isLoggedIn) {
      const success = await this.login();
      if (!success) throw new Error('Login failed');
    }

    if (!this.page) throw new Error('Browser not initialized');

    console.log('[MeterSphere] Navigating to test cases page...');

    // 使用 JavaScript 修改 hash 来导航（保持 session）
    // 测试跟踪的路径是 #/track/case/all
    await this.page.evaluate(() => {
      window.location.hash = '#/track/case/all';
    });

    console.log('[MeterSphere] Navigated via hash to #/track/case/all');
    await this.page.waitForTimeout(3000);
    await this.page.waitForLoadState('networkidle');

    // 截图看看当前页面
    const currentUrl = this.page.url();
    console.log(`[MeterSphere] Current URL: ${currentUrl}`);
  }

  /**
   * 获取测试用例列表
   */
  async getTestCases(projectId?: string): Promise<TestCase[]> {
    await this.navigateToTestCases(projectId);

    if (!this.page) throw new Error('Browser not initialized');

    console.log('[MeterSphere] Fetching test cases...');

    const testCases: TestCase[] = [];

    // 方法1: 拦截 API 响应
    try {
      // 刷新页面并监听 API
      const responsePromise = this.page.waitForResponse(
        (response) =>
          (response.url().includes('/case') || response.url().includes('/functional')) &&
          response.status() === 200 &&
          response.request().method() === 'POST',
        { timeout: 10000 }
      );

      // 触发数据加载（可能需要点击搜索或刷新）
      await this.page.reload({ waitUntil: 'networkidle' });

      const response = await responsePromise.catch(() => null);

      if (response) {
        const data = await response.json();
        const list = data.data?.listObject || data.data?.list || data.listObject || data.list || [];

        if (Array.isArray(list)) {
          for (const item of list) {
            testCases.push({
              id: item.id || item.caseId,
              name: item.name || item.caseName || item.title,
              priority: item.priority || item.level,
              status: item.status || item.reviewStatus,
              module: item.moduleName || item.module,
              tags: item.tags || [],
              createUser: item.createUser || item.creator,
              updateTime: item.updateTime || item.gmtModified,
            });
          }
          console.log(`[MeterSphere] Found ${testCases.length} test cases from API`);
          return testCases;
        }
      }
    } catch (error) {
      console.log('[MeterSphere] API interception failed:', error);
    }

    // 方法2: 从页面表格提取
    try {
      await this.page.waitForSelector('table tbody tr, .case-item', { timeout: 10000 });

      const rows = await this.page.$$('table tbody tr');

      for (const row of rows) {
        try {
          const cells = await row.$$('td');
          if (cells.length >= 2) {
            const id = await cells[0]?.textContent();
            const name = await cells[1]?.textContent();

            if (id && name) {
              testCases.push({
                id: id.trim(),
                name: name.trim(),
                priority: cells[2] ? await cells[2].textContent() || undefined : undefined,
                status: cells[3] ? await cells[3].textContent() || undefined : undefined,
              });
            }
          }
        } catch {
          continue;
        }
      }

      console.log(`[MeterSphere] Found ${testCases.length} test cases from table`);
    } catch (error) {
      console.log('[MeterSphere] Table extraction failed:', error);
    }

    return testCases;
  }

  /**
   * 获取测试用例详情
   */
  async getTestCaseDetail(caseId: string): Promise<TestCase | null> {
    if (!this.isLoggedIn) {
      const success = await this.login();
      if (!success) throw new Error('Login failed');
    }

    if (!this.page) throw new Error('Browser not initialized');

    console.log(`[MeterSphere] Fetching test case detail: ${caseId}`);

    // 尝试通过 API 拦截获取详情
    try {
      const responsePromise = this.page.waitForResponse(
        (response) =>
          response.url().includes(caseId) && response.status() === 200,
        { timeout: 10000 }
      );

      // 尝试导航到详情页
      const detailPaths = [
        `/functional/case/detail/${caseId}`,
        `/track/case/view/${caseId}`,
        `/test/case/detail/${caseId}`,
      ];

      for (const path of detailPaths) {
        try {
          await this.page.goto(`${this.config.baseUrl}${path}`, {
            waitUntil: 'networkidle',
            timeout: 10000,
          });
          break;
        } catch {
          continue;
        }
      }

      const response = await responsePromise.catch(() => null);

      if (response) {
        const data = await response.json();
        const caseData = data.data || data;

        return {
          id: caseData.id || caseId,
          name: caseData.name || caseData.caseName,
          priority: caseData.priority || caseData.level,
          status: caseData.status,
          module: caseData.moduleName,
          prerequisite: caseData.prerequisite || caseData.precondition,
          remark: caseData.remark || caseData.description,
          steps: this.parseSteps(caseData.steps || caseData.stepsStr),
          tags: caseData.tags || [],
          createUser: caseData.createUser,
          updateTime: caseData.updateTime,
        };
      }
    } catch (error) {
      console.log('[MeterSphere] Detail fetch failed:', error);
    }

    return null;
  }

  /**
   * 搜索测试用例
   */
  async searchTestCases(keyword: string, projectId?: string): Promise<TestCase[]> {
    await this.navigateToTestCases(projectId);

    if (!this.page) throw new Error('Browser not initialized');

    console.log(`[MeterSphere] Searching test cases: ${keyword}`);

    // 找到搜索框并输入
    const searchSelectors = [
      'input[placeholder*="搜索"]',
      'input[placeholder*="Search"]',
      'input[type="search"]',
      '.search-input input',
    ];

    for (const selector of searchSelectors) {
      try {
        const searchInput = await this.page.$(selector);
        if (searchInput) {
          await searchInput.fill(keyword);
          await this.page.keyboard.press('Enter');
          await this.page.waitForLoadState('networkidle');
          break;
        }
      } catch {
        continue;
      }
    }

    // 获取搜索结果
    return this.getTestCases(projectId);
  }

  /**
   * 解析测试步骤
   */
  private parseSteps(steps: unknown): TestCaseStep[] {
    if (!steps) return [];

    if (typeof steps === 'string') {
      try {
        steps = JSON.parse(steps);
      } catch {
        return [];
      }
    }

    if (!Array.isArray(steps)) return [];

    return steps.map((step: { num?: number; desc?: string; result?: string; expectedResult?: string }, index: number) => ({
      num: step.num || index + 1,
      desc: step.desc || '',
      expectedResult: step.result || step.expectedResult || '',
    }));
  }

  /**
   * 测试连接
   */
  async testConnection(): Promise<boolean> {
    try {
      return await this.login();
    } catch {
      return false;
    }
  }

  /**
   * 截取当前页面截图 (调试用)
   */
  async screenshot(path: string): Promise<void> {
    if (this.page) {
      await this.page.screenshot({ path, fullPage: true });
      console.log(`[MeterSphere] Screenshot saved to ${path}`);
    }
  }

  /**
   * 获取当前页面 HTML (调试用)
   */
  async getPageContent(): Promise<string> {
    if (this.page) {
      return await this.page.content();
    }
    return '';
  }

  /**
   * 关闭浏览器
   */
  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.context = null;
      this.page = null;
      this.isLoggedIn = false;
      console.log('[MeterSphere] Browser closed');
    }
  }
}

// 单例实例
let clientInstance: MeterSphereClient | null = null;

/**
 * 获取或创建 MeterSphere 客户端实例
 */
export function getMeterSphereClient(config?: MeterSphereConfig): MeterSphereClient {
  if (!clientInstance && config) {
    clientInstance = new MeterSphereClient(config);
  }
  if (!clientInstance) {
    throw new Error('MeterSphere client not initialized');
  }
  return clientInstance;
}

/**
 * 重置客户端实例
 */
export async function resetMeterSphereClient(): Promise<void> {
  if (clientInstance) {
    await clientInstance.close();
    clientInstance = null;
  }
}
