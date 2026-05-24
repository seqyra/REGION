import path from 'node:path';
import fg from 'fast-glob';
import { normalizeSlashes } from '../lib/paths.js';

export async function indexFiles(roots) {
  const entries = [];

  for (const root of roots) {
    const files = await fg('**/*', {
      cwd: root,
      onlyFiles: true,
      dot: true,
      followSymbolicLinks: false,
      ignore: ['**/node_modules/**', '**/.git/**']
    });

    for (const relative of files) {
      entries.push({
        root,
        relative: normalizeSlashes(relative),
        absolute: path.join(root, relative),
        ext: path.extname(relative).toLowerCase(),
        name: path.basename(relative)
      });
    }
  }

  return entries;
}
