/**
 * Yida API client — data access layer over 宜搭表单.
 *
 * We use two Yida forms:
 *  - git_objects: stores blob/tree/commit/tag objects
 *  - git_refs:    stores branch/tag references
 *
 * All API calls go through the openyida CLI or direct fetch to the Yida REST API.
 * For the prototype, we use a simple file-based store first,
 * then swap in real Yida API calls.
 */
import type { GitObject, GitRef } from './types.js';

/**
 * Storage backend interface — allows swapping file-based → Yida-based
 * without changing the protocol layer.
 */
export interface StorageBackend {
  /** Store a single git object */
  putObject(obj: GitObject): Promise<void>;
  /** Retrieve a single git object by SHA */
  getObject(sha: string): Promise<GitObject | null>;
  /** Check if an object exists */
  hasObject(sha: string): Promise<boolean>;
  /** List all refs */
  listRefs(): Promise<GitRef[]>;
  /** Get a single ref by path */
  getRef(path: string): Promise<string | null>;
  /** Set a ref (branch/tag pointer) */
  setRef(path: string, sha: string): Promise<void>;
  /** Delete a ref */
  deleteRef(path: string): Promise<void>;
}

/**
 * File-system based storage (prototype stage).
 * Uses `.git/yida-objects/` and `.git/yida-refs.json`.
 */
import { access, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { buildObject, hashBlob, hashObject, parseObject, verifyHash } from './crypto.js';

export class FileStorage implements StorageBackend {
  private objectsDir: string;
  private refsPath: string;
  private repoName: string;

  constructor(gitDir: string, repoName: string = 'default') {
    this.repoName = repoName;
    this.objectsDir = join(gitDir, 'yida-objects');
    this.refsPath = join(gitDir, `yida-refs-${repoName}.json`);
  }

  async #init(): Promise<void> {
    try { await mkdir(this.objectsDir, { recursive: true }); } catch {}
    // Ensure objects subdirs
    await mkdir(join(this.objectsDir, 'pack'), { recursive: true });
    for (let i = 0; i < 256; i++) {
      const hex = i.toString(16).padStart(2, '0');
      await mkdir(join(this.objectsDir, hex), { recursive: true }).catch(() => {});
    }
  }

  private objPath(sha: string): string {
    return join(this.objectsDir, sha.substring(0, 2), sha.substring(2));
  }

  async putObject(obj: GitObject): Promise<void> {
    await this.#init();
    const raw = buildObject(obj.type, obj.content);
    const computed = hashBlob(raw);
    // Validate SHA
    if (computed !== obj.sha && obj.type !== 'blob') {
      // For blobs compute from content differently
      const actual = hashBlob(raw);
      if (actual !== obj.sha) {
        // Try object-level hash
        const objHash = hashObject(obj.type, obj.content);
        if (objHash !== obj.sha) {
          // Store with the computed hash instead
          const path = this.objPath(computed);
          await mkdir(join(this.objectsDir, computed.substring(0, 2)),
            { recursive: true }).catch(() => {});
          await writeFile(path, raw);
          return;
        }
      }
    }
    await writeFile(this.objPath(obj.sha), raw);
  }

  async getObject(sha: string): Promise<GitObject | null> {
    await this.#init();
    try {
      const raw = await readFile(this.objPath(sha));
      const { type, content } = parseObject(raw);
      return { sha, type: type as GitObject['type'], content };
    } catch {
      return null;
    }
  }

  async hasObject(sha: string): Promise<boolean> {
    await this.#init();
    try {
      await access(this.objPath(sha));
      return true;
    } catch {
      return false;
    }
  }

  async listRefs(): Promise<GitRef[]> {
    await this.#init();
    try {
      const data = await readFile(this.refsPath, 'utf8');
      const entries: Record<string, string> = JSON.parse(data);
      return Object.entries(entries).map(([path, sha]) => ({ path, sha }));
    } catch {
      return [];
    }
  }

  async getRef(path: string): Promise<string | null> {
    const refs = await this.listRefs();
    const found = refs.find(r => r.path === path);
    return found?.sha ?? null;
  }

  async setRef(path: string, sha: string): Promise<void> {
    await this.#init();
    let refs: Record<string, string> = {};
    try {
      const data = await readFile(this.refsPath, 'utf8');
      refs = JSON.parse(data);
    } catch {}
    refs[path] = sha;
    await writeFile(this.refsPath, JSON.stringify(refs, null, 2));
  }

  async deleteRef(path: string): Promise<void> {
    await this.#init();
    try {
      const data = await readFile(this.refsPath, 'utf8');
      const refs: Record<string, string> = JSON.parse(data);
      delete refs[path];
      await writeFile(this.refsPath, JSON.stringify(refs, null, 2));
    } catch {}
  }
}

/**
 * Yida API storage backend — uses 宜搭 REST API via fetch.
 *
 * Yida form schema (git_objects):
 *   - object_sha (TextField)       → SHA-1 hash
 *   - object_type (SelectField)    → blob | tree | commit | tag
 *   - content (TextareaField)       → base64-encoded object content
 *
 * Yida form schema (git_refs):
 *   - ref_path (TextField)         → refs/heads/main etc.
 *   - target_sha (TextField)       → target commit SHA
 *   - ref_type (SelectField)       → branch | tag
 */
