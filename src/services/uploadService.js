import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config.js';
import { RegionError } from '../lib/errors.js';
import { ensureStorage, safeJoin } from '../lib/paths.js';

const supportedExtensions = new Set(['.zip', '.mca', '.dat', '.json', '.mcmeta']);

export async function persistMultipartUpload(request) {
  await ensureStorage();

  const jobId = uuidv4();
  const uploadDir = path.join(config.storage.uploads, jobId);
  await fsp.mkdir(uploadDir, { recursive: true });

  const parts = request.parts();
  const savedFiles = [];
  let totalBytes = 0;

  for await (const part of parts) {
    if (part.type !== 'file') continue;

    const originalName = sanitizeUploadName(part.filename || 'upload.bin');
    const relativePath = part.fields?.relativePath?.value || part.filename || originalName;
    const safeRelativePath = sanitizeRelativePath(relativePath);
    const targetPath = safeJoin(uploadDir, safeRelativePath);

    validateUploadFile(originalName);
    await fsp.mkdir(path.dirname(targetPath), { recursive: true });

    let fileBytes = 0;
    part.file.on('data', (chunk) => {
      fileBytes += chunk.length;
      totalBytes += chunk.length;
      if (totalBytes > config.maxUploadBytes) {
        part.file.destroy(new RegionError('Upload exceeds configured REGION size limit', 413));
      }
    });

    await pipeline(part.file, fs.createWriteStream(targetPath));
    savedFiles.push({
      originalName,
      relativePath: safeRelativePath,
      path: targetPath,
      size: fileBytes
    });
  }

  if (savedFiles.length === 0) {
    throw new RegionError('No files were uploaded', 400);
  }

  return { jobId, uploadDir, savedFiles, totalBytes };
}

function validateUploadFile(fileName) {
  const ext = path.extname(fileName).toLowerCase();
  if (!ext || supportedExtensions.has(ext)) return;

  const worldLikeName = fileName.includes('/') || fileName.includes('\\');
  if (!worldLikeName) {
    throw new RegionError(`Unsupported upload type: ${ext}`, 400, {
      supported: [...supportedExtensions].sort()
    });
  }
}

function sanitizeUploadName(value) {
  return value.replace(/[<>:"|?*]/g, '_').slice(0, 180);
}

function sanitizeRelativePath(value) {
  const normalized = value.replace(/\\/g, '/').replace(/^\/+/, '');
  const parts = normalized.split('/').filter(Boolean);
  const safeParts = parts.map((part) => sanitizeUploadName(part));
  return safeParts.join('/');
}
