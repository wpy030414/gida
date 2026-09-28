// ═══════════════════════════════════════════════════════════════════════════
// gida — Repository Browser (仓库浏览器)
// Yida custom page (oyd.jsx) for browsing git repositories stored in forms
//
// 🔧 DEPLOYMENT: replace the placeholders below with your own IDs.
//    Copy from .cache/gida-schema.json after running create-form batch.
// ═══════════════════════════════════════════════════════════════════════════

var APP_TYPE = '<YOUR_APP_TYPE>';
var FORMS = {
  objects: '<YOUR_GIT_OBJECTS_FORM_UUID>',
  refs: '<YOUR_GIT_REFS_FORM_UUID>',
};
var F = {
  obj_sha: '<YOUR_OBJECT_SHA_FIELD_ID>',
  obj_type: '<YOUR_OBJECT_TYPE_FIELD_ID>',
  obj_content: '<YOUR_CONTENT_FIELD_ID>',
  ref_repo: '<YOUR_REPO_NAME_FIELD_ID>',
  ref_path: '<YOUR_REF_PATH_FIELD_ID>',
  ref_sha: '<YOUR_TARGET_SHA_FIELD_ID>',
};

var _customState = {
  route: 'overview',
  currentRepo: 'default',
  repoList: [],
  refs: [],
  selectedBranch: null,
  commitList: [],
  selectedCommit: null,
  treeEntries: [],
  breadcrumbs: [],
  fileContent: null,
  loading: false,
  error: null,
  toasts: [],
  totalObjects: 0,
  forceRender: Date.now(),
};

