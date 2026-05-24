import fs from 'node:fs/promises';
import path from 'node:path';
import AdmZip from 'adm-zip';
import { config } from '../config.js';
import { safeJoin } from '../lib/paths.js';

export async function expandUploads(upload) {
  const extractionDir = path.join(config.storage.extracted, upload.jobId);
  await fs.mkdir(extractionDir, { recursive: true });

  const roots = [upload.uploadDir];
  const extracted = [];

  for (const file of upload.savedFiles) {
    if (path.extname(file.path).toLowerCase() !== '.zip') continue;

    const targetDir = path.join(extractionDir, path.basename(file.path, '.zip'));
    await fs.mkdir(targetDir, { recursive: true });
    const zip = new AdmZip(file.path);

    for (const entry of zip.getEntries()) {
      if (entry.isDirectory) continue;
      const targetPath = safeJoin(targetDir, entry.entryName);
      await fs.mkdir(path.dirname(targetPath), { recursive: true });
      await fs.writeFile(targetPath, entry.getData());
      extracted.push(targetPath);
    }

    roots.push(targetDir);
  }

  return { roots, extractionDir, extractedCount: extracted.length };
}
