/**
 * Git object hashing utilities.
 * SHA-1 hash computation for git objects (blob, tree, commit, tag).
 */
import { createHash } from 'node:crypto';

/**
 * Compute the git object hash for a blob.
 * Format: "blob <size>\0<content>"
 */
export function hashBlob(content: Buffer): string {
  const header = Buffer.from(`blob ${content.length}\0`, 'utf8');
  return createHash('sha1').update(header).update(content).digest('hex');
}

/**
 * Compute the git object hash for any object type.
 * Format: "<type> <size>\0<content>"
 */
export function hashObject(type: string, content: Buffer): string {
  const header = Buffer.from(`${type} ${content.length}\0`, 'utf8');
  return createHash('sha1').update(header).update(content).digest('hex');
}

/**
 * Build the full git object (header + content) as stored on disk.
 */
export function buildObject(type: string, content: Buffer): Buffer {
  const header = Buffer.from(`${type} ${content.length}\0`, 'utf8');
  return Buffer.concat([header, content]);
}

/**
 * Parse a git object (header + content) into type and content.
 */
export function parseObject(raw: Buffer): { type: string; content: Buffer } {
  const nullIdx = raw.indexOf(0);
  const header = raw.subarray(0, nullIdx).toString('utf8');
  const spaceIdx = header.indexOf(' ');
  const type = header.substring(0, spaceIdx);
  const content = raw.subarray(nullIdx + 1);
  return { type, content };
}

/**
 * Verify that a raw object matches its expected SHA.
 */
export function verifyHash(expectedSha: string, raw: Buffer): boolean {
  const computed = createHash('sha1').update(raw).digest('hex');
  return computed === expectedSha;
}