// ─── CSS ────────────────────────────────────────────────────────────────────
export function didMount() {
  var self = this;
  var style = document.createElement('style');
  style.textContent = [
    ':root {',
    '  --oy-background: 0 0% 100%;',
    '  --oy-foreground: 0 0% 3.9%;',
    '  --oy-muted: 0 0% 96.1%;',
    '  --oy-muted-foreground: 0 0% 45.1%;',
    '  --oy-card: 0 0% 100%;',
    '  --oy-border: 0 0% 89.8%;',
    '  --oy-primary: 217 91% 60%;',
    '  --oy-accent: 0 0% 96.1%;',
    '  --oy-radius: 0.5rem;',
    '}',
    '.oyd-page { min-height:100vh; background:hsl(var(--oy-background)); color:hsl(var(--oy-foreground)); font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; font-size:14px; line-height:1.5; }',
    '.oyd-page * { box-sizing:border-box; margin:0; padding:0; }',
    '.gida-container { max-width:960px; margin:0 auto; padding:24px 16px 48px; }',
    '.gida-header { display:flex; justify-content:space-between; align-items:center; padding-bottom:16px; border-bottom:1px solid hsl(var(--oy-border)); margin-bottom:16px; }',
    '.gida-header h1 { font-size:20px; font-weight:700; }',
    '.gida-subtitle { font-size:13px; color:hsl(var(--oy-muted-foreground)); }',
    '.gida-nav { display:flex; gap:4px; margin-bottom:20px; border-bottom:1px solid hsl(var(--oy-border)); padding-bottom:0; }',
    '.gida-nav-btn { padding:8px 16px; border:none; background:none; font-size:14px; color:hsl(var(--oy-muted-foreground)); cursor:pointer; border-bottom:2px solid transparent; margin-bottom:-1px; }',
    '.gida-nav-btn:hover { color:hsl(var(--oy-foreground)); }',
    '.gida-nav-btn.active { color:hsl(var(--oy-primary)); border-bottom-color:hsl(var(--oy-primary)); font-weight:600; }',
    '.gida-card { background:hsl(var(--oy-card)); border:1px solid hsl(var(--oy-border)); border-radius:var(--oy-radius); padding:16px; margin-bottom:8px; }',
    '.gida-card:hover { border-color:hsl(var(--oy-primary) / 0.3); }',
    '.gida-card-title { font-weight:600; font-size:15px; word-break:break-all; }',
    '.gida-card-meta { font-size:12px; color:hsl(var(--oy-muted-foreground)); margin-top:4px; }',
    '.gida-badge { display:inline-block; padding:2px 8px; border-radius:9999px; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.05em; }',
    '.gida-badge-branch { background:hsl(142 76% 90%); color:hsl(142 72% 29%); }',
    '.gida-badge-tag { background:hsl(48 96% 89%); color:hsl(48 96% 40%); }',
    '.gida-badge-blob { background:hsl(var(--oy-muted)); color:hsl(var(--oy-muted-foreground)); }',
    '.gida-badge-tree { background:hsl(217 91% 90%); color:hsl(217 91% 50%); }',
    '.gida-sha { font-family:"SF Mono","Cascadia Code",monospace; font-size:12px; color:hsl(var(--oy-muted-foreground)); }',
    '.gida-sha-sm { font-family:"SF Mono","Cascadia Code",monospace; font-size:11px; color:hsl(var(--oy-muted-foreground)); }',
    '.gida-mono { font-family:"SF Mono","Cascadia Code",monospace; }',
    '.gida-stat-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:12px; margin-bottom:20px; }',
    '.gida-stat { background:hsl(var(--oy-card)); border:1px solid hsl(var(--oy-border)); border-radius:var(--oy-radius); padding:16px; text-align:center; }',
    '.gida-stat-value { font-size:28px; font-weight:700; color:hsl(var(--oy-primary)); }',
    '.gida-stat-label { font-size:12px; color:hsl(var(--oy-muted-foreground)); margin-top:4px; }',
    '.gida-btn { padding:8px 16px; border:1px solid hsl(var(--oy-border)); border-radius:var(--oy-radius); background:hsl(var(--oy-background)); color:hsl(var(--oy-foreground)); font-size:13px; cursor:pointer; }',
    '.gida-btn:hover { background:hsl(var(--oy-accent)); }',
    '.gida-btn-primary { background:hsl(var(--oy-primary)); color:#fff; border-color:hsl(var(--oy-primary)); }',
    '.gida-btn-primary:hover { opacity:0.9; }',
    '.gida-btn-sm { padding:4px 10px; font-size:12px; }',
    '.gida-empty { text-align:center; padding:48px 16px; color:hsl(var(--oy-muted-foreground)); }',
    '.gida-loading { text-align:center; padding:48px 16px; color:hsl(var(--oy-muted-foreground)); }',
    '.gida-error { background:hsl(0 84% 95%); border:1px solid hsl(0 84% 80%); border-radius:var(--oy-radius); padding:12px 16px; color:hsl(0 84% 60%); font-size:13px; margin-bottom:12px; }',
    '.gida-row { display:flex; align-items:center; gap:8px; padding:10px 12px; border-bottom:1px solid hsl(var(--oy-border) / 0.5); cursor:pointer; }',
    '.gida-row:hover { background:hsl(var(--oy-accent)); }',
    '.gida-row-icon { width:20px; text-align:center; flex-shrink:0; font-size:14px; }',
    '.gida-row-name { flex:1; word-break:break-all; font-size:13px; }',
    '.gida-row-meta { font-size:11px; color:hsl(var(--oy-muted-foreground)); flex-shrink:0; }',
    '.gida-tree-header { font-size:11px; color:hsl(var(--oy-muted-foreground)); padding:4px 12px; display:flex; gap:8px; border-bottom:1px solid hsl(var(--oy-border)); }',
    '.gida-breadcrumbs { display:flex; align-items:center; gap:4px; flex-wrap:wrap; padding:8px 0; margin-bottom:12px; font-size:13px; }',
    '.gida-breadcrumb { color:hsl(var(--oy-primary)); cursor:pointer; }',
    '.gida-breadcrumb:hover { text-decoration:underline; }',
    '.gida-breadcrumb-sep { color:hsl(var(--oy-muted-foreground)); }',
    '.gida-breadcrumb-last { color:hsl(var(--oy-foreground)); font-weight:600; }',
    '.gida-dialog-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.4); display:flex; align-items:center; justify-content:center; z-index:1000; }',
    '.gida-dialog { background:hsl(var(--oy-card)); border-radius:var(--oy-radius); max-width:720px; width:90vw; max-height:80vh; overflow-y:auto; box-shadow:0 25px 50px -12px rgba(0,0,0,0.25); }',
    '.gida-dialog-header { display:flex; justify-content:space-between; align-items:center; padding:16px; border-bottom:1px solid hsl(var(--oy-border)); }',
    '.gida-dialog-body { padding:16px; }',
    '.gida-toast-container { position:fixed; bottom:16px; right:16px; z-index:2000; display:flex; flex-direction:column; gap:8px; }',
    '.gida-toast { padding:10px 16px; border-radius:var(--oy-radius); font-size:13px; box-shadow:0 4px 12px rgba(0,0,0,0.15); }',
    '.gida-toast-info { background:hsl(var(--oy-primary)); color:#fff; }',
    '.gida-toast-error { background:hsl(0 84% 60%); color:#fff; }',
    '.gida-commit-detail { padding:12px; background:hsl(var(--oy-muted)); border-radius:var(--oy-radius); margin-top:8px; }',
    '.gida-commit-detail p { margin-bottom:4px; font-size:13px; }',
    '.gida-code-block { background:hsl(var(--oy-muted)); border-radius:var(--oy-radius); padding:16px; font-family:"SF Mono","Cascadia Code",monospace; font-size:13px; line-height:1.6; overflow-x:auto; white-space:pre-wrap; word-break:break-all; max-height:480px; overflow-y:auto; }',
    '.gida-repo-select { padding:6px 12px; border:1px solid hsl(var(--oy-border)); border-radius:var(--oy-radius); background:hsl(var(--oy-background)); color:hsl(var(--oy-foreground)); font-size:13px; cursor:pointer; min-width:160px; }',
    '.gida-repo-select:focus { outline:none; border-color:hsl(var(--oy-primary)); }',
    '.gida-header-left { display:flex; align-items:center; gap:12px; }',
  ].join('\n');
  document.head.appendChild(style);
  self.loadRepos();
}

