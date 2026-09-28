# ARCHITECTURE — gida

## 系统概述

```
┌──────────┐  stdin (commands)   ┌───────────────────┐  REST API    ┌──────────────┐
│   git    │ ◄──────────────────►│  git-remote-yida  │ ◄──────────►│ 宜搭 (Yida)   │
│ (client) │  stdout (responses) │  (Node.js helper) │            │ 表单存储      │
└──────────┘                     └───────────────────┘             └──────────────┘
                                         │                                 ▲
                                         │ StorageBackend (interface)      │
                                         ├── FileStorage                   │
                                         └── YidaStorage ─────────────────┘
                                                                    │
  ┌────────────────┐                                               │
  │ Yida Browser   │  oyd.jsx                                      │
  │ (宜搭工作台)    │ ───► gida WebUI ── fetch ────────────────────┘
  └────────────────┘       (repo-browser.oyd.jsx)
```

git 调用 `git-remote-yida` 作为 remote helper。helper 通过 stdin/stdout 与 git 交换协议命令。数据层通过 `StorageBackend` 接口抽象，支持本地文件（开发/测试）和宜搭 API（生产）两种后端。

gida WebUI 是独立的宜搭自定义页面，在浏览器中通过 `fetch()` 直接调用宜搭 REST API 读取 git_objects 和 git_refs 表单，提供可视化的仓库浏览。

## 核心模块

| 模块 | 职责 |
|------|------|
| `index.ts` | 入口。解析 `yida::APP/FORM_OBJ/FORM_REF` URL，根据 `YIDA_LOCAL` 环境变量选择 FileStorage 或 YidaStorage，启动协议循环。 |
| `protocol.ts` | git remote helper 协议实现。`splitBlocks()` 按 `\n\n` 分块解析命令（capabilities → list → push/fetch）。`doPush()` 将 fast-import 流导入 temp bare repo 后提取 objects/refs 存入 storage。`doFetch()` 反向操作：从 storage 取 objects、写入 temp bare repo、执行 fast-export 输出。 |
| `storage.ts` | `StorageBackend` 接口定义 7 个方法（putObject/getObject/hasObject/listRefs/getRef/setRef/deleteRef）。`FileStorage` 用文件系统模拟。`YidaStorage` 通过 fetch 调用宜搭 REST API。 |
| `crypto.ts` | 纯函数：`hashBlob` / `hashObject`（SHA-1）、`buildObject` / `parseObject`（git object 编解码）、`verifyHash`。 |
| `types.ts` | `GitObject`（sha + type + content）和 `GitRef`（path + sha）。 |
| `repo-browser.oyd.jsx` | 宜搭自定义页面：仓库浏览器。直接通过 `fetch()` + `URLSearchParams` 查询 git_objects / git_refs 表单，提供分支列表、提交历史浏览、文件树导航、文件内容查看。 |

## 模块关系

```
index.ts
  ├── storage.ts  (creates FileStorage | YidaStorage)
  └── protocol.ts (runProtocol)
        ├── types.ts     (GitObject, GitRef)
        ├── crypto.ts    (hashObject — for commit SHA computation in push)
        └── storage.ts   (StorageBackend — putObject/getObject/...)

repo-browser.oyd.jsx (independent, runs in Yida browser runtime)
  ├── fetch() → 宜搭 REST API (searchFormDatas on git_objects + git_refs)
  ├── parseCommitInfo() / parseTreeEntries() — git object parsers in pure JS
  └── render*() — UI components (Overview / Branches / History / Files tabs)
```

`protocol.ts` 是 CLI 的核心枢纽：它不直接读写文件/网络，只通过 `StorageBackend` 接口操作数据。WebUI 是独立的浏览器端应用，通过相同的宜搭 API 读取同一份数据。

## 数据流

### Push 流程

```
git fast-export --all
  │
  ▼
stdin ──► splitBlocks() ──► doPush()
                              │
                              ├── git fast-import --quiet (temp bare repo)
                              ├── git cat-file --batch (extract objects)
                              ├── storage.putObject()  × N
                              ├── git show-ref          (extract refs)
                              ├── storage.setRef()     × N
                              └── stdout: "ok refs/heads/master"
```

### Fetch 流程

```
stdin ──► splitBlocks() ──► doFetch()
                              │
                              ├── storage.getObject() × N (recursive via collectAll)
                              ├── write zlib-compressed objects to temp bare repo
                              ├── storage.listRefs() → git update-ref
                              └── git fast-export --all → stdout
```

### WebUI 数据流

```
didMount → searchFormDatas(git_refs) → render refs list
  ↓ user clicks ref
loadHistory(refSha) → walkChain():
  searchFormDatas(git_objects, object_sha=sha)
  → parseCommitInfo(base64ToText(content))
  → follow parent SHA → recurse
  ↓ user clicks "Browse Files"
loadTree(treeSha):
  searchFormDatas(git_objects, object_sha=treeSha)
  → base64ToBytes(content)
  → parseTreeEntries(bytes) → render file/dir list
  ↓ user clicks file
loadBlob(blobSha):
  searchFormDatas(git_objects, object_sha=blobSha)
  → base64ToText(content) → render in dialog
```

## 外部系统

- **git (>= 1.7)**：提供 `fast-import`、`fast-export`、`cat-file --batch`、`show-ref`、`update-ref` 等子命令。helper 不手工构造 tree/commit 对象，全部委托给 git 自身。
- **宜搭 REST API**：`saveFormData`、`searchFormDatas`、`updateFormData`、`deleteFormData`。CLI 和 WebUI 均直接调用。认证依赖 cookie（浏览器环境）或 openyida CLI token。

## 重要技术边界

1. **`\n\n` 协议分块**：git remote helper 协议中每个命令交换以 `\n\n` 终止。`push` 命令后的 fast-import 数据是二进制流，不能按行解析 —— `splitBlocks()` 在检测到 `push ` 命令后直接跳过后续文本分割，将剩余 stdin 全部视为 fast-import 数据。
2. **对象去重委托 git**：push 时 helper 不验重 —— `git fast-import` 自动去重，helper 只从 temp repo 读取最终存储的 objects。
3. **GPG/CRLF SHA 污染**：helper 本身不改变对象内容。E2E 测试通过禁用 GPG 和 autocrlf 来验证纯数据层面的 SHA 一致性。
4. **oyd.jsx ES5 约束**：宜搭自定义页面只支持 ES5 语法（`var`/`function`/ES5 对象字面量），禁止 `const`/`let`/`import`/`require`/ES6 computed property names。
5. **WebUI 事件绑定**：oyd.jsx 的 lint 禁止 JSX 属性中使用 IIFE 或函数调用。事件处理器必须是函数表达式或箭头函数，通过 `data-*` 或闭包传参。