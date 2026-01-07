/**
 * MeterSphere 登录测试脚本
 *
 * 使用 Playwright 登录 MeterSphere 并获取测试用例
 *
 * 使用方法：
 * 1. 安装依赖: cd services/metersphere-service && pnpm install
 * 2. 设置环境变量或修改下面的配置
 * 3. 运行测试:
 *    - 无头模式: pnpm test
 *    - 有头模式(可视化调试): pnpm test:headed
 */

import { MeterSphereClient } from './services/metersphereClient.js';

// ============ 配置区域 - 请修改为你的实际配置 ============
const config = {
  baseUrl: process.env.METERSPHERE_URL || 'http://autest.juliet.cn:8081',
  username: process.env.METERSPHERE_USERNAME || 'jianglin@ihappyplus.net.cn', // 修改为你的用户名
  password: process.env.METERSPHERE_PASSWORD || 'Zly123456', // 修改为你的密码
  headless: process.env.HEADLESS !== 'false', // 设置 HEADLESS=false 可以看到浏览器窗口
};
// ========================================================

async function main() {
  console.log('='.repeat(60));
  console.log('MeterSphere Playwright 登录测试');
  console.log('='.repeat(60));
  console.log(`\n配置信息:`);
  console.log(`  URL: ${config.baseUrl}`);
  console.log(`  用户名: ${config.username}`);
  console.log(`  无头模式: ${config.headless}`);
  console.log('');

  const client = new MeterSphereClient(config);

  try {
    // 1. 测试登录
    console.log('📝 步骤 1: 尝试登录...\n');
    const loginSuccess = await client.login();

    if (!loginSuccess) {
      console.log('❌ 登录失败！请检查用户名和密码');
      console.log('💡 提示: 截图已保存到 /tmp/metersphere-login-error.png');
      await client.close();
      return;
    }

    console.log('✅ 登录成功!\n');

    // 2. 截图保存当前页面
    await client.screenshot('/tmp/metersphere-after-login.png');
    console.log('📸 登录后截图已保存到 /tmp/metersphere-after-login.png\n');

    // 3. 获取项目列表
    console.log('📂 步骤 2: 获取项目列表...\n');
    const projects = await client.getProjects();
    console.log(`  找到 ${projects.length} 个项目:`);
    projects.forEach((p) => {
      console.log(`    - ${p.name} (ID: ${p.id})`);
    });
    console.log('');

    // 4. 获取测试用例
    console.log('📋 步骤 3: 获取测试用例列表...\n');
    const testCases = await client.getTestCases();
    console.log(`  找到 ${testCases.length} 个测试用例:`);
    testCases.slice(0, 10).forEach((tc) => {
      console.log(`    - [${tc.priority || '-'}] ${tc.name}`);
    });
    if (testCases.length > 10) {
      console.log(`    ... 还有 ${testCases.length - 10} 个用例`);
    }
    console.log('');

    // 5. 截图测试用例页面
    await client.screenshot('/tmp/metersphere-test-cases.png');
    console.log('📸 测试用例页面截图已保存到 /tmp/metersphere-test-cases.png\n');
  } catch (error) {
    console.error('❌ 发生错误:', error);
    await client.screenshot('/tmp/metersphere-error.png');
  } finally {
    // 关闭浏览器
    await client.close();
  }

  console.log('='.repeat(60));
  console.log('测试完成');
  console.log('='.repeat(60));
}

main().catch(console.error);