// ─── State helpers ──────────────────────────────────────────────────────────
function sset(self, patch) {
  var s = self.getCustomState() || _customState;
  var k; for (k in patch) { if (patch.hasOwnProperty(k)) { s[k] = patch[k]; } }
  self.setCustomState(s);
  self.forceUpdate();
}

function sget(self) { return self.getCustomState() || _customState; }

// ─── API ────────────────────────────────────────────────────────────────────
function apiFetch(self, path, body) {
  return fetch('/dingtalk/web/' + APP_TYPE + '/v1/form/' + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  }).then(function(r) { return r.json(); });
}

function searchObjects(self, sha) {
  var sf = {};
  if (sha) { sf[F.obj_sha] = sha; }
  return apiFetch(self, 'searchFormDatas.json',
    new URLSearchParams({ formUuid: FORMS.objects, searchFieldJson: JSON.stringify(sf), currentPage: '1', pageSize: '50' }));
}

function searchRefs(self) {
  var sf = {};
  var repo = sget(self).currentRepo || 'default';
  sf[F.ref_repo] = repo;
  return apiFetch(self, 'searchFormDatas.json',
    new URLSearchParams({ formUuid: FORMS.refs, searchFieldJson: JSON.stringify(sf), currentPage: '1', pageSize: '200' }));
}

function listRepos(self) {
  // Fetch ALL refs unfiltered, then extract distinct repo_name values
  return apiFetch(self, 'searchFormDatas.json',
    new URLSearchParams({ formUuid: FORMS.refs, searchFieldJson: '{}', currentPage: '1', pageSize: '200' }));
}

function objCount(self) {
  return apiFetch(self, 'searchFormDatas.json',
    new URLSearchParams({ formUuid: FORMS.objects, searchFieldJson: '{}', currentPage: '1', pageSize: '1' }));
}

// ─── Git parsers ────────────────────────────────────────────────────────────
function parseCommitInfo(raw) {
  var info = { tree: '', parents: [], authorName: '', authorEmail: '', authorDate: '', message: '' };
  var lines = raw.split('\n');
  var msgStart = 0;
  for (var i = 0; i < lines.length; i++) {
    var l = lines[i];
    if (l === '') { msgStart = i + 1; break; }
    if (l.indexOf('tree ') === 0) info.tree = l.substring(5);
    else if (l.indexOf('parent ') === 0) info.parents.push(l.substring(7));
    else if (l.indexOf('author ') === 0) {
      var m = l.substring(7).match(/^(.+?)\s+<(.+?)>\s+(\d+)\s+/);
      if (m) { info.authorName = m[1]; info.authorEmail = m[2]; info.authorDate = m[3]; }
    }
  }
  info.message = lines.slice(msgStart).join('\n').trim();
  return info;
}

function parseTreeEntries(raw) {
  var entries = [];
  var p = 0; var len = raw.length;
  while (p < len) {
    var space = -1; for (var i = p; i < len; i++) { if (raw.charCodeAt(i) === 0x20) { space = i; break; } }
    if (space === -1) break;
    var mode = ''; for (var j = p; j < space; j++) mode += raw.charAt(j);
    var nullPos = -1; for (var k = space + 1; k < len; k++) { if (raw.charCodeAt(k) === 0x00) { nullPos = k; break; } }
    if (nullPos === -1) break;
    var name = ''; for (var m = space + 1; m < nullPos; m++) name += raw.charAt(m);
    var shaHex = '';
    for (var n = nullPos + 1; n < nullPos + 21 && n < len; n++) {
      var hb = raw.charCodeAt(n).toString(16);
      shaHex += (hb.length === 1 ? '0' : '') + hb;
    }
    entries.push({ mode: mode, name: name, sha: shaHex, isTree: mode === '40000' });
    p = nullPos + 21;
  }
  return entries;
}

