/**
 * Service Manager
 * 管理微服务的启动、健康检查和关闭
 */

import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import { app } from 'electron';
import * as http from 'http';

interface ServiceConfig {
  name: string;
  port: number;
  servicePath: string;
  entryFile: string;
}

interface ServiceStatus {
  name: string;
  running: boolean;
  port: number;
  pid?: number;
}

// 是否开发环境
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

// 服务配置（只保留 AI 服务，终端功能已移至主进程 IPC）
const services: ServiceConfig[] = [
  {
    name: 'ai-service',
    port: 3402,
    servicePath: 'services/ai-service',
    entryFile: 'index.js',
  },
];

// 运行中的服务进程
const runningProcesses: Map<string, ChildProcess> = new Map();

/**
 * 获取服务目录路径
 */
function getServicePath(servicePath: string): string {
  if (isDev) {
    // 开发环境：使用项目目录
    return path.join(process.cwd(), '..', '..', servicePath, 'dist');
  } else {
    // 生产环境：使用 resources 目录
    return path.join(process.resourcesPath, servicePath);
  }
}

/**
 * 检查端口是否可用（服务是否在运行）
 */
function checkPort(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.request(
      {
        hostname: 'localhost',
        port,
        path: '/',
        method: 'GET',
        timeout: 2000,
      },
      (res) => {
        resolve(res.statusCode === 200);
      }
    );
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
    req.end();
  });
}

/**
 * 等待服务启动
 */
async function waitForService(port: number, maxRetries = 30): Promise<boolean> {
  for (let i = 0; i < maxRetries; i++) {
    const isRunning = await checkPort(port);
    if (isRunning) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}

/**
 * 启动单个服务
 */
async function startService(config: ServiceConfig): Promise<boolean> {
  const { name, port, servicePath, entryFile } = config;

  console.log(`[ServiceManager] Starting ${name}...`);

  // 检查服务是否已在运行
  const isRunning = await checkPort(port);
  if (isRunning) {
    console.log(`[ServiceManager] ${name} already running on port ${port}`);
    return true;
  }

  const serviceDir = getServicePath(servicePath);
  const entryPath = path.join(serviceDir, entryFile);

  console.log(`[ServiceManager] Service path: ${serviceDir}`);
  console.log(`[ServiceManager] Entry file: ${entryPath}`);

  try {
    const command = isDev ? 'node' : process.execPath;
    const env = {
      ...process.env,
      NODE_ENV: 'production',
      AI_SERVICE_PORT: '3402',
      ...(isDev ? {} : { ELECTRON_RUN_AS_NODE: '1' }),
    };

    // 启动服务进程
    const child = spawn(command, [entryPath], {
      cwd: serviceDir,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false,
    });

    // 保存进程引用
    runningProcesses.set(name, child);

    // 监听输出
    child.stdout?.on('data', (data) => {
      console.log(`[${name}] ${data.toString().trim()}`);
    });

    child.stderr?.on('data', (data) => {
      console.error(`[${name}] ${data.toString().trim()}`);
    });

    // 监听退出
    child.on('exit', (code, signal) => {
      console.log(`[ServiceManager] ${name} exited with code ${code}, signal ${signal}`);
      runningProcesses.delete(name);
    });

    child.on('error', (error) => {
      console.error(`[ServiceManager] ${name} error:`, error);
      runningProcesses.delete(name);
    });

    // 等待服务启动
    const started = await waitForService(port);
    if (started) {
      console.log(`[ServiceManager] ${name} started successfully on port ${port}`);
      return true;
    } else {
      console.error(`[ServiceManager] ${name} failed to start within timeout`);
      return false;
    }
  } catch (error) {
    console.error(`[ServiceManager] Failed to start ${name}:`, error);
    return false;
  }
}

/**
 * 启动所有服务
 */
export async function startAllServices(): Promise<void> {
  console.log('[ServiceManager] Starting all services...');
  console.log(`[ServiceManager] Environment: ${isDev ? 'development' : 'production'}`);

  // 开发环境下，假设服务已由 pnpm dev 启动
  if (isDev) {
    console.log('[ServiceManager] Development mode - checking if services are running...');
    for (const service of services) {
      const isRunning = await checkPort(service.port);
      if (isRunning) {
        console.log(`[ServiceManager] ${service.name} is running on port ${service.port}`);
      } else {
        console.warn(`[ServiceManager] ${service.name} is NOT running on port ${service.port}`);
        console.warn(`[ServiceManager] Please ensure you started services with 'pnpm dev'`);
      }
    }
    return;
  }

  // 生产环境：启动所有服务
  for (const service of services) {
    await startService(service);
  }
}

/**
 * 停止所有服务
 */
export function stopAllServices(): void {
  console.log('[ServiceManager] Stopping all services...');

  for (const [name, child] of runningProcesses) {
    console.log(`[ServiceManager] Stopping ${name} (PID: ${child.pid})...`);
    try {
      // 发送 SIGTERM 信号
      child.kill('SIGTERM');
    } catch (error) {
      console.error(`[ServiceManager] Failed to stop ${name}:`, error);
    }
  }

  runningProcesses.clear();
}

/**
 * 获取所有服务状态
 */
export async function getServicesStatus(): Promise<ServiceStatus[]> {
  const statuses: ServiceStatus[] = [];

  for (const service of services) {
    const isRunning = await checkPort(service.port);
    const process = runningProcesses.get(service.name);

    statuses.push({
      name: service.name,
      running: isRunning,
      port: service.port,
      pid: process?.pid,
    });
  }

  return statuses;
}

/**
 * 健康检查 - 检查并重启失败的服务
 */
export async function healthCheck(): Promise<void> {
  if (isDev) return; // 开发环境不自动重启

  for (const service of services) {
    const isRunning = await checkPort(service.port);
    if (!isRunning) {
      console.warn(`[ServiceManager] ${service.name} is not responding, restarting...`);
      await startService(service);
    }
  }
}
