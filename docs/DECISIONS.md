# DECISIONS

## ADR-001：使用 git remote helper 而非独立 proxy 服务

- **日期**：2026-09-28
- **状态**：已采纳
- **背景**：需要让 git 客户端把宜搭视为一个合法的远端。两条路：A) 写独立 HTTP proxy 服务暴露标准 git smart HTTP 协议，背后连宜搭；B) 写 git remote helper，借助 git 的 `remote.<name>.vcs` 机制直接对接 stdin/stdout。
- **考虑过的方案**：
  - A) Proxy 服务（Node.js/Go HTTP server）。优点：对用户完全透明，`git clone https://...` 即可。缺点：需要部署和维护额外服务。
  - B) git remote helper。优点：零服务端部署，利用 git 自身的 fast-import/export 处理对象格式。缺点：需要用户在 PATH 中安装 helper 可执行文件。
- **决策**：选 B（git remote helper）。
- **为什么选这个**：宜搭本身是 serverless 数据层，加中间 proxy 违背"低代码平台做 git 存"的核心理念。remote helper 是 git 为此类场景设计的标准扩展点，且 fast-import/export 委托 git 自身处理避免了手工重构对象的复杂性。
- **为什么不选其他**：proxy 方案需要运维服务，增加攻击面和部署成本，且违背"利用宜搭已有能力"的设计初衷。
- **后果**：用户需要安装 npm 包或下载二进制文件；但分发成本极低（`npm i -g git-remote-yida`）。
- **何时重新审视**：如果出现大量用户反馈安装门槛过高，可考虑提供 proxy 模式作为可选方案。

## ADR-002：双存储后端（StorageBackend 接口 + FileStorage / YidaStorage）

- **日期**：2026-09-28
- **状态**：已采纳
- **背景**：开发阶段不宜直接连宜搭 API（网络依赖、认证复杂、调试困难），需要本地可测方案。
- **考虑过的方案**：
  - A) 直接在 protocol 层写死文件存储，后续再重构。
  - B) 定义抽象接口，两套实现并行维护。
- **决策**：选 B（StorageBackend 接口）。
- **为什么选这个**：接口定义成本低（7 个方法），且 protocol 层只依赖接口不依赖实现。修复 protocol bug 时无需关心后端是文件还是 API。E2E 测试用 FileStorage 验证逻辑正确性，上生产只需换一行构造函数。
- **后果**：FileStorage 的 `putObject` 做了过多 SHA 校验逻辑（hashBlob → hashObject 回退），与实际 YidaStorage 的简洁实现不一致。未来应统一。
- **何时重新审视**：当添加第三种后端（如飞书多维表格、Redis）时验证接口抽象是否足够通用。

## ADR-003：对象构造委托 git 而非手工实现

- **日期**：2026-09-28
- **状态**：已采纳
- **背景**：push 时收到 fast-import 流，需解析 commit/tree/fileOps 并重建 git objects。手工实现极易引入 SHA 不匹配。
- **考虑过的方案**：
  - A) 手工解析 fast-import 流，自行构造 tree/commit objects。
  - B) 将 fast-import 流原样 pipe 给 `git fast-import`，让 git 处理所有对象构造。
- **决策**：选 B（委托 git）。
- **为什么选这个**：git 自身的 fast-import 已经正确实现了所有边缘情况（blob mark 引用、tree mode 解析、merge 处理）。手工实现需要维护一套与 git 保持一致的 object builder，ROI 极低。
- **后果**：helper 依赖系统安装的 git（>= 1.7）。这在实际场景中不是问题 —— 使用 git remote helper 的用户必然已安装 git。
- **何时重新审视**：如果未来需要支持不依赖本地 git 的纯 Node.js 环境。

## ADR-004：宜搭表单字段对 git object 的映射方案

- **日期**：2026-09-28
- **状态**：待验证（YidaStorage 代码已完成，但未连接真实宜搭实例测试）
- **背景**：git object 需要字段承载 SHA（40 字符 hex string）、类型（枚举）、内容（任意二进制数据）。
- **决策**：
  - `git_objects` 表：`object_sha`（单行文本）、`object_type`（下拉单选：blob/tree/commit/tag）、`content`（多行文本，base64 编码）。
  - `git_refs` 表：`ref_path`（单行文本）、`target_sha`（单行文本）。
- **后果**：
  - base64 编码可使二进制 content 安全存入文本字段，但会膨胀约 33%。
  - 大文件（>1MB blob）在宜搭 TextareaField 中可能受限——需要后续 ADR 处理分块存储。
  - `searchFormDatas` 在 200 条/页限制下，对于大仓库（数千个 object）需要分页拉取，当前 `pageSize=200` 可能不足。
- **何时重新审视**：首次连接真实宜搭实例进行性能测试时。