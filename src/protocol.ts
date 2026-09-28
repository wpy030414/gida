/**
 * git-remote-yida — Git remote helper for Yida (宜搭) low-code platform.
 *
 * Uses Yida form data as git object storage:
 *   - Push:  stdin fast-import → temp repo → extract objects → Yida storage
 *   - Fetch: Yida storage → write objects to temp repo → fast-export → stdout
 *
 * Protocol: each command exchange is terminated by \n\n
 *
 * URL format: yida::<appType>/<objectsFormUuid>/<refsFormUuid>
 */
import type { StorageBackend } from './storage.js';
import type { GitObject, GitRef } from './types.js';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { deflateSync } from 'node:zlib';

export async function runProtocol(storage: StorageBackend): Promise<void> {
  const all = await readAllStdin();
  const blocks = splitBlocks(all);

  let pushMode = false;
  let fetchArgs: string[] = [];
  let currentBlock = 0;

  for (const block of blocks) {
    currentBlock++;
    if (block.data === null) { pushMode = true; break; }

    for (const line of block.data.split('\n').map(l => l.trimEnd())) {
      if (line === '') continue;
      const parts = line.split(' ');

      switch (parts[0]) {
        case 'capabilities':
          reply('push\nfetch\noption\nimport\nexport\nrefspec refs/heads/*:refs/heads/*\n\n');
          break;
        case 'list':
          reply(await listRefsStr(storage));
          reply('\n');
          break;
        case 'push':
          pushMode = true;
          break;
        case 'fetch':
          fetchArgs = parts.slice(1);
          break;
      }
      if (pushMode) break;
    }
    if (pushMode) break;
  }

  if (pushMode) {
    await doPush(storage, blocks[currentBlock - 1].remaining);
  } else if (fetchArgs.length > 0) {
    await doFetch(storage, fetchArgs);
  } else {
    reply('\n');
  }
}

// ─── Block splitter ─────────────────────────────────────────────────

interface Block { data: string | null; remaining: Buffer; }

function splitBlocks(buf: Buffer): Block[] {
  const blocks: Block[] = [];
  let pos = 0;

  while (pos < buf.length) {
    let dbl = -1;
    for (let i = pos; i < buf.length - 1; i++) {
      if (buf[i] === 0x0a && buf[i + 1] === 0x0a) { dbl = i; break; }
    }
    if (dbl === -1) {
      if (pos < buf.length) blocks.push({ data: null, remaining: buf.subarray(pos) });
      break;
    }
    const blockData = buf.subarray(pos, dbl).toString('utf8');
    blocks.push({ data: blockData, remaining: buf.subarray(dbl + 2) });
    pos = dbl + 2;
    if (blockData.includes('push ')) {
      if (pos < buf.length) blocks.push({ data: null, remaining: buf.subarray(pos) });
      break;
    }
  }
  return blocks;
}

// ─── stdin ──────────────────────────────────────────────────────────

async function readAllStdin(): Promise<Buffer> {
  if (process.stdin.readableEnded) return Buffer.alloc(0);
  return new Promise((resolve, reject) => {
    const c: Buffer[] = [];
    process.stdin.on('data', d => c.push(Buffer.isBuffer(d) ? d : Buffer.from(d)));
    process.stdin.on('end', () => resolve(Buffer.concat(c)));
    process.stdin.on('error', reject);
    process.stdin.resume();
  });
}

function reply(s: string): void { process.stdout.write(s); }

async function listRefsStr(s: StorageBackend): Promise<string> {
  const refs = await s.listRefs();
  let out = refs.map(r => `${r.sha} ${r.path}`).join('\n');
  if (out) out += '\n';
  const h = refs.find(r => r.path === 'refs/heads/main')
        || refs.find(r => r.path === 'refs/heads/master');
  if (h) out += `@HEAD ${h.path}\n`;
  else if (refs.length > 0) out += `@HEAD ${refs[0].path}\n`;
  return out;
}

// ─── Push ───────────────────────────────────────────────────────────

