# ARCHITECTURE — git-remote-yida

## 系统概述

```
┌──────────┐  stdin (commands)   ┌───────────────────┐  REST API    ┌──────────────┐
│   git    │ ◄──────────────────► │  git-remote-yida  │ ◄──────────► │ 宜搭 (Yida)   │
│ (client) │  stdout (responses) │  (Node.js helper) │             │ 表单存储      │
└──────────┘                     └───────────────────┘             └──────────────┘
                                         │
                                         │ StorageBackend (interface)
                                         ├── FileStorage  (.git/yida-objects/ + .git/yida-refs.json)
                                         └── YidaStorage  (saveFormData / searchFormDatas / updateFormData)
```

git 调用 `git-remote-yida` 作为 remote helper。helper 通过 stdin/stdout 与 git 交换协议命令。数据层通过 `StorageBackend` 接口抽象，支持本地文件（开发/测试）和宜搭 API（生产）两种后端。

## 核心模块

| 模块 | 职责 |
|------|------|
| `index.ts` | 入口。解析 `yida::APP/FORM_OBJ/FORM_REF` URL，根据 `YIDA_LOCAL` 环境变量选择 FileStorage 或 YidaStorage，启动协议循环。 |
| `protocol.ts` | git remote helper 协议实现。`splitBlocks()` 按 `\n\n` 分块解析命令（capabilities → list → push/fetch）。`doPush()` 将 fast-import 流导入 temp bare repo 后提取 objects/refs 存入 storage。`doFetch()` 反向操作：从 storage 取 objects、写入 temp bare repo、执行 fast-export 输出。 |
| `storage.ts` | `StorageBackend` 接口定义 7 个方法（putObject/getObject/hasObject/listRefs/getRef/setRef/deleteRef）。`FileStorage` 用文件系统模拟 —— objects 存在 `yida-objects/XX/XXXX...`，refs 存在 JSON 文件。`YidaStorage` 通过 fetch 调用宜搭 REST API。 |
| `crypto.ts` | 纯函数：`hashBlob` / `hashObject`（SHA-1）、`buildObject` / `parseObject`（git object 编解码）、`verifyHash`。 |
| `types.ts` | `GitObject`（sha + type + content）和 `GitRef`（path + sha）。 |

## 模块关系

```
index.ts
  ├── storage.ts  (creates FileStorage | YidaStorage)
  └── protocol.ts (runProtocol)
        ├── types.ts     (GitObject, GitRef)
        ├── crypto.ts    (hashObject — for commit SHA computation in push)
        └── storage.ts   (StorageBackend — putObject/getObject/...)
```

`protocol.ts` 是核心枢纽：它不直接读写文件/网络，只通过 `StorageBackend` 接口操作数据。新增存储后端只需实现接口即可在 protocol 层透明接入。

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

## 外部系统

- **git (>= 1.7)**：提供 `fast-import`、`fast-export`、`cat-file --batch`、`show-ref`、`update-ref` 等子命令。helper 不手工构造 tree/commit 对象，全部委托给 git 自身。
- **宜搭 REST API**：`saveFormData`、`searchFormDatas`、`updateFormData`、`deleteFormData`。认证依赖 cookie（浏览器环境）或 openyida CLI token。

## 重要技术边界

1. **`\n\n` 协议分块**：git remote helper 协议中每个命令交换以 `\n\n` 终止。`push` 命令后的 fast-import 数据是二进制流，不能按行解析 —— `splitBlocks()` 在检测到 `push ` 命令后直接跳过后续文本分割，将剩余 stdin 全部视为 fast-import 数据。
2. **对象去重委托 git**：push 时 helper 不验重 —— `git fast-import` 自动去重，helper 只从 temp repo 读取最终存储的 objects。fetch 时 `collectAll()` 递归遍历 commit→tree→blob 依赖图，`Set<string>` 确保不重复拉取。
3. **GPG/CRLF SHA 污染**：helper 本身不改变对象内容。若源仓库开启了 GPG 签名或 CRLF 转换，commit SHA 与无签名/无转换的克隆结果会不同 —— 这是 git 的正常行为，不是 helper 的缺陷。helper 的 E2E 测试通过禁用 GPG 和 autocrlf 来验证纯数据层面的 SHA 一致性。