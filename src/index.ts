#!/usr/bin/env node
/**
 * git-remote-yida — Git Remote Helper for Yida (宜搭)
 *
 * Usage:
 *   git clone yida::<appType>/<objectsForm>/<refsForm>
 *   git remote add origin yida::<appType>/<objectsForm>/<refsForm>
 *
 * Environment variables:
 *   YIDA_BASE_URL   — Yida API base (default: https://www.aliwork.com)
 *   YIDA_LOCAL      — Use local file storage (for testing)
 *   YIDA_GIT_DIR    — Git directory for local storage (default: .git)
 */

import { runProtocol } from './protocol.js';
import { FileStorage, YidaStorage } from './storage.js';
import type { StorageBackend } from './storage.js';

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
    storage = new FileStorage(gitDir);
    console.error('[git-remote-yida] Using local file storage:', gitDir);
  } else if (url) {
    // Parse yida:: URL
    // Format: yida::APP_XXX/FORM_OBJECTS/FORM_REFS
    const parsed = parseYidaUrl(url);

    if (!parsed) {
      console.error('Error: Invalid Yida remote URL.');
      console.error('Expected format: yida::<appType>/<objectsFormUuid>/<refsFormUuid>');
      process.exit(1);
    }

    storage = new YidaStorage({
      appType: parsed.appType,
      objectsFormUuid: parsed.objectsFormUuid,
      refsFormUuid: parsed.refsFormUuid,
      baseUrl: process.env.YIDA_BASE_URL,
    });
    console.error('[git-remote-yida] Using Yida storage:',
      parsed.appType, '/', parsed.objectsFormUuid, '/', parsed.refsFormUuid);
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
 * Format: yida::<appType>/<objectsFormUuid>/<refsFormUuid>
 */
function parseYidaUrl(url: string): {
  appType: string;
  objectsFormUuid: string;
  refsFormUuid: string;
} | null {
  // Strip "yida::" prefix
  if (!url.startsWith('yida::')) return null;

  const inner = url.substring(6);

  // Support URL-encoded params too
  // Format: yida::APP_XXX/FORM_OBJ_UUID/FORM_REF_UUID
  const parts = inner.split('/');

  if (parts.length < 3) return null;

  return {
    appType: parts[0],
    objectsFormUuid: parts[1],
    refsFormUuid: parts[2],
  };
}

main().catch((err) => {
  console.error('[git-remote-yida] Fatal error:', err);
  process.exit(1);
});