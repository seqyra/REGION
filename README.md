<<<<<<< HEAD
```text
██████╗ ███████╗ ██████╗ ██╗ ██████╗ ███╗   ██╗
██╔══██╗██╔════╝██╔════╝ ██║██╔═══██╗████╗  ██║
██████╔╝█████╗  ██║  ███╗██║██║   ██║██╔██╗ ██║
██╔══██╗██╔══╝  ██║   ██║██║██║   ██║██║╚██╗██║
██║  ██║███████╗╚██████╔╝██║╚██████╔╝██║ ╚████║
╚═╝  ╚═╝╚══════╝ ╚═════╝ ╚═╝ ╚═════╝ ╚═╝  ╚═══╝
```

**Resource Exploration & Geographic Information Observatory Network**

REGION is a local-first Minecraft world analysis platform that turns uploaded world files into an exportable, standalone intelligence-style HTML viewer. It is designed for players, archivists, server owners analyzing their own backups, modpack teams, and researchers who need a safe local map of explored terrain, player activity, structures, biomes, and world metadata.

REGION does not download worlds from servers, exploit multiplayer infrastructure, bypass permissions, or inspect remote systems. It only analyzes files that the user uploads locally.

## Project Overview

REGION accepts Minecraft Java world folders, ZIP backups, region files, datapack archives, and related local world files. The Node.js backend validates and extracts uploads, discovers world roots, parses available Minecraft metadata, scans `.mca` region headers, reads player and level data, estimates exploration density, and generates a portable JSON analysis model. The frontend renders the results as a premium dark dashboard and can export a standalone HTML viewer that opens without a server.

The first production target is robust local analysis of Java Edition worlds. The architecture is modular so deeper chunk NBT, biome palettes, structure references, and modded formats can be added without rewriting the application.

## Features

- Local upload workflow for ZIP archives, folders, Java world folders, `.mca` files, datapacks, and backup archives.
- Worker-thread analysis pipeline for large worlds.
- Region header scanning for explored chunk coordinates, activity density, and dimension coverage.
- Level metadata parsing for seed, version, spawn position, world generation hints, and data version.
- Player data parsing for UUIDs, last known coordinates, spawn positions, selected item metadata, and dimension activity where available.
- Structure discovery from generated data folders and detectable structure references when present.
- Searchable coordinate database for structures, players, regions, biomes, and detected landmarks.
- Interactive map canvas with pan, zoom, coordinate navigation, chunk boundaries, explored chunks, and multiple map modes.
- Visualization layers for terrain, exploration heatmap, chunk ownership estimates, structures, biomes, heightmap placeholders, density, and underground indicators when available.
- Export tools for standalone HTML viewer, JSON analysis, and statistics.
- Responsive glassmorphism dashboard with a Minecraft-inspired cyber-geographic visual identity.
- Strictly local processing by default.

## Screenshots placeholders

Add project screenshots here after running a world through the analyzer:

```text
docs/screenshots/dashboard.png
docs/screenshots/map-viewer.png
docs/screenshots/exported-report.png
docs/screenshots/mobile-layout.png
```

## Installation

Install Node.js 20 or newer, then run:

```bash
cd REGION
npm install
npm start
```

Open:

```text
http://127.0.0.1:4177
```

## Development Setup

Create a local environment file if you need custom limits:

```bash
cp .env.example .env
```

Run the development server:

```bash
npm run dev
```

Validate JavaScript syntax:

```bash
npm run check
```

Useful environment variables:

```text
PORT=4177
HOST=127.0.0.1
REGION_MAX_UPLOAD_MB=2048
REGION_STORAGE_DIR=storage
```

## Usage Tutorial

1. Start REGION with `npm start`.
2. Open the local web interface.
3. Upload a Minecraft world ZIP, backup archive, folder selection, `.mca` file, or datapack archive.
4. Wait for the analysis pipeline to finish.
5. Use the layer switcher to inspect terrain, heatmap, density, structures, biome records, and region coverage.
6. Search coordinates in the database tables.
7. Export the standalone HTML viewer for sharing or archiving.
8. Export JSON analysis or statistics for automation and research.

Folder upload is supported by the browser through the directory picker. The frontend packages the selected files into a multipart request while preserving relative paths.

## File Support

| Format | Status | Notes |
| --- | --- | --- |
| Minecraft Java world folder | Supported | Detects `level.dat`, `region`, `DIM-1`, `DIM1`, player data, datapacks, and generated data. |
| ZIP archive | Supported | Extracted locally before discovery. |
| Backup archive | Supported when ZIP-compatible | Common Java server backups are usually ZIP-compatible. |
| Region file `.mca` | Supported | Header scan detects occupied chunks and timestamps. |
| Datapack archive | Partial | Metadata and structure files are indexed where possible. |
| Player `.dat` files | Supported | Uses NBT parsing where fields are present. |
| Bedrock worlds | Not supported yet | Planned as a future parser module. |
| Modded dimensions | Partial | Unknown dimension folders are indexed as custom dimensions when detected. |

