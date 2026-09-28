# gida — 宜搭部署指南

将 gida 部署到你自己的宜搭应用。完成后你将拥有 git-remote-yida 的后端表单 + 仓库浏览器 WebUI。

## 部署步骤

### Step 1：登录

```bash
openyida login
```

### Step 2：创建宜搭应用

```bash
openyida create-app "gida"
```

记下返回的 `appType`（如 `APP_Z1IR327SHW7JQRQOU5GW`）。

### Step 3：创建表单

```bash
cd gida
openyida create-form batch <appType> yida/forms.json --json
```

将输出中的 `formUuid` 和 `fieldId` 填入 `yida/schema.template.json`，另存为 `.cache/gida-schema.json`。

### Step 4：创建自定义页面

```bash
openyida create-page <appType> "仓库浏览器" --json
```

记录返回的 `pageId`，填入 `.cache/gida-schema.json`。

### Step 5：修改 WebUI 中的常量

打开 `yida/pages/src/repo-browser.oyd.jsx`，修改文件顶部的三个常量块：

```js
var APP_TYPE = '<YOUR_APP_TYPE>';
var FORMS = {
  objects: '<YOUR_GIT_OBJECTS_FORM_UUID>',
  refs: '<YOUR_GIT_REFS_FORM_UUID>',
};
var F = {
  obj_sha: '<FIELD_ID>',
  obj_type: '<FIELD_ID>',
  obj_content: '<FIELD_ID>',
  ref_path: '<FIELD_ID>',
  ref_sha: '<FIELD_ID>',
};
```

这些值都是从 `.cache/gida-schema.json` 中对应复制。

### Step 6：发布 WebUI

```bash
openyida publish yida/pages/src/repo-browser.oyd.jsx <appType> <pageId> --json
```

### Step 7：安装 git-remote-yida

```bash
pnpm install && pnpm build
```

### Step 8：使用

```bash
git remote add yida yida::<appType>/<objectsFormUuid>/<refsFormUuid>
git push yida main
```

推送后数据会实时显示在 WebUI 中（通过宜搭工作台进入"仓库浏览器"页面）。

## 表单结构

> 以下表单已由 `yida/forms.json` 定义，`create-form batch` 会自动创建。

### git_objects

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| object_sha | TextField | 是 | 40 位 SHA-1 哈希值 |
| object_type | SelectField | 是 | blob / tree / commit / tag |
| content | TextareaField | 是 | base64 编码的 git object 内容 |

### git_refs

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| ref_path | TextField | 是 | refs/heads/main 等 |
| target_sha | TextField | 是 | 目标 commit 的 40 位 SHA-1 |

## 自定义 WebUI 常量

发布到自己的宜搭实例时，需要修改 `repo-browser.oyd.jsx` 中以下变量（文件顶部第 7-18 行）：

- `APP_TYPE` → 你的应用 appType
- `FORMS.objects` → git_objects 表单的 formUuid
- `FORMS.refs` → git_refs 表单的 formUuid
- `F.*` → 各字段的 fieldId

所有值来自 `.cache/gida-schema.json`。

## 文件说明

| 文件 | 用途 |
|------|------|
| `yida/forms.json` | 表单批量创建配置 |
| `yida/git_objects-fields.json` | git_objects 字段定义 |
| `yida/git_refs-fields.json` | git_refs 字段定义 |
| `yida/schema.template.json` | schema 模板（填入你的 ID 后放到 `.cache/gida-schema.json`） |
| `yida/pages/src/repo-browser.oyd.jsx` | 仓库浏览器 WebUI 源码 |