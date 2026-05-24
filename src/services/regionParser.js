import fs from 'node:fs/promises';
import path from 'node:path';
import { classifyDimension } from './worldDiscovery.js';

const REGION_CHUNK_SIZE = 32;

export async function parseRegionFile(entry, worldRoot) {
  const header = Buffer.alloc(8192);
  const handle = await fs.open(entry.absolute, 'r');
  try {
    await handle.read(header, 0, 8192, 0);
  } finally {
    await handle.close();
  }

  const regionPosition = parseRegionPosition(entry.name);
  const chunks = [];

  for (let index = 0; index < 1024; index += 1) {
    const offset = header.readUIntBE(index * 4, 3);
    const sectors = header[index * 4 + 3];
    if (!offset || !sectors) continue;

    const timestampOffset = 4096 + index * 4;
    const modifiedAt = header.readUInt32BE(timestampOffset);
    const localX = index % REGION_CHUNK_SIZE;
    const localZ = Math.floor(index / REGION_CHUNK_SIZE);
    const chunkX = regionPosition.x * REGION_CHUNK_SIZE + localX;
    const chunkZ = regionPosition.z * REGION_CHUNK_SIZE + localZ;

    chunks.push({
      x: chunkX,
      z: chunkZ,
      localX,
      localZ,
      regionX: regionPosition.x,
      regionZ: regionPosition.z,
      dimension: classifyDimension(path.relative(worldRoot, entry.absolute)),
      sectors,
      modifiedAt,
      activity: modifiedAt ? Math.max(1, Math.min(100, Math.round(sectors * 6))) : 1
    });
  }

  return {
    file: entry.relative,
    absolute: entry.absolute,
    x: regionPosition.x,
    z: regionPosition.z,
    dimension: classifyDimension(path.relative(worldRoot, entry.absolute)),
    chunks,
    chunkCount: chunks.length
  };
}

export function parseRegionPosition(fileName) {
  const match = fileName.match(/^r\.(-?\d+)\.(-?\d+)\.mca$/i);
  if (!match) return { x: 0, z: 0 };
  return { x: Number(match[1]), z: Number(match[2]) };
}