## Architecture

```text
REGION/
  public/
    index.html
    styles.css
    app.js
  src/
    server.js
    config.js
    routes/
      api.js
    services/
      analyzer.js
      archiveService.js
      fileIndex.js
      playerParser.js
      regionParser.js
      reportBuilder.js
      uploadService.js
      worldDiscovery.js
    workers/
      analyzeWorker.js
    lib/
      errors.js
      logger.js
      nbt.js
      paths.js
  storage/
    uploads/
    extracted/
    reports/
```

The backend separates upload handling, archive extraction, world discovery, region parsing, NBT parsing, and report generation. Heavy analysis runs in a worker thread so the HTTP server remains responsive during large scans.

## Performance

REGION is built for large local worlds:

- Region files are scanned by reading only the 8 KiB `.mca` header when possible.
- Worker threads keep uploads and analysis isolated from the web server event loop.
- File discovery uses streaming-friendly globbing with ignored heavy folders.
- Exported reports store compact chunk records instead of embedding raw world files.
- Upload size is configurable through `REGION_MAX_UPLOAD_MB`.
- Analysis failures are collected as warnings instead of failing the entire world when possible.

For extremely large worlds, prefer ZIP backups on fast local storage and increase the Node.js memory limit if deeper chunk parsing modules are enabled later:

```bash
node --max-old-space-size=8192 src/server.js
```

## Export System

REGION exports:

- Standalone HTML viewer containing map UI, tables, statistics, and embedded analysis JSON.
- Raw JSON analysis for automation.
- Compact statistics JSON for dashboards or documentation.

Standalone exports are self-contained and can be opened directly from disk. They do not require the REGION server after generation.

## Technical Details

REGION uses:

- Node.js and Fastify for the local backend.
- Vanilla HTML, CSS, and JavaScript for the frontend.
- Worker threads for analysis jobs.
- `prismarine-nbt` for Minecraft NBT metadata.
- `adm-zip` for ZIP extraction.
- `.mca` region header parsing for chunk occupancy and modification timestamps.
- Canvas rendering for interactive maps.

Structure detection is best-effort and depends on what exists in the uploaded world. Some structures are only discoverable after Minecraft has generated and saved the relevant chunks or structure reference data. The analyzer exposes confidence levels so future parser modules can distinguish exact NBT-derived detections from inferred or indexed data.

## Data Sources

REGION reads local files supplied by the user:

- `level.dat`
- `playerdata/*.dat`
- `region/*.mca`
- `DIM-1/region/*.mca`
- `DIM1/region/*.mca`
- `entities/*.mca`
- `poi/*.mca`
- `generated/**`
- `datapacks/**`

No external Minecraft server data is fetched.

## FAQ

**Does REGION download maps from servers?**  
No. REGION only analyzes files the user uploads locally.

**Can REGION find every structure?**  
It can index many detectable structures when the relevant files exist. Some structures require deeper chunk NBT or generation algorithms, which are planned as parser modules.

**Does the exported HTML include my world files?**  
No. It embeds analysis results, map records, tables, and statistics, not raw region files.

**Can I share an export?**  
Yes, but review the JSON first if coordinates, player UUIDs, or seed values are private.

**Does REGION support modded worlds?**  
Partially. Custom dimensions and datapack files are indexed, but exact modded structure semantics vary by mod.

## Troubleshooting

**Upload fails immediately**  
Check `REGION_MAX_UPLOAD_MB` and confirm the file extension is supported.

**The map is sparse**  
The world may contain few generated chunks, or the upload may contain only datapacks without region files.

**Player names are missing**  
Offline player files usually contain UUIDs but not guaranteed current names. REGION avoids remote lookups by default.

**Seed is missing**  
Some server backups or edited worlds omit seed data, or the NBT field may be unavailable.

**The standalone viewer is large**  
Large worlds can create large embedded JSON. Export the raw JSON separately for archival workflows.

## Roadmap

- Deep chunk NBT parsing for block-level biome palettes and heightmaps.
- Exact structure start/reference parsing across modern Minecraft versions.
- Optional local name cache import for player UUID resolution.
- Bedrock Edition parser module.
- Web Worker rendering for huge exported maps.
- Plugin interface for modded dimensions and datapack-specific structures.
- Incremental analysis cache for repeated scans of the same world.
- Optional CLI batch exporter.

## License

REGION is released under the MIT License.
=======
# REGION
>>>>>>> fe0f0e12b364a12246babec2a9a72b41b8b6d18d
