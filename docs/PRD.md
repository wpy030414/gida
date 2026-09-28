# PRD — gida

## 产品目标

使宜搭（Yida）低代码平台能够扮演 Git 远端存储的角色 —— 开发者可以用标准 `git push` / `git clone` 等命令，以宜搭表单为存储后端，实现代码版本管理；同时提供宜搭内置的 WebUI 进行仓库浏览。

## 用户与使用场景

- **目标用户**：宜搭生态内的开发者、需要在钉钉/宜搭环境内保留代码版本的低代码项目团队。
- **典型场景**：
  1. 团队在宜搭中构建自定义页面时，希望同一个应用内管理源码版本，不引入独立 Git 服务器。
  2. 个人开发者在宜搭环境中探索性开发，需要轻量版本记录但不便配置标准 Git 服务。
  3. 通过 WebUI 在宜搭内浏览仓库历史、查看文件内容，无需离开宜搭工作台。

## 核心问题

1. **Git 的对象模型（blob/tree/commit/tag + refs）能否映射到宜搭表单的字段模型？**
2. **宜搭 API（saveFormData / searchFormDatas）能否支撑 git 的 push/pull 语义？**
3. **如何使 git 客户端把宜搭视为一个合法的远端，而无需改造 git 自身？**
4. **如何在宜搭内提供可视化的仓库浏览体验？**

## 功能及其意义

| 功能 | 解决什么 | 为什么需要 |
|------|----------|------------|
| `git push` 到宜搭 | 将本地 commit 历史整体存入宜搭表单 | 最基础的版本保存需求 |
| `git fetch` / `git clone` 从宜搭 | 从宜搭取回完整的 commit 历史与文件 | 代码共享与恢复 |
| 双存储后端（File/Yida） | 本地调试与生产环境无缝切换 | 开发体验与可测试性 |
| fast-import/export 委托 git | 对象格式转换交还 git 自身处理 | 避免手工重构 tree/commit 引入 SHA 不一致 |
| `yida::` URL 协议 | git 标准 remote 语法识别宜搭端点 | 无需改造 git 客户端 |
| 仓库浏览器 WebUI | 在宜搭内浏览分支、提交历史、文件内容 | 无需 CLI 即可查看仓库状态 |
| git_objects / git_refs 表单 | 宜搭原生表单作为 git 对象存储层 | 零服务端部署，利用宜搭已有能力 |

## 功能之间的关系

- Push 和 Fetch 是对称操作：push 写入的 1:1 内容必须能通过 fetch 完整取回。
- FileStorage 是 YidaStorage 的 **本地等价替代** —— 任何对 FileStorage 通过的测试，换成 YidaStorage 只需验证网络+认证层。
- 协议解析（splitBlocks）是 push/fetch 的入口，必须先正确处理 `\n\n` 分块。
- WebUI 通过 `searchFormDatas` API 直接读取 git_objects / git_refs 表单，与 CLI 共享同一数据源。
- WebUI 和 CLI 是独立的两端，分别从宜搭 API 和 git stdin/stdout 接入，数据完全互通。

## 范围与非目标

- **范围内**：单个 branch 的 push/fetch，blob/tree/commit 对象完整存储，E2E 测试覆盖全链路，WebUI 仓库浏览器（分支列表、提交历史、文件树、文件内容查看）。
- **范围外**：多 branch 并发 push、packfile 增量传输、shallow clone、SSH 认证、WebUI 中的在线编辑。