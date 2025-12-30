# 需求自动化管理系统 (Req Auto Mgmt)

需求自动化管理桌面应用，集成 TAPD、AI 和终端服务，提升需求管理效率。

## 项目结构

```
req-auto-mgmt/
├── apps/
│   └── desktop/          # Electron 桌面应用
├── packages/
│   ├── shared-types/     # 共享类型定义
│   └── ui-components/    # 共享 UI 组件
├── services/
│   ├── ai-service/       # AI 服务
│   ├── tapd-service/     # TAPD 集成服务
│   └── terminal-service/ # 终端服务
└── scripts/              # 构建脚本
```

## 环境要求

- Node.js >= 18.0.0
- pnpm >= 8.0.0

## 快速开始

### 安装依赖

```bash
pnpm install
```

### 配置环境变量

```bash
cp .env.example .env
# 编辑 .env 文件，配置必要的环境变量
```

### 开发模式

```bash
# 启动所有服务和桌面应用
pnpm dev

# 单独启动桌面应用
pnpm dev:desktop

# 单独启动服务
pnpm dev:services
```

### 构建

```bash
# 构建所有
pnpm build

# 打包 macOS 应用
pnpm dist:mac

# 打包 Windows 应用
pnpm dist:win
```

## 开发命令

| 命令 | 说明 |
|------|------|
| `pnpm dev` | 启动所有服务和桌面应用 |
| `pnpm dev:desktop` | 启动桌面应用 |
| `pnpm dev:services` | 启动所有后端服务 |
| `pnpm build` | 构建所有模块 |
| `pnpm dist:mac` | 打包 macOS 应用 |
| `pnpm dist:win` | 打包 Windows 应用 |
| `pnpm lint` | 代码检查 |
| `pnpm lint:fix` | 自动修复代码问题 |
| `pnpm typecheck` | 类型检查 |
| `pnpm clean` | 清理所有 node_modules |

## 技术栈

- **桌面应用**: Electron + React + TypeScript
- **包管理**: pnpm (Monorepo)
- **构建工具**: Vite / esbuild
- **代码规范**: ESLint + Prettier

## License

Private
