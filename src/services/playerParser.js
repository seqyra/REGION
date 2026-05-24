import path from 'node:path';
import { readNbtFile } from '../lib/nbt.js';

export async function parsePlayerFile(entry) {
  const uuid = path.basename(entry.name, '.dat');
  const data = await readNbtFile(entry.absolute);
  const pos = Array.isArray(data.Pos) ? data.Pos : [];
  const spawn = {
    x: data.SpawnX ?? null,
    y: data.SpawnY ?? null,
    z: data.SpawnZ ?? null,
    dimension: data.SpawnDimension ?? null
  };

  return {
    uuid,
    name: data.bukkit?.lastKnownName || data.LastKnownName || null,
    position: {
      x: numberOrNull(pos[0]),
      y: numberOrNull(pos[1]),
      z: numberOrNull(pos[2]),
      dimension: normalizeDimension(data.Dimension)
    },
    spawn,
    selectedItem: data.SelectedItem?.id || null,
    xpLevel: data.XpLevel ?? null,
    health: data.Health ?? null,
    foodLevel: data.foodLevel ?? null
  };
}

function numberOrNull(value) {
  return typeof value === 'number' ? Math.round(value * 100) / 100 : null;
}

function normalizeDimension(value) {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') {
    if (value === -1) return 'minecraft:the_nether';
    if (value === 1) return 'minecraft:the_end';
    return 'minecraft:overworld';
  }
  return null;
}
