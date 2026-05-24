import path from 'node:path';
import { indexFiles } from './fileIndex.js';
import { discoverWorlds } from './worldDiscovery.js';
import { parseRegionFile } from './regionParser.js';
import { parsePlayerFile } from './playerParser.js';
import { buildStats } from './stats.js';
import { readNbtFile } from '../lib/nbt.js';

const structureNames = [
  'stronghold',
  'village',
  'mineshaft',
  'monument',
  'mansion',
  'ancient_city',
  'bastion',
  'fortress',
  'temple',
  'trial_chambers',
  'end_city',
  'shipwreck',
  'ruined_portal',
  'igloo',
  'trail_ruins',
  'buried_treasure',
  'pillager_outpost'
];

export async function analyzeWorldUpload({ roots, jobId }) {
  const warnings = [];
  const fileIndex = await indexFiles(roots);
  const [world] = discoverWorlds(fileIndex);

  const level = await parseLevel(world.levelDat, warnings);
  const regionEntries = fileIndex.filter((entry) => entry.ext === '.mca' && /(^|\/)(region|entities|poi)\//.test(entry.relative));
  const regions = [];

  for (const entry of regionEntries) {
    try {
      regions.push(await parseRegionFile(entry, world.root || entry.root));
    } catch (error) {
      warnings.push({ type: 'region-parse', file: entry.relative, message: error.message });
    }
  }

  const playerEntries = fileIndex.filter((entry) => /(^|\/)playerdata\/[^/]+\.dat$/i.test(entry.relative));
  const players = [];

  for (const entry of playerEntries) {
    try {
      players.push(await parsePlayerFile(entry));
    } catch (error) {
      warnings.push({ type: 'player-parse', file: entry.relative, message: error.message });
    }
  }

  const structures = detectStructures(fileIndex);
  const biomes = detectBiomeArtifacts(fileIndex);
  const landmarks = detectLandmarks(fileIndex);
  const stats = buildStats({ world, regions, players, structures, fileIndex });

  return {
    schema: 'region.analysis.v1',
    generatedAt: new Date().toISOString(),
    jobId,
    world: {
      name: world.name,
      rootName: world.root ? path.basename(world.root) : null,
      seed: level.seed,
      minecraftVersion: level.minecraftVersion,
      dataVersion: level.dataVersion,
      generationType: level.generationType,
      spawn: level.spawn
    },
    stats,
    regions: regions.map(({ absolute, ...region }) => region),
    chunks: regions.flatMap((region) => region.chunks),
    players,
    structures,
    biomes,
    landmarks,
    files: summarizeFiles(fileIndex),
    warnings
  };
}

async function parseLevel(levelDat, warnings) {
  if (!levelDat) {
    return emptyLevel();
  }

  try {
    const level = await readNbtFile(levelDat);
    const data = level.Data || level;
    return {
      seed: data.WorldGenSettings?.seed ?? data.RandomSeed ?? null,
      minecraftVersion: data.Version?.Name || data.version || null,
      dataVersion: data.DataVersion ?? null,
      generationType: data.generatorName || data.WorldGenSettings?.dimensions?.['minecraft:overworld']?.generator?.type || null,
      spawn: {
        x: data.SpawnX ?? null,
        y: data.SpawnY ?? null,
        z: data.SpawnZ ?? null
      }
    };
  } catch (error) {
    warnings.push({ type: 'level-parse', file: levelDat, message: error.message });
    return emptyLevel();
  }
}

function emptyLevel() {
  return {
    seed: null,
    minecraftVersion: null,
    dataVersion: null,
    generationType: null,
    spawn: { x: null, y: null, z: null }
  };
}

function detectStructures(fileIndex) {
  const structures = [];

  for (const entry of fileIndex) {
    const lower = entry.relative.toLowerCase();
    const name = structureNames.find((candidate) => lower.includes(candidate));
    if (!name) continue;

    const coords = inferCoordinatesFromPath(lower);
    structures.push({
      id: `${name}:${structures.length + 1}`,
      type: normalizeStructureName(name),
      source: entry.relative,
      confidence: coords ? 'indexed-coordinate' : 'file-evidence',
      x: coords?.x ?? null,
      z: coords?.z ?? null,
      dimension: inferDimensionFromPath(lower)
    });
  }

  return structures;
}

function detectBiomeArtifacts(fileIndex) {
  return fileIndex
    .filter((entry) => entry.relative.toLowerCase().includes('biome'))
    .slice(0, 500)
    .map((entry, index) => ({
      id: `biome-artifact:${index + 1}`,
      name: path.basename(entry.name, path.extname(entry.name)),
      source: entry.relative
    }));
}

function detectLandmarks(fileIndex) {
  return fileIndex
    .filter((entry) => /\.(json|nbt|dat|mcmeta)$/i.test(entry.name))
    .filter((entry) => /landmark|feature|configured_structure|structure_set|template_pool/i.test(entry.relative))
    .slice(0, 800)
    .map((entry, index) => ({
      id: `landmark:${index + 1}`,
      name: path.basename(entry.name, path.extname(entry.name)),
      source: entry.relative
    }));
}

function inferCoordinatesFromPath(value) {
  const match = value.match(/(-?\d+)[,_.-]+(-?\d+)/);
  if (!match) return null;
  return { x: Number(match[1]), z: Number(match[2]) };
}

function inferDimensionFromPath(value) {
  if (value.includes('dim-1')) return 'minecraft:the_nether';
  if (value.includes('dim1')) return 'minecraft:the_end';
  if (value.includes('the_nether')) return 'minecraft:the_nether';
  if (value.includes('the_end')) return 'minecraft:the_end';
  return 'minecraft:overworld';
}

function normalizeStructureName(name) {
  return name
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function summarizeFiles(fileIndex) {
  const byExtension = fileIndex.reduce((acc, entry) => {
    const ext = entry.ext || '[none]';
    acc[ext] = (acc[ext] || 0) + 1;
    return acc;
  }, {});

  return {
    total: fileIndex.length,
    byExtension
  };
}
