import path from 'node:path';

export function discoverWorlds(index) {
  const levelFiles = index.filter((entry) => entry.name === 'level.dat');
  const worlds = levelFiles.map((levelFile) => ({
    name: path.basename(path.dirname(levelFile.absolute)),
    root: path.dirname(levelFile.absolute),
    levelDat: levelFile.absolute
  }));

  if (worlds.length > 0) return worlds;

  const regionFiles = index.filter((entry) => entry.ext === '.mca');
  if (regionFiles.length > 0) {
    return [{
      name: 'Loose region file collection',
      root: regionFiles[0].root,
      levelDat: null
    }];
  }

  return [{
    name: 'World-related upload',
    root: index[0]?.root,
    levelDat: null
  }];
}

export function classifyDimension(relativePath) {
  const normalized = relativePath.replace(/\\/g, '/');
  if (normalized.includes('DIM-1/')) return 'minecraft:the_nether';
  if (normalized.includes('DIM1/')) return 'minecraft:the_end';
  if (normalized.includes('/region/') || normalized.startsWith('region/')) return 'minecraft:overworld';
  const customDimension = normalized.match(/dimensions\/([^/]+\/[^/]+)\//);
  if (customDimension) return customDimension[1];
  return 'unknown';
}
