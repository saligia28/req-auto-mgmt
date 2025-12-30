#!/usr/bin/env node
/**
 * 打包前准备微服务
 * 在每个服务目录下安装独立的生产依赖
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const services = ['ai-service'];
const rootDir = path.join(__dirname, '..');

function prepareService(serviceName) {
  const serviceDir = path.join(rootDir, 'services', serviceName);
  const prodModulesDir = path.join(serviceDir, 'node_modules_prod');
  const packageJsonPath = path.join(serviceDir, 'package.json');

  console.log(`[prepare] Processing ${serviceName}...`);

  // 读取 package.json
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

  // 创建一个临时目录用于安装依赖
  const tempDir = path.join(serviceDir, '.temp_install');
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true });
  }
  fs.mkdirSync(tempDir, { recursive: true });

  // 创建简化的 package.json（只包含生产依赖）
  const prodPackageJson = {
    name: packageJson.name,
    version: packageJson.version,
    type: packageJson.type,
    dependencies: {}
  };

  // 只复制生产依赖，排除 workspace 引用
  if (packageJson.dependencies) {
    for (const [name, version] of Object.entries(packageJson.dependencies)) {
      if (!version.startsWith('workspace:')) {
        prodPackageJson.dependencies[name] = version;
      }
    }
  }

  // 写入临时 package.json
  fs.writeFileSync(
    path.join(tempDir, 'package.json'),
    JSON.stringify(prodPackageJson, null, 2)
  );

  // 使用 npm 安装依赖
  console.log(`[prepare] Installing dependencies for ${serviceName}...`);
  try {
    execSync('npm install --production --legacy-peer-deps', {
      cwd: tempDir,
      stdio: 'inherit'
    });
  } catch (error) {
    console.error(`[prepare] Failed to install dependencies for ${serviceName}:`, error.message);
    throw error;
  }

  // 删除旧的生产依赖目录
  if (fs.existsSync(prodModulesDir)) {
    fs.rmSync(prodModulesDir, { recursive: true });
  }

  // 移动 node_modules 到 node_modules_prod
  const tempNodeModules = path.join(tempDir, 'node_modules');
  if (fs.existsSync(tempNodeModules)) {
    fs.renameSync(tempNodeModules, prodModulesDir);
  }

  // 清理临时目录
  fs.rmSync(tempDir, { recursive: true });

  console.log(`[prepare] ${serviceName} done.`);
}

console.log('[prepare] Starting service preparation...');

for (const service of services) {
  prepareService(service);
}

console.log('[prepare] All services prepared.');
