import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const storageRoot = path.resolve(rootDir, process.env.REGION_STORAGE_DIR || 'storage');

export const config = {
  rootDir,
  host: process.env.HOST || '127.0.0.1',
  port: Number(process.env.PORT || 4177),
  maxUploadBytes: Number(process.env.REGION_MAX_UPLOAD_MB || 2048) * 1024 * 1024,
  storage: {
    root: storageRoot,
    uploads: path.join(storageRoot, 'uploads'),
    extracted: path.join(storageRoot, 'extracted'),
    reports: path.join(storageRoot, 'reports')
  },
  publicDir: path.join(rootDir, 'public')
};