async function doPush(storage: StorageBackend, fi: Buffer): Promise<void> {
  const tmp = mkdtempSync(join(tmpdir(), 'gry-'));
  try {
    const ir = spawnSync('git', ['init', '--bare', tmp], { stdio: 'pipe' });
    if (ir.status !== 0) { reply('error all git-init\n\n'); return; }

    const fie = spawnSync('git', ['fast-import', '--quiet'], {
      cwd: tmp, input: fi, stdio: 'pipe', timeout: 30000,
    });
    if (fie.status !== 0) {
      reply('error all fast-import-failed\n\n');
      return;
    }

    const objs = getObjects(tmp);
    for (const o of objs) {
      await storage.putObject({ sha: o.sha, type: o.type as GitObject['type'], content: o.content });
    }

    const refs = getRefs(tmp);
    for (const r of refs) {
      await storage.setRef(r.path, r.sha);
      reply(`ok ${r.path}\n`);
    }
  } catch (err: any) {
    reply(`error all ${err.message}\n`);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
  reply('\n');
}

function getObjects(gitDir: string): GitObject[] {
  const list = spawnSync('git', ['cat-file', '--batch-all-objects', '--batch-check'],
    { cwd: gitDir, stdio: 'pipe' });
  if (list.status !== 0) return [];
  const shas = list.stdout.toString().trim().split('\n').filter(Boolean).map(l => l.split(' ')[0]);
  if (shas.length === 0) return [];

  const batch = spawnSync('git', ['cat-file', '--batch'],
    { cwd: gitDir, stdio: 'pipe', input: shas.join('\n') + '\n' });
  if (batch.status !== 0) return [];

  return parseBatch(batch.stdout, shas);
}

function parseBatch(buf: Buffer, expected: string[]): GitObject[] {
  const objs: GitObject[] = [];
  let pos = 0;
  for (let si = 0; si < expected.length; si++) {
    const nl = buf.indexOf(0x0a, pos);
    if (nl === -1) break;
    const hdr = buf.subarray(pos, nl).toString('utf8').trim();
    pos = nl + 1;
    if (!hdr.includes(' ')) continue;
    const [sha, type, sz] = hdr.split(' ');
    const size = parseInt(sz, 10);
    const content = buf.subarray(pos, pos + size);
    pos += size;
    if (pos < buf.length && buf[pos] === 0x0a) pos++;
    if (type === 'blob' || type === 'tree' || type === 'commit' || type === 'tag') {
      objs.push({ sha, type, content });
    }
  }
  return objs;
}

function getRefs(gitDir: string): GitRef[] {
  const sr = spawnSync('git', ['show-ref'], { cwd: gitDir, stdio: 'pipe' });
  if (sr.status !== 0) return [];
  return sr.stdout.toString().trim().split('\n').filter(Boolean).map(l => {
    const [sha, path] = l.split(' ');
    return { path, sha };
  });
}

// ─── Fetch ──────────────────────────────────────────────────────────

async function doFetch(storage: StorageBackend, args: string[]): Promise<void> {
  const tmp = mkdtempSync(join(tmpdir(), 'gry-'));
  try {
    spawnSync('git', ['init', '--bare', tmp], { stdio: 'pipe' });

    const allObjs: GitObject[] = [];
    const seen = new Set<string>();
    for (let i = 0; i < args.length; i += 2) {
      if (args[i]) allObjs.push(...await collectAll(storage, args[i], seen));
    }

    for (const o of allObjs) {
      const header = Buffer.from(`${o.type} ${o.content.length}\0`, 'utf8');
      const full = Buffer.concat([header, o.content]);
      const sha = createHash('sha1').update(full).digest('hex');
      const dir = join(tmp, 'objects', sha.substring(0, 2));
      try { mkdirSync(dir, { recursive: true }); } catch {}
      writeFileSync(join(dir, sha.substring(2)), deflateSync(full));
    }

    const storedRefs = await storage.listRefs();
    for (const r of storedRefs) {
      spawnSync('git', ['update-ref', r.path, r.sha], { cwd: tmp, stdio: 'pipe' });
    }

    const fe = spawn('git', ['fast-export', '--all'], {
      cwd: tmp, stdio: ['pipe', 'pipe', 'inherit'],
    });
    for await (const chunk of fe.stdout) process.stdout.write(chunk);
    await new Promise<void>(r => fe.on('close', r));
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

async function collectAll(
  s: StorageBackend, sha: string, seen: Set<string>
): Promise<GitObject[]> {
  if (seen.has(sha)) return [];
  seen.add(sha);
  const obj = await s.getObject(sha);
  if (!obj) return [];
  const res = [obj];

  if (obj.type === 'commit') {
    for (const l of obj.content.toString('utf8').split('\n')) {
      if (l.startsWith('tree ') || l.startsWith('parent '))
        res.push(...await collectAll(s, l.split(' ')[1], seen));
    }
  } else if (obj.type === 'tree') {
    let p = 0; const c = obj.content;
    while (p < c.length) {
      const si = c.indexOf(0x20, p); if (si === -1) break;
      const ni = c.indexOf(0x00, si); if (ni === -1) break;
      res.push(...await collectAll(s, c.subarray(ni + 1, ni + 21).toString('hex'), seen));
      p = ni + 21;
    }
  }
  return res;
}