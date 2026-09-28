# AGENTS.md

将宜搭（Yida）低代码平台作为 Git 远端存储后端的 Git Remote Helper。Agent 应专注于协议实现、存储适配器、E2E 测试，不涉及与 git 无关的业务逻辑。

## 概述

- 本项目是一个 **git remote helper**：git 通过 stdin/stdout 向其发送命令（`capabilities`、`list`、`push`、`fetch`），helper 用宜搭表单作为对象存储后端。

## 边界与范围

- **范围内**：
  - git remote helper 协议解析（`\n\n` 分隔的命令块 + fast-import/export 流）
  - 双存储后端：`FileStorage`（本地测试）与 `YidaStorage`（宜搭 REST API）
  - Push/Fetch 往返的对象完整性（SHA 一致性）
  - E2E 测试：创建源仓库 → push → fetch → clone 全链路验证
- **非目标**：
  - 不实现 merge/pack 等 git 服务端逻辑（委托给 git 自身）
  - 不实现 Web UI
  - 不处理并发 push（宜搭不支持原生 CAS）

## Agent 操作指南

- 理解本项目的方法：先读 `docs/ARCHITECTURE.md` 了解模块关系，再读 `src/protocol.ts`（核心协议逻辑），最后 `src/storage.ts`（数据层）。
- 全局规则：
  - 所有改动后必须跑 `pnpm build && pnpm test`确认 E2E 通过。
  - 存储后端通过 `StorageBackend` 接口定义，新增后端只需实现该接口。
  - `FileStorage` 的 `YIDA_LOCAL=1` 模式是默认测试路径，不依赖宜搭网络。
- 测试文件在 `test/` 下，运行 `pnpm test` 触发全链路 E2E。

## 目录速查

| 路径 | 职责 |
|------|------|
| `src/index.ts` | 入口：解析 `yida::` URL，创建 storage，调用 protocol |
| `src/protocol.ts` | git remote helper 协议：`\n\n` 分块、push/fetch 流程 |
| `src/storage.ts` | 存储抽象：`StorageBackend` 接口 + `FileStorage` + `YidaStorage` |
| `src/crypto.ts` | SHA-1、git object 编解码工具 |
| `src/types.ts` | `GitObject` / `GitRef` 类型定义 |
| `test/final.ts` | E2E：git → yida → git 全链路 SHA 一致性验证 |
| `docs/ARCHITECTURE.md` | 系统架构与模块关系 |
| `docs/PRD.md` | 产品目标与功能定义 |
| `docs/DECISIONS.md` | 架构决策记录 |