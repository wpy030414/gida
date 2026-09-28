# gida — Git on Yida

使用**宜搭（Yida）低代码平台**作为 Git 远端存储后端的完整方案。

```
git push yida::APP_XXX/FORM_OBJECTS/FORM_REFS main
git clone yida::APP_XXX/FORM_OBJECTS/FORM_REFS my-repo
```

## 这是什么？

**gida**（git + yida）包含两个组件：

- **git-remote-yida** — 一个 git remote helper CLI，让 git 通过标准 `push`/`pull`/`clone` 命令读写宜搭表单中的数据。
- **gida WebUI** — 宜搭自定义页面，在宜搭应用内提供仓库浏览（分支列表、提交历史、文件树、文件内容查看）。

## 为什么存在？

宜搭自定义页面开发中，源码（oyd.jsx）通常以复制粘贴方式管理，缺少版本追溯。gida 通过 git 标准的 remote helper 机制，将宜搭的两张表单（git_objects + git_refs）映射为 git 的对象存储层，并用 WebUI 提供可视化浏览能力。

## 如何安装和运行？

### 1. 安装 git-remote-yida

**前置要求**：Node.js >= 18、pnpm、git >= 1.7

```bash
git clone <this-repo>
cd gida
pnpm install && pnpm build
```

### 2. 本地测试（FileStorage 模式，无需宜搭）

```bash
export YIDA_LOCAL=1
export YIDA_GIT_DIR=/path/to/remote/storage

git remote add yida yida::file/test/test
git push yida main
git clone yida::file/test/test my-clone
```

### 3. 宜搭生产模式

```bash
# 在宜搭中创建两张表单（git_objects + git_refs）后：
git remote add yida yida::APP_XXX/FORM_OBJ_UUID/FORM_REF_UUID
git push yida main
```

### 4. 部署 WebUI

详见 [`yida/README.md`](yida/README.md) — 包含表单创建、页面发布、在宜搭中访问的完整步骤。

## 当前状态

- **阶段**：原型验证完成（CLI E2E 全链路 SHA 一致），WebUI v1 已发布
- **已知限制**：
  - 宜搭 API 单次查询上限 200 条，大仓库需分页
  - 大文件（>1MB）受宜搭 TextareaField 容量限制
  - 不支持并发 push（宜搭无原生 CAS）
  - 宜搭认证需 cookie / openyida CLI token

## 核心技术

- **语言**：TypeScript（CLI 编译到 ES2022 / ESM）、oyd.jsx（WebUI）
- **关键机制**：git remote helper 协议（stdin/stdout）、git fast-import / fast-export
- **数据层**：`StorageBackend` 接口 → `FileStorage`（本地文件）+ `YidaStorage`（宜搭 REST API）
- **WebUI**：宜搭自定义页面（oyd.jsx），通过 `fetch` + `URLSearchParams` 直接查询 git_objects / git_refs 表单
- **测试**：`test/final.ts` 覆盖 git → yida → git 全链路 SHA 一致性

## 项目结构

| 路径 | 职责 |
|------|------|
| `src/` | git-remote-yida CLI（TypeScript） |
| `test/` | E2E 测试 |
| `yida/` | 宜搭应用层：表单定义 + WebUI 源码 |
| `yida/pages/src/repo-browser.oyd.jsx` | 仓库浏览器 WebUI |
| `yida/forms.json` | git_objects / git_refs 表单定义 |
| `.cache/gida-schema.json` | appType / formUuid / fieldId 映射 |

详见 [`docs/`](docs/) 目录下的架构、PRD 和决策记录。