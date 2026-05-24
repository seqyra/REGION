import fs from 'node:fs/promises';
import zlib from 'node:zlib';
import { promisify } from 'node:util';
import nbt from 'prismarine-nbt';

const gunzip = promisify(zlib.gunzip);
const inflate = promisify(zlib.inflate);
const parseNbt = promisify(nbt.parse);

export async function readNbtFile(filePath) {
  const buffer = await fs.readFile(filePath);
  const inflated = await inflateMinecraftNbt(buffer);
  const parsed = await parseNbt(inflated);
  return nbt.simplify(parsed);
}

async function inflateMinecraftNbt(buffer) {
  try {
    return await gunzip(buffer);
  } catch {
    try {
      return await inflate(buffer);
    } catch {
      return buffer;
    }
  }
}
