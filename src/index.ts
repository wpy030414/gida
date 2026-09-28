#!/usr/bin/env node
/**
 * git-remote-yida — Git Remote Helper for Yida (宜搭)
 *
 * Usage:
 *   git clone yida::<appType>/<repoName>
 *   git remote add origin yida::<appType>/<repoName>
 *
 * Environment variables:
 *   YIDA_BASE_URL   — Yida API base (default: https://www.aliwork.com)
 *   YIDA_LOCAL      — Use local file storage (for testing)
 *   YIDA_GIT_DIR    — Git directory for local storage (default: .git)
 */

import { runProtocol } from './protocol.js';
import { FileStorage, YidaStorage } from './storage.js';
import type { StorageBackend } from './storage.js';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Load gida-schema.json — contains form UUIDs and field IDs.
 * In production this is cached at `.cache/gida-schema.json`.
 */
function loadSchema(): any {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const schemaPath = join(__dirname, '..', '.cache', 'gida-schema.json');
  return JSON.parse(readFileSync(schemaPath, 'utf8'));
}

async function main(): Promise<void> {
  // Parse the remote URL from git's invocation:
  // git passes the remote URL as the first argument (after the helper name)
  const url = process.argv[2];
  const localMode = process.env.YIDA_LOCAL === '1';

  let storage: StorageBackend;

  if (localMode) {
    // Local file-based storage (for development/testing)
    const gitDir = process.env.YIDA_GIT_DIR ||
      new URL('../.git', import.meta.url).pathname;
    const repoName = parseYidaUrl(url)?.repoName || 'default';
    storage = new FileStorage(gitDir, repoName);
    console.error('[git-remote-yida] Using local file storage:', gitDir, '(repo:', repoName, ')');
  } else if (url) {
    // Parse yida:: URL
    // Format: yida::APP_TYPE/REPO_NAME
    const parsed = parseYidaUrl(url);

    if (!parsed) {
      console.error('Error: Invalid Yida remote URL.');
      console.error('Expected format: yida::<appType>/<repoName>');
      process.exit(1);
    }

    const schema = loadSchema();

    storage = new YidaStorage({
      appType: parsed.appType,
      objectsFormUuid: schema.forms.git_objects.formUuid,
      refsFormUuid: schema.forms.git_refs.formUuid,
      repoName: parsed.repoName,
      baseUrl: process.env.YIDA_BASE_URL,
    });
    console.error('[git-remote-yida] Using Yida storage:',
      parsed.appType, '/', parsed.repoName);
  } else {
    console.error('Error: No remote URL provided and YIDA_LOCAL not set.');
    console.error('Usage: git-remote-yida <url>');
    console.error('       or set YIDA_LOCAL=1 for file-based testing');
    process.exit(1);
  }

  await runProtocol(storage);
}

/**
 * Parse a yida:: URL into its components.
 *
 * Format: yida::<appType>/<repoName>
 */
function parseYidaUrl(url: string): {
  appType: string;
  repoName: string;
} | null {
  // Strip "yida::" prefix
  if (!url.startsWith('yida::')) return null;

  const inner = url.substring(6);
  const parts = inner.split('/');

  if (parts.length < 2) return null;

  return {
    appType: parts[0],
    repoName: parts[1],
  };
}

main().catch((err) => {
  console.error('[git-remote-yida] Fatal error:', err);
  process.exit(1);
});