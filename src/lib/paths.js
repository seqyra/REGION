import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';

export async function ensureStorage() {
  await Promise.all([
    fs.mkdir(config.storage.uploads, { recursive: true }),
    fs.mkdir(config.storage.extracted, { recursive: true }),
    fs.mkdir(config.storage.reports, { recursive: true })
  ]);
}

export function safeJoin(baseDir, unsafePath) {
  const normalized = path.resolve(baseDir, unsafePath);
  if (!normalized.startsWith(path.resolve(baseDir))) {
    throw new Error(`Unsafe path rejected: ${unsafePath}`);
  }
  return normalized;
}

export function normalizeSlashes(value) {
  return value.split(path.sep).join('/');
}