function base64ToText(b64) {
  try {
    return decodeURIComponent(Array.prototype.map.call(atob(b64), function(c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
  } catch(e) { return atob(b64); }
}

function base64ToBytes(b64) {
  var raw = atob(b64); var bytes = [];
  for (var i = 0; i < raw.length; i++) bytes.push(raw.charCodeAt(i));
  return bytes;
}

function formatDate(ts) {
  var d = new Date(parseInt(ts, 10) * 1000);
  return d.toISOString().replace('T', ' ').substring(0, 19);
}

function shortSha(sha) { return sha ? sha.substring(0, 8) : ''; }
function isTagRef(path) { return path.indexOf('refs/tags/') === 0; }
function displayRef(path) { return path.replace('refs/heads/', '').replace('refs/tags/', ''); }

// ─── Loaders ────────────────────────────────────────────────────────────────
export function loadRepos() {
  var self = this;
  sset(self, { loading: true, error: null, forceRender: Date.now() });

  listRepos(self).then(function(data) {
    var repos = [];
    var seen = {};
    if (data && data.formDataList) {
      for (var i = 0; i < data.formDataList.length; i++) {
        var rn = data.formDataList[i].formData[F.ref_repo] || 'default';
        if (!seen[rn]) { seen[rn] = true; repos.push(rn); }
      }
    }
    if (repos.length === 0) repos.push('default');
    var state = sget(self);
    var curRepo = state.currentRepo || 'default';
    if (repos.indexOf(curRepo) === -1) curRepo = repos[0];
    sset(self, { repoList: repos, currentRepo: curRepo, forceRender: Date.now() });
    loadOverview.call(self);
  }).catch(function(err) {
    sset(self, { repoList: ['default'], currentRepo: 'default',
      loading: false, error: 'Load repos failed: ' + (err && err.message ? err.message : ''), forceRender: Date.now() });
  });
}

export function switchRepo(repoName) {
  var self = this;
  sset(self, { currentRepo: repoName, forceRender: Date.now() });
  loadOverview.call(self);
}

export function loadOverview() {
  var self = this;
  sset(self, { route: 'overview', refs: [], selectedBranch: null, commitList: [],
    selectedCommit: null, treeEntries: [], breadcrumbs: [], fileContent: null,
    loading: true, error: null, totalObjects: 0, forceRender: Date.now() });

  Promise.all([searchRefs(self), objCount(self)]).then(function(results) {
    var refs = []; var refsData = results[0]; var countData = results[1];
    if (refsData && refsData.formDataList) {
      for (var i = 0; i < refsData.formDataList.length; i++) {
        var fd = refsData.formDataList[i].formData;
        refs.push({ path: fd[F.ref_path], sha: fd[F.ref_sha] });
      }
    }
    sset(self, { route: 'overview', refs: refs, loading: false, error: null,
      totalObjects: (countData && countData.total) ? countData.total : 0, forceRender: Date.now() });
  }).catch(function(err) {
    sset(self, { route: 'overview', loading: false,
      error: 'Load failed: ' + (err && err.message ? err.message : 'unknown'), forceRender: Date.now() });
  });
}

export function loadBranches() {
  var self = this;
  sset(self, { route: 'branches', loading: true, error: null, forceRender: Date.now() });

  searchRefs(self).then(function(data) {
    var refs = [];
    if (data && data.formDataList) {
      for (var i = 0; i < data.formDataList.length; i++) {
        var fd = data.formDataList[i].formData;
        refs.push({ path: fd[F.ref_path], sha: fd[F.ref_sha] });
      }
    }
    sset(self, { route: 'branches', refs: refs, loading: false, error: null, forceRender: Date.now() });
  }).catch(function(err) {
    sset(self, { route: 'branches', loading: false,
      error: 'Load branches failed: ' + (err && err.message ? err.message : ''), forceRender: Date.now() });
  });
}

export function loadHistory(refPath, refSha) {
  var self = this;
  var s = sget(self);
  sset(self, { route: 'history', selectedBranch: { path: refPath, sha: refSha },
    commitList: [], loading: true, error: null, forceRender: Date.now() });

  walkChain(self, refSha, {}).then(function(commits) {
    sset(self, { route: 'history', commitList: commits, loading: false, error: null, forceRender: Date.now() });
  }).catch(function(err) {
    sset(self, { route: 'history', loading: false,
      error: 'Load history failed: ' + (err && err.message ? err.message : ''), forceRender: Date.now() });
  });
}

function walkChain(self, sha, seen) {
  if (seen[sha]) return Promise.resolve([]);
  seen[sha] = true;
  return searchObjects(self, sha).then(function(data) {
    if (!data || !data.formDataList || !data.formDataList[0]) return [];
    var fd = data.formDataList[0].formData;
    var raw = base64ToText(fd[F.obj_content]);
    var info = parseCommitInfo(raw);
    var commit = { sha: sha, tree: info.tree, parents: info.parents,
      authorName: info.authorName, authorEmail: info.authorEmail,
      authorDate: info.authorDate, message: info.message };
    if (info.parents.length === 0) return Promise.resolve([commit]);
    return walkChain(self, info.parents[0], seen).then(function(rest) {
      return [commit].concat(rest);
    });
  });
}

export function loadTree(treeSha) {
  var self = this;
  var s = sget(self);
  sset(self, { loading: true, error: null, treeEntries: [], fileContent: null, forceRender: Date.now() });

  searchObjects(self, treeSha).then(function(data) {
    if (!data || !data.formDataList || !data.formDataList[0]) {
      sset(self, { loading: false, error: 'tree not found: ' + shortSha(treeSha), forceRender: Date.now() });
      return;
    }
    var fd = data.formDataList[0].formData;
    var bytes = base64ToBytes(fd[F.obj_content]);
    var entries = parseTreeEntries(String.fromCharCode.apply(null, bytes));
    entries.sort(function(a, b) {
      if (a.isTree && !b.isTree) return -1;
      if (!a.isTree && b.isTree) return 1;
      return a.name < b.name ? -1 : (a.name > b.name ? 1 : 0);
    });
    sset(self, { loading: false, error: null, treeEntries: entries, forceRender: Date.now() });
  }).catch(function(err) {
    sset(self, { loading: false, error: 'Load tree failed: ' + (err && err.message ? err.message : ''), forceRender: Date.now() });
  });
}

export function loadBlob(blobSha, fileName) {
  var self = this;
  sset(self, { loading: true, error: null, fileContent: null, forceRender: Date.now() });

  searchObjects(self, blobSha).then(function(data) {
    if (!data || !data.formDataList || !data.formDataList[0]) {
      sset(self, { loading: false, error: 'blob not found: ' + shortSha(blobSha), forceRender: Date.now() });
      return;
    }
    var fd = data.formDataList[0].formData;
    var content = base64ToText(fd[F.obj_content]);
    sset(self, { loading: false, error: null, fileContent: { name: fileName, content: content, sha: blobSha }, forceRender: Date.now() });
  }).catch(function(err) {
    sset(self, { loading: false, error: 'Load file failed: ' + (err && err.message ? err.message : ''), forceRender: Date.now() });
  });
}

export function browseCommit(commit) {
  var self = this;
  sset(self, { route: 'files', selectedCommit: commit, treeEntries: [],
    breadcrumbs: [{ name: '/', sha: commit.tree }], fileContent: null,
    loading: true, error: null, forceRender: Date.now() });
  loadTree.call(self, commit.tree);
}

export function navigateTree(name, sha) {
  var self = this;
  var s = sget(self);
  var bc = (s.breadcrumbs || []).concat([{ name: name, sha: sha }]);
  sset(self, { breadcrumbs: bc, treeEntries: [], fileContent: null,
    loading: true, error: null, forceRender: Date.now() });
  loadTree.call(self, sha);
}

export function navigateBreadcrumb(index) {
  var self = this;
  var s = sget(self);
  var bc = (s.breadcrumbs || []).slice(0, index + 1);
  var target = bc[bc.length - 1];
  sset(self, { breadcrumbs: bc, treeEntries: [], fileContent: null,
    loading: true, error: null, forceRender: Date.now() });
  loadTree.call(self, target.sha);
}

export function closeFileViewer() {
  var self = this;
  sset(self, { fileContent: null, forceRender: Date.now() });
}

// ─── Event dispatcher ───────────────────────────────────────────────────────
// Instead of IIFE onClick handlers, we use data-* attributes and a single
// delegated click handler per section.
export function handleClick(action, arg1, arg2, arg3) {
  var self = this;
  if (action === 'nav-overview') loadOverview.call(self);
  else if (action === 'nav-branches') loadBranches.call(self);
  else if (action === 'repo-select') switchRepo.call(self, arg1);
  else if (action === 'ref-click') loadHistory.call(self, arg1, arg2);
  else if (action === 'commit-browse') browseCommit.call(self, arg1);
  else if (action === 'commit-parent') loadHistory.call(self, arg1, arg2);
  else if (action === 'tree-enter') {
    if (arg1) navigateTree.call(self, arg2, arg3);
    else loadBlob.call(self, arg3, arg2);
  }
  else if (action === 'breadcrumb-nav') navigateBreadcrumb.call(self, arg1);
  else if (action === 'close-dialog') closeFileViewer.call(self);
}

// ─── Render main ────────────────────────────────────────────────────────────
export function renderJsx() {
  var self = this;
  var state = this.getCustomState() || _customState;
  var route = state.route || 'overview';
  var loading = state.loading;
  var error = state.error;
  var fileContent = state.fileContent;
  var forceRender = state.forceRender;

  return (
    <div className="oyd-page">
      <div style={{display:'none'}}>{forceRender}</div>
      <div className="gida-container">
        {_renderHeader(self, state)}
        {_renderNav(self, route)}
        {error && <div className="gida-error">{error}</div>}
        {loading && <div className="gida-loading">Loading...</div>}
        {!loading && _renderRoute(self, state, route)}
      </div>
      {fileContent && _renderFileDialog(self, fileContent)}
      {_renderToasts(state)}
    </div>
  );
}

function _renderHeader(self, state) {
  var totalObj = state.totalObjects || 0;
  var refCount = (state.refs || []).length;
  var repoList = state.repoList || ['default'];
  var currentRepo = state.currentRepo || 'default';

  var repoOptions = [];
  for (var ri = 0; ri < repoList.length; ri++) {
    repoOptions.push(<option key={repoList[ri]} value={repoList[ri]}>{repoList[ri]}</option>);
  }

  return (
    <div className="gida-header">
      <div className="gida-header-left">
        <h1>gida</h1>
        <select className="gida-repo-select" value={currentRepo}
          onChange={function(e) { self.handleClick('repo-select', e.target.value); }}>
          {repoOptions}
        </select>
      </div>
      <div className="gida-subtitle">{totalObj} objects (shared) / {refCount} refs  |  {APP_TYPE}</div>
    </div>
  );
}

function _renderNav(self, currentRoute) {
  var tabs = ['overview', 'branches', 'history', 'files'];
  var labels = { overview: 'Overview', branches: 'Branches', history: 'History', files: 'Browse Files' };
  var items = [];
  for (var i = 0; i < tabs.length; i++) {
    var t = tabs[i];
    var active = currentRoute === t;
    var cls = 'gida-nav-btn' + (active ? ' active' : '');
    items.push(
      <button key={t} className={cls}
        onClick={function(e) { self.handleClick('nav-' + t); }}>
        {labels[t]}
      </button>
    );
  }
  return <div className="gida-nav">{items}</div>;
}

function _renderRoute(self, state, route) {
  if (route === 'overview') return _renderOverview(self, state);
  if (route === 'branches') return _renderBranches(self, state);
  if (route === 'history') return _renderHistory(self, state);
  if (route === 'files') return _renderFiles(self, state);
  return <div className="gida-empty">Unknown route: {route}</div>;
}

// ─── Overview ───────────────────────────────────────────────────────────────
function _renderOverview(self, state) {
  var refs = state.refs || [];
  var totalObj = state.totalObjects || 0;
  var branches = 0; var tags = 0;
  for (var i = 0; i < refs.length; i++) {
    if (isTagRef(refs[i].path)) tags++; else branches++;
  }
  var headRef = null;
  for (var j = 0; j < refs.length; j++) {
    if (refs[j].path === 'refs/heads/master' || refs[j].path === 'refs/heads/main') { headRef = refs[j]; break; }
  }
  if (!headRef && refs.length > 0) headRef = refs[0];

  // Pre-compute HEAD badge
  var headIsTag = headRef && isTagRef(headRef.path);
  var headBadgeCls = 'gida-badge ' + (headIsTag ? 'gida-badge-tag' : 'gida-badge-branch');
  var headBadgeText = headIsTag ? 'tag' : 'branch';
  var headPath = headRef ? headRef.path : '';
  var headSha = headRef ? headRef.sha : '';

  return (
    <div>
      <div className="gida-stat-grid">
        <div className="gida-stat">
          <div className="gida-stat-value">{totalObj}</div>
          <div className="gida-stat-label">Objects</div>
        </div>
        <div className="gida-stat">
          <div className="gida-stat-value">{branches}</div>
          <div className="gida-stat-label">Branches</div>
        </div>
        <div className="gida-stat">
          <div className="gida-stat-value">{tags}</div>
          <div className="gida-stat-label">Tags</div>
        </div>
        <div className="gida-stat">
          <div className="gida-stat-value">{refs.length}</div>
          <div className="gida-stat-label">Total Refs</div>
        </div>
      </div>

      {headRef && (
        <div className="gida-card">
          <div className="gida-card-title">HEAD — {headPath}</div>
          <span className={headBadgeCls}>{headBadgeText}</span>
          <div className="gida-sha" style={{marginTop:8}}>{headSha}</div>
          <div style={{marginTop:12}}>
            <button className="gida-btn gida-btn-primary gida-btn-sm"
              onClick={function(e) { self.handleClick('ref-click', headPath, headSha); }}>
              View History
            </button>
          </div>
        </div>
      )}

      {refs.length > 0 && (
        <div style={{marginTop:20}}>
          <h3 style={{fontSize:14,fontWeight:600,marginBottom:8}}>All Refs</h3>
          {_renderRefList(self, refs, 'overview')}
        </div>
      )}
      {refs.length === 0 && <div className="gida-empty">Repository is empty. Push some commits to get started.</div>}
    </div>
  );
}

function _renderRefList(self, refs, source) {
  var rows = [];
  for (var i = 0; i < refs.length; i++) {
    var ref = refs[i];
    var tag = isTagRef(ref.path);
    var dpath = displayRef(ref.path);
    var sha8 = shortSha(ref.sha);
    var badgeCls = 'gida-badge ' + (tag ? 'gida-badge-tag' : 'gida-badge-branch');
    var badgeText = tag ? 'tag' : 'branch';
    rows.push(
      <div key={ref.path} className="gida-row"
        onClick={function(e) { self.handleClick('ref-click', ref.path, ref.sha); }}>
        <span className="gida-row-icon">{tag ? 'T' : 'B'}</span>
        <span className="gida-row-name">{dpath}</span>
        <span className={badgeCls}>{badgeText}</span>
        <span className="gida-sha-sm">{sha8}</span>
      </div>
    );
  }
  return <div className="gida-card" style={{padding:0}}>{rows}</div>;
}

// ─── Branches ───────────────────────────────────────────────────────────────
function _renderBranches(self, state) {
  var refs = state.refs || [];
  if (refs.length === 0) return <div className="gida-empty">No refs found. Push to this repository first.</div>;
  return <div>
    <h3 style={{fontSize:14,fontWeight:600,marginBottom:12}}>Refs ({refs.length})</h3>
    {_renderRefList(self, refs, 'branches')}
  </div>;
}

// ─── History ────────────────────────────────────────────────────────────────
function _renderHistory(self, state) {
  var commits = state.commitList || [];
  var sel = state.selectedBranch;

  if (commits.length === 0 && !state.loading) {
    var selDisp = sel ? displayRef(sel.path) : '';
    var selSha8 = sel ? shortSha(sel.sha) : '';
    return (
      <div>
        {sel && (
          <div style={{marginBottom:12}}>
            <span style={{fontWeight:600}}>{selDisp}</span>
            <span className="gida-sha" style={{marginLeft:8}}>{selSha8}</span>
          </div>
        )}
        <div className="gida-empty">No commits loaded.</div>
      </div>
    );
  }

  var selIsTag = sel && isTagRef(sel.path);
  var selBadgeCls = 'gida-badge ' + (selIsTag ? 'gida-badge-tag' : 'gida-badge-branch');
  var selBadgeText = selIsTag ? 'tag' : 'branch';
  var selDisp = sel ? displayRef(sel.path) : '';
  var selSha = sel ? sel.sha : '';

  // Pre-compute commit data
  var commitCards = [];
  for (var ci = 0; ci < commits.length; ci++) {
    var c = commits[ci];
    var cSha8 = shortSha(c.sha);
    var cTree8 = shortSha(c.tree);
    var cDate = formatDate(c.authorDate);
    var cMsg = c.message || '<empty>';
    var cAuthor = c.authorName + ' <' + c.authorEmail + '>';
    var cParents = c.parents.join(', ');
    commitCards.push({
      sha: c.sha, sha8: cSha8, tree8: cTree8, date: cDate,
      message: cMsg, author: cAuthor, parents: cParents,
      parent0: c.parents.length > 0 ? c.parents[0] : '',
      parent0short: c.parents.length > 0 ? shortSha(c.parents[0]) : '',
    });
  }

  return (
    <div>
      {sel && (
        <div style={{marginBottom:16}}>
          <div style={{fontWeight:600,fontSize:15}}>
            <span className={selBadgeCls} style={{marginRight:8}}>{selBadgeText}</span>
            {selDisp}
          </div>
          <div className="gida-sha" style={{marginTop:4}}>{selSha}</div>
        </div>
      )}

      <h3 style={{fontSize:14,fontWeight:600,marginBottom:8}}>Commits ({commits.length})</h3>

      {commitCards.map(function(card) {
        var parentBtn = null;
        if (card.parent0) {
          parentBtn = <button className="gida-btn gida-btn-sm"
            onClick={function(e) { self.handleClick('commit-parent', sel.path, card.parent0); }}>
            Parent: {card.parent0short}
          </button>;
        }
        return (
          <div key={card.sha} className="gida-card">
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8}}>
              <div>
                <div className="gida-card-title">{card.message}</div>
                <div className="gida-card-meta">{card.author} — {card.date}</div>
              </div>
              <span className="gida-sha">{card.sha8}</span>
            </div>
            <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
              <button className="gida-btn gida-btn-sm"
                onClick={function(e) { self.handleClick('commit-browse', commits[commitCards.indexOf(card)]); }}>
                Browse Files
              </button>
              {parentBtn}
            </div>
            <div className="gida-commit-detail">
              <p><strong>Tree:</strong> <span className="gida-mono">{card.tree8}</span></p>
              <p><strong>Parents:</strong> <span className="gida-mono">{card.parents}</span></p>
              <p><strong>Author:</strong> {card.author}</p>
              <p><strong>Date:</strong> {card.date}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Files ──────────────────────────────────────────────────────────────────
function _renderFiles(self, state) {
  var entries = state.treeEntries || [];
  var bc = state.breadcrumbs || [];
  var commit = state.selectedCommit;

  var commitSha8 = commit ? shortSha(commit.sha) : '';
  var commitMsg = commit && commit.message ? commit.message.substring(0, 60) : '';

  return (
    <div>
      {commit && (
        <div style={{marginBottom:12}}>
          <span style={{fontWeight:600}}>{commitSha8}</span>
          <span style={{marginLeft:8,fontSize:13,color:'hsl(var(--oy-muted-foreground))'}}>{commitMsg}</span>
        </div>
      )}

      {_renderBreadcrumbs(self, bc)}

      {entries.length === 0 && !state.loading && <div className="gida-empty">This directory is empty.</div>}

      {entries.length > 0 && (
        <div>
          <div className="gida-tree-header">
            <span style={{width:20}}></span>
            <span style={{flex:1}}>Name</span>
            <span style={{width:70,textAlign:'right'}}>Mode</span>
            <span style={{width:80,textAlign:'right'}}>SHA</span>
          </div>
          <div className="gida-card" style={{padding:0}}>
            {entries.map(function(entry) {
              var icon = entry.isTree ? 'D' : 'F';
              var badgeCls = 'gida-row-meta gida-badge ' + (entry.isTree ? 'gida-badge-tree' : 'gida-badge-blob');
              var badgeText = entry.isTree ? 'tree' : 'blob';
              var sha8 = shortSha(entry.sha);
              var nameDisp = entry.name + (entry.isTree ? '/' : '');
              return (
                <div key={entry.sha + entry.name} className="gida-row"
                  onClick={function(e) { self.handleClick('tree-enter', entry.isTree, entry.name, entry.sha); }}>
                  <span className="gida-row-icon">{icon}</span>
                  <span className="gida-row-name">{nameDisp}</span>
                  <span className={badgeCls}>{badgeText}</span>
                  <span className="gida-sha-sm">{sha8}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function _renderBreadcrumbs(self, breadcrumbs) {
  if (!breadcrumbs || breadcrumbs.length === 0) return null;
  var parts = [];
  for (var i = 0; i < breadcrumbs.length; i++) {
    var bc = breadcrumbs[i];
    var isLast = i === breadcrumbs.length - 1;
    if (i > 0) parts.push(<span key={'sep' + i} className="gida-breadcrumb-sep">/</span>);
    if (isLast) {
      parts.push(<span key={i} className="gida-breadcrumb-last">{bc.name}</span>);
    } else {
      parts.push(
        <span key={i} className="gida-breadcrumb"
          onClick={function(e) { self.handleClick('breadcrumb-nav', i); }}>
          {bc.name}
        </span>
      );
    }
  }
  return <div className="gida-breadcrumbs">{parts}</div>;
}

// ─── File dialog ────────────────────────────────────────────────────────────
function _renderFileDialog(self, fileContent) {
  var maxPreview = 10240;
  var content = fileContent.content || '';
  var truncated = content.length > maxPreview;
  var displayContent = truncated ? content.substring(0, maxPreview) : content;
  var sha8 = shortSha(fileContent.sha);
  var name = fileContent.name;
  var byteStr = '' + content.length;

  return (
    <div className="gida-dialog-overlay"
      onClick={function(e) { if (e.target.className === 'gida-dialog-overlay') self.handleClick('close-dialog'); }}>
      <div className="gida-dialog">
        <div className="gida-dialog-header">
          <div>
            <span style={{fontWeight:600}}>{name}</span>
            <span className="gida-sha" style={{marginLeft:8}}>{sha8}</span>
          </div>
          <button className="gida-btn gida-btn-sm"
            onClick={function(e) { self.handleClick('close-dialog'); }}>
            Close
          </button>
        </div>
        <div className="gida-dialog-body">
          <div style={{background:'hsl(var(--oy-muted))',borderRadius:'var(--oy-radius)',padding:12,marginBottom:8,display:'flex',justifyContent:'space-between',fontSize:12,color:'hsl(var(--oy-muted-foreground))'}}>
            <span>{byteStr} bytes</span>
            {truncated && <span>Preview limited to first {maxPreview} bytes</span>}
          </div>
          <div className="gida-code-block">
            <pre>{displayContent}</pre>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Toasts ─────────────────────────────────────────────────────────────────
function _renderToasts(state) {
  var toasts = state.toasts || [];
  if (toasts.length === 0) return null;
  var items = [];
  for (var i = 0; i < toasts.length; i++) {
    var t = toasts[i];
    items.push(
      <div key={t.id} className={'gida-toast gida-toast-' + (t.type || 'info')}>{t.msg}</div>
    );
  }
  return <div className="gida-toast-container">{items}</div>;
}