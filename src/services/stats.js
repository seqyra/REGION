export function buildStats({ world, regions, players, structures, fileIndex }) {
  const chunks = regions.flatMap((region) => region.chunks);
  const dimensions = groupCount(chunks, 'dimension');
  const bounds = computeBounds(chunks);
  const totalExploredAreaBlocks = chunks.length * 16 * 16;

  return {
    worldName: world.name,
    totalFiles: fileIndex.length,
    totalRegions: regions.length,
    totalChunks: chunks.length,
    totalExploredAreaBlocks,
    totalExploredAreaKm2: Number((totalExploredAreaBlocks / 1_000_000).toFixed(3)),
    dimensions,
    players: players.length,
    structures: structures.length,
    bounds
  };
}

export function groupCount(items, key) {
  return items.reduce((acc, item) => {
    const value = item[key] || 'unknown';
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

function computeBounds(chunks) {
  if (chunks.length === 0) {
    return { minX: 0, minZ: 0, maxX: 0, maxZ: 0 };
  }

  return chunks.reduce((bounds, chunk) => ({
    minX: Math.min(bounds.minX, chunk.x),
    minZ: Math.min(bounds.minZ, chunk.z),
    maxX: Math.max(bounds.maxX, chunk.x),
    maxZ: Math.max(bounds.maxZ, chunk.z)
  }), {
    minX: chunks[0].x,
    minZ: chunks[0].z,
    maxX: chunks[0].x,
    maxZ: chunks[0].z
  });
}
