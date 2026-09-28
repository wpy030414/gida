/** Git object stored in the backend */
export interface GitObject {
  sha: string;
  type: 'blob' | 'tree' | 'commit' | 'tag';
  content: Buffer;
}

/** A branch/tag reference */
export interface GitRef {
  path: string;
  sha: string;
}