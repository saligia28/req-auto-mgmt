# MeterSphere 测试用例集成服务

使用 Playwright 通过账号密码登录 MeterSphere 获取测试用例数据。

## 快速开始

### 1. 安装依赖

```bash
cd services/metersphere-service
pnpm install

# 安装 Playwright 浏览器
npx playwright install chromium
```

### 2. 配置账号

编辑 `src/test-login.ts` 文件，修改配置：

```typescript
const config = {
  baseUrl: 'http://autest.juliet.cn:8081',
  username: 'your_username',  // 修改为你的用户名
  password: 'your_password',  // 修改为你的密码
  headless: true,
};
```

或者通过环境变量：

```bash
export METERSPHERE_URL="http://autest.juliet.cn:8081"
export METERSPHERE_USERNAME="your_username"
export METERSPHERE_PASSWORD="your_password"
```

### 3. 测试登录

```bash
# 无头模式运行（后台）
pnpm test

# 有头模式运行（可以看到浏览器窗口，方便调试）
pnpm test:headed
```

### 4. 查看截图

测试过程中会自动保存截图到 `/tmp/` 目录：
- `/tmp/metersphere-after-login.png` - 登录成功后的页面
- `/tmp/metersphere-test-cases.png` - 测试用例页面
- `/tmp/metersphere-login-error.png` - 登录失败时的页面（用于调试）

## 文件结构

```
services/metersphere-service/
├── package.json
├── tsconfig.json
├── README.md
└── src/
    ├── index.ts                      # Express 服务入口
    ├── test-login.ts                 # 登录测试脚本
    ├── services/
    │   └── metersphereClient.ts      # Playwright 客户端
    └── types/
        └── index.ts                  # 类型定义
```

## API 说明

### MeterSphereClient

```typescript
import { MeterSphereClient } from './services/metersphereClient.js';

const client = new MeterSphereClient({
  baseUrl: 'http://autest.juliet.cn:8081',
  username: 'admin',
  password: 'password',
  headless: true,  // false 可以看到浏览器窗口
});

// 登录
await client.login();

// 获取项目列表
const projects = await client.getProjects();

// 获取测试用例列表
const testCases = await client.getTestCases(projectId);

// 搜索测试用例
const results = await client.searchTestCases('关键词');

// 获取测试用例详情
const detail = await client.getTestCaseDetail(caseId);

// 截图（调试用）
await client.screenshot('/tmp/screenshot.png');

// 关闭浏览器
await client.close();
```

## 服务端口

| 服务 | 端口 |
|------|------|
| MeterSphere Service | 3404 |

## 注意事项

1. **首次运行需要安装 Playwright 浏览器**：`npx playwright install chromium`
2. **调试时使用有头模式**：`pnpm test:headed` 可以看到浏览器窗口
3. **登录失败检查截图**：查看 `/tmp/metersphere-login-error.png`
4. **MeterSphere 版本**：
   - v2.x 使用 hash 路由 (如 `/#/track/case/all`)
   - v3.x 使用 history 路由 (如 `/functional/case`)

## 集成到需求详情

后续可以在 `RequirementsPage.tsx` 的 `StoryDetailPanel` 组件中添加测试用例展示区域：

```typescript
// 调用 MeterSphere 服务获取关联的测试用例
const response = await fetch('http://localhost:3404/api/test-cases/search?keyword=需求ID');
const testCases = await response.json();
```