export class YidaStorage implements StorageBackend {
  private appType: string;
  private objectsFormUuid: string;
  private refsFormUuid: string;
  private repoName: string;
  private baseUrl: string;

  constructor(options: {
    appType: string;
    objectsFormUuid: string;
    refsFormUuid: string;
    repoName?: string;
    baseUrl?: string;
  }) {
    this.appType = options.appType;
    this.objectsFormUuid = options.objectsFormUuid;
    this.refsFormUuid = options.refsFormUuid;
    this.repoName = options.repoName || 'default';
    this.baseUrl = options.baseUrl || 'https://www.aliwork.com';
  }

  private async apiCall(method: 'GET' | 'POST', path: string, body?: URLSearchParams): Promise<any> {
    const url = `${this.baseUrl}/dingtalk/web/${this.appType}/v1/form/${path}`;
    const init: RequestInit = {
      method,
      headers: body
        ? { 'Content-Type': 'application/x-www-form-urlencoded' }
        : {},
    };
    if (body) init.body = body.toString();

    // Note: In a real 宜搭 custom page, fetch is available globally.
    // For CLI usage, you'd need cookie/auth headers.
    const res = await fetch(url, init);
    const json = await res.json();

    if (!json.success) {
      throw new Error(`Yida API error: ${JSON.stringify(json)}`);
    }
    return json;
  }

  async putObject(obj: GitObject): Promise<void> {
    const payload = new URLSearchParams({
      formUuid: this.objectsFormUuid,
      formDataJson: JSON.stringify({
        object_sha: obj.sha,
        object_type: obj.type,
        content: obj.content.toString('base64'),
      }),
    });
    await this.apiCall('POST', 'saveFormData.json', payload);
  }

  async getObject(sha: string): Promise<GitObject | null> {
    const payload = new URLSearchParams({
      formUuid: this.objectsFormUuid,
      searchFieldJson: JSON.stringify({ object_sha: sha }),
      currentPage: '1',
      pageSize: '1',
    });
    const data = await this.apiCall('POST', 'searchFormDatas.json', payload);

    if (data.total === 0 || !data.formDataList?.[0]?.formData) {
      return null;
    }

    const fd = data.formDataList[0].formData;
    return {
      sha: fd.object_sha,
      type: fd.object_type,
      content: Buffer.from(fd.content, 'base64'),
    };
  }

  async hasObject(sha: string): Promise<boolean> {
    const obj = await this.getObject(sha);
    return obj !== null;
  }

  async listRefs(): Promise<GitRef[]> {
    const payload = new URLSearchParams({
      formUuid: this.refsFormUuid,
      searchFieldJson: JSON.stringify({ repo_name: this.repoName }),
      currentPage: '1',
      pageSize: '200',
    });
    const data = await this.apiCall('POST', 'searchFormDatas.json', payload);

    if (!data.formDataList) return [];

    return data.formDataList.map((item: any) => ({
      path: item.formData.ref_path,
      sha: item.formData.target_sha,
    }));
  }

  async getRef(path: string): Promise<string | null> {
    const payload = new URLSearchParams({
      formUuid: this.refsFormUuid,
      searchFieldJson: JSON.stringify({ repo_name: this.repoName, ref_path: path }),
      currentPage: '1',
      pageSize: '1',
    });
    const data = await this.apiCall('POST', 'searchFormDatas.json', payload);

    if (data.total === 0 || !data.formDataList?.[0]) return null;
    return data.formDataList[0].formData.target_sha;
  }

  async setRef(path: string, sha: string): Promise<void> {
    // First check if ref already exists (for update vs create)
    const payload = new URLSearchParams({
      formUuid: this.refsFormUuid,
      searchFieldJson: JSON.stringify({ repo_name: this.repoName, ref_path: path }),
      currentPage: '1',
      pageSize: '1',
    });
    const existing = await this.apiCall('POST', 'searchFormDatas.json', payload);

    if (existing.total > 0 && existing.formDataList?.[0]?.formInstId) {
      // Update existing ref
      const updatePayload = new URLSearchParams({
        formInstId: existing.formDataList[0].formInstId,
        formUuid: this.refsFormUuid,
        formDataJson: JSON.stringify({
          target_sha: sha,
        }),
      });
      await this.apiCall('POST', 'updateFormData.json', updatePayload);
    } else {
      // Create new ref
      const createPayload = new URLSearchParams({
        formUuid: this.refsFormUuid,
        formDataJson: JSON.stringify({
          repo_name: this.repoName,
          ref_path: path,
          target_sha: sha,
        }),
      });
      await this.apiCall('POST', 'saveFormData.json', createPayload);
    }
  }

  async deleteRef(path: string): Promise<void> {
    const payload = new URLSearchParams({
      formUuid: this.refsFormUuid,
      searchFieldJson: JSON.stringify({ repo_name: this.repoName, ref_path: path }),
      currentPage: '1',
      pageSize: '1',
    });
    const existing = await this.apiCall('POST', 'searchFormDatas.json', payload);

    if (existing.total > 0 && existing.formDataList?.[0]?.formInstId) {
      const deletePayload = new URLSearchParams({
        formUuid: this.refsFormUuid,
        formInstId: existing.formDataList[0].formInstId,
      });
      await this.apiCall('POST', 'deleteFormData.json', deletePayload);
    }
  }
}