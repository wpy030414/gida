# git-remote-yida

使用**宜搭（Yida）低代码平台**作为 Git 远端存储后端的 Git Remote Helper。

```
git push yida::APP_XXX/FORM_OBJECTS/FORM_REFS main
git clone yida::APP_XXX/FORM_OBJECTS/FORM_REFS my-repo
```

## 这是什么？

- **定位**：一个 git remote helper（`git-remote-yida`），让 git 通过标准 `push`/`pull`/`clone` 命令读写宜搭表单中的数据，就像读写 GitHub 一样。
- **解决的核心问题**：宜搭生态内的开发者可以在同一个低代码应用内管理源码版本，无需引入独立 Git 服务器。

## 为什么存在？

宜搭自定义页面开发中，源码（oyd.jsx）通常以复制粘贴方式管理，缺少版本追溯。本项目通过 git 标准的 remote helper 机制，将宜搭的两张表单（git_objects + git_refs）映射为 git 的对象存储层，使开发者能用熟悉的 git 工作流管理宜搭代码。

## 如何安装和运行？

- **前置要求**：Node.js >= 18、pnpm、git >= 1.7
- **安装步骤**：

```bash
git clone <this-repo>
cd git-remote-yida
pnpm install && pnpm build
```

- **本地测试**：

```bash
export YIDA_LOCAL=1
export YIDA_GIT_DIR=/path/to/remote/storage

git remote add yida yida::file/test/test
git push yida main
git clone yida::file/test/test my-clone
```

- **宜搭生产模式**：

```bash
# 在宜搭中创建两张表单（git_objects + git_refs）后：
git remote add yida yida::APP_XXX/FORM_OBJ_UUID/FORM_REF_UUID
git push yida main
```

## 当前状态

- **阶段**：原型验证完成（E2E 全链路 SHA 一致）
- **已知限制**：
  - 宜搭 API 单次查询上限 200 条，大仓库需分页
  - 大文件（>1MB）受宜搭 TextareaField 容量限制
  - 不支持并发 push（宜搭无原生 CAS）
  - 宜搭认证需 cookie / openyida CLI token

## 核心技术

- **语言**：TypeScript（编译到 ES2022 / ESM）
- **关键机制**：git remote helper 协议（stdin/stdout）、git fast-import / fast-export
- **数据层**：`StorageBackend` 接口 → `FileStorage`（本地文件）+ `YidaStorage`（宜搭 REST API）
- **测试**：`test/final.ts` 覆盖 git → yida → git 全链路 SHA 一致性

详见 [`docs/`](docs/) 目录下的架构、PRD 和决策记录。