const state = {
  files: [],
  analysis: null,
  exports: null,
  activeTable: 'structures',
  map: {
    scale: 4,
    offsetX: 0,
    offsetZ: 0,
    drag: null
  }
};

const elements = {
  fileInput: document.querySelector('#file-input'),
  folderInput: document.querySelector('#folder-input'),
  dropzone: document.querySelector('#dropzone'),
  analyzeButton: document.querySelector('#analyze-button'),
  statusTitle: document.querySelector('#status-title'),
  statusDetail: document.querySelector('#status-detail'),
  statusCard: document.querySelector('#status-card'),
  statsGrid: document.querySelector('#stats-grid'),
  canvas: document.querySelector('#world-map'),
  layerSelect: document.querySelector('#layer-select'),
  mapHud: document.querySelector('#map-hud'),
  coordinateInput: document.querySelector('#coordinate-input'),
  goCoordinate: document.querySelector('#go-coordinate'),
  tableHead: document.querySelector('#table-head'),
  tableBody: document.querySelector('#table-body'),
  tableSearch: document.querySelector('#table-search'),
  downloadJson: document.querySelector('#download-json'),
  downloadStats: document.querySelector('#download-stats'),
  downloadHtml: document.querySelector('#download-html')
};

const ctx = elements.canvas.getContext('2d');

elements.fileInput.addEventListener('change', () => selectFiles(elements.fileInput.files));
elements.folderInput.addEventListener('change', () => selectFiles(elements.folderInput.files));
elements.analyzeButton.addEventListener('click', analyzeSelectedFiles);
elements.layerSelect.addEventListener('change', drawMap);
elements.tableSearch.addEventListener('input', renderTable);
elements.goCoordinate.addEventListener('click', goToCoordinate);
elements.downloadJson.addEventListener('click', () => downloadFromExport('json'));
elements.downloadStats.addEventListener('click', () => downloadFromExport('statistics'));
elements.downloadHtml.addEventListener('click', () => downloadFromExport('html'));

for (const eventName of ['dragenter', 'dragover']) {
  elements.dropzone.addEventListener(eventName, (event) => {
    event.preventDefault();
    elements.dropzone.classList.add('dragging');
  });
}

for (const eventName of ['dragleave', 'drop']) {
  elements.dropzone.addEventListener(eventName, (event) => {
    event.preventDefault();
    elements.dropzone.classList.remove('dragging');
  });
}

elements.dropzone.addEventListener('drop', (event) => {
  selectFiles(event.dataTransfer.files);
});

document.querySelectorAll('.tab').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((tab) => tab.classList.remove('active'));
    button.classList.add('active');
    state.activeTable = button.dataset.table;
    renderTable();
  });
});

function selectFiles(fileList) {
  state.files = [...fileList];
  elements.analyzeButton.disabled = state.files.length === 0;

  if (state.files.length === 0) {
    setStatus('Waiting for upload', 'No world files have been selected yet.');
    return;
  }

  const totalBytes = state.files.reduce((sum, file) => sum + file.size, 0);
  setStatus('Upload staged', `${state.files.length} files selected, ${formatBytes(totalBytes)} ready for local analysis.`);
}

async function analyzeSelectedFiles() {
  if (state.files.length === 0) return;

  setStatus('Uploading local files', 'Preparing multipart payload and preserving folder paths.');
  elements.analyzeButton.disabled = true;

  const formData = new FormData();
  for (const file of state.files) {
    formData.append('files', file, file.webkitRelativePath || file.name);
  }

  try {
    const response = await fetch('/api/analyze', {
      method: 'POST',
      body: formData
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || 'Upload failed');

    setStatus('Analysis running', `Job ${payload.jobId} is scanning world files in a worker thread.`);
    await pollJob(payload.jobId);
  } catch (error) {
    setStatus('Analysis failed', error.message);
    elements.analyzeButton.disabled = false;
  }
}

async function pollJob(jobId) {
  const startedAt = Date.now();

  while (true) {
    const response = await fetch(`/api/jobs/${jobId}`);
    const job = await response.json();

    if (job.status === 'complete') {
      state.analysis = job.analysis;
      state.exports = job.exports;
      setStatus('Analysis complete', `Mapped ${job.analysis.stats.totalChunks} chunks across ${job.analysis.stats.totalRegions} region files.`);
      renderAnalysis();
      elements.analyzeButton.disabled = false;
      return;
    }

    if (job.status === 'failed') {
      throw new Error(job.error?.message || 'Worker analysis failed');
    }

    const elapsed = Math.round((Date.now() - startedAt) / 1000);
    setStatus('Analysis running', `Scanning region headers, player data, generated structures, and metadata. ${elapsed}s elapsed.`);
    await sleep(1200);
  }
}

function renderAnalysis() {
  renderStats();
  renderTable();
  resetMapView();
  drawMap();

  elements.downloadJson.disabled = false;
  elements.downloadStats.disabled = false;
  elements.downloadHtml.disabled = false;
}

function renderStats() {
  const stats = state.analysis.stats;
  const metrics = [
    ['Total chunks', stats.totalChunks],
    ['Regions', stats.totalRegions],
    ['Players', stats.players],
    ['Structures', stats.structures]
  ];

  elements.statsGrid.innerHTML = metrics.map(([label, value]) => `
    <article class="metric glass">
      <span>${escapeHtml(label)}</span>
      <strong>${formatNumber(value)}</strong>
    </article>
  `).join('');
}

function renderTable() {
  const rows = getTableRows();
  const query = elements.tableSearch.value.trim().toLowerCase();
  const filteredRows = query
    ? rows.filter((row) => Object.values(row).some((value) => String(value ?? '').toLowerCase().includes(query)))
    : rows;

  const columns = getColumns(state.activeTable);
  elements.tableHead.innerHTML = `<tr>${columns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join('')}</tr>`;
  elements.tableBody.innerHTML = filteredRows.slice(0, 1000).map((row) => `
    <tr>${columns.map((column) => `<td>${escapeHtml(row[column.key] ?? 'n/a')}</td>`).join('')}</tr>
  `).join('');
}

function getTableRows() {
  const data = state.analysis || emptyAnalysis();
  const tables = {
    structures: data.structures,
    players: data.players.map((player) => ({
      uuid: player.uuid,
      name: player.name || 'Unknown',
      x: player.position.x,
      y: player.position.y,
      z: player.position.z,
      dimension: player.position.dimension
    })),
    regions: data.regions.map((region) => ({
      file: region.file,
      x: region.x,
      z: region.z,
      dimension: region.dimension,
      chunks: region.chunkCount
    })),
    biomes: data.biomes,
    landmarks: data.landmarks
  };
  return tables[state.activeTable] || [];
}

function getColumns(table) {
  const columns = {
    structures: [
      { key: 'type', label: 'Type' },
      { key: 'x', label: 'X' },
      { key: 'z', label: 'Z' },
      { key: 'dimension', label: 'Dimension' },
      { key: 'confidence', label: 'Confidence' },
      { key: 'source', label: 'Source' }
    ],
    players: [
      { key: 'name', label: 'Name' },
      { key: 'uuid', label: 'UUID' },
      { key: 'x', label: 'X' },
      { key: 'y', label: 'Y' },
      { key: 'z', label: 'Z' },
      { key: 'dimension', label: 'Dimension' }
    ],
    regions: [
      { key: 'file', label: 'File' },
      { key: 'x', label: 'Region X' },
      { key: 'z', label: 'Region Z' },
      { key: 'dimension', label: 'Dimension' },
      { key: 'chunks', label: 'Chunks' }
    ],
    biomes: [
      { key: 'name', label: 'Name' },
      { key: 'source', label: 'Source' }
    ],
    landmarks: [
      { key: 'name', label: 'Name' },
      { key: 'source', label: 'Source' }
    ]
  };
  return columns[table] || [];
}

function resizeCanvas() {
  const rect = elements.canvas.getBoundingClientRect();
  elements.canvas.width = Math.max(1, Math.floor(rect.width * devicePixelRatio));
  elements.canvas.height = Math.max(1, Math.floor(rect.height * devicePixelRatio));
  drawMap();
}

function resetMapView() {
  const chunks = state.analysis?.chunks || [];
  if (!chunks.length) return;
  const bounds = state.analysis.stats.bounds;
  const width = Math.max(1, bounds.maxX - bounds.minX);
  const height = Math.max(1, bounds.maxZ - bounds.minZ);
  const rect = elements.canvas.getBoundingClientRect();
  state.map.scale = Math.max(0.5, Math.min(14, Math.min(rect.width / width, rect.height / height) * 0.68));
  state.map.offsetX = -((bounds.minX + bounds.maxX) / 2) * state.map.scale * devicePixelRatio;
  state.map.offsetZ = -((bounds.minZ + bounds.maxZ) / 2) * state.map.scale * devicePixelRatio;
}

function drawMap() {
  const canvas = elements.canvas;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGridBackground();

  if (!state.analysis) {
    elements.mapHud.textContent = 'Upload a world to initialize the observatory.';
    return;
  }

  const centerX = canvas.width / 2 + state.map.offsetX;
  const centerZ = canvas.height / 2 + state.map.offsetZ;
  const scale = state.map.scale * devicePixelRatio;
  const layer = elements.layerSelect.value;

  for (const chunk of state.analysis.chunks) {
    const x = chunk.x * scale + centerX;
    const z = chunk.z * scale + centerZ;
    const size = Math.max(1, scale);
    if (x < -size || z < -size || x > canvas.width + size || z > canvas.height + size) continue;

    ctx.fillStyle = chunkColor(chunk, layer);
    ctx.fillRect(x, z, size, size);

    if (scale >= 7) {
      ctx.strokeStyle = 'rgba(194,255,238,0.13)';
      ctx.strokeRect(x, z, size, size);
    }
  }

  if (layer === 'structures') {
    drawStructures(centerX, centerZ, scale);
  }

  elements.mapHud.textContent = `${state.analysis.world.name} | ${formatNumber(state.analysis.stats.totalChunks)} chunks | ${layer} | zoom ${state.map.scale.toFixed(1)}x`;
}

function drawGridBackground() {
  ctx.fillStyle = '#020606';
  ctx.fillRect(0, 0, elements.canvas.width, elements.canvas.height);
  ctx.strokeStyle = 'rgba(98,247,255,0.045)';
  ctx.lineWidth = 1;
  const step = 48 * devicePixelRatio;
  for (let x = 0; x < elements.canvas.width; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, elements.canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y < elements.canvas.height; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(elements.canvas.width, y);
    ctx.stroke();
  }
}

function chunkColor(chunk, layer) {
  if (layer === 'heat') {
    return `rgba(37, 242, 166, ${Math.min(0.95, Math.max(0.18, chunk.activity / 100))})`;
  }
  if (layer === 'ownership') {
    if (chunk.dimension?.includes('nether')) return '#ff5470';
    if (chunk.dimension?.includes('end')) return '#a88cff';
    return '#25f2a6';
  }
  if (layer === 'biome') return chunk.x % 3 === 0 ? '#29e3c1' : chunk.z % 5 === 0 ? '#5dff96' : '#37a6ff';
  if (layer === 'height') return `rgb(${40 + chunk.sectors * 12}, ${100 + chunk.sectors * 8}, ${110 + chunk.sectors * 6})`;
  if (layer === 'density') return chunk.sectors > 2 ? '#62f7ff' : '#0d6f5f';
  if (layer === 'underground') return chunk.sectors > 3 ? '#b6ff6b' : '#18433a';
  if (layer === 'structures') return 'rgba(48, 180, 135, 0.42)';
  return '#21c88a';
}

function drawStructures(centerX, centerZ, scale) {
  ctx.fillStyle = '#62f7ff';
  ctx.strokeStyle = 'rgba(2, 16, 13, 0.9)';
  ctx.lineWidth = 2 * devicePixelRatio;

  for (const structure of state.analysis.structures) {
    if (structure.x == null || structure.z == null) continue;
    const x = (structure.x / 16) * scale + centerX;
    const z = (structure.z / 16) * scale + centerZ;
    ctx.beginPath();
    ctx.arc(x, z, 6 * devicePixelRatio, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
}

function goToCoordinate() {
  const match = elements.coordinateInput.value.match(/(-?\d+)\s*,?\s*(-?\d+)/);
  if (!match) return;
  const chunkX = Number(match[1]);
  const chunkZ = Number(match[2]);
  const scale = state.map.scale * devicePixelRatio;
  state.map.offsetX = -chunkX * scale;
  state.map.offsetZ = -chunkZ * scale;
  drawMap();
}

elements.canvas.addEventListener('wheel', (event) => {
  event.preventDefault();
  const delta = event.deltaY < 0 ? 1.16 : 0.86;
  state.map.scale = Math.max(0.35, Math.min(40, state.map.scale * delta));
  drawMap();
}, { passive: false });

elements.canvas.addEventListener('pointerdown', (event) => {
  state.map.drag = {
    x: event.clientX,
    y: event.clientY,
    offsetX: state.map.offsetX,
    offsetZ: state.map.offsetZ
  };
  elements.canvas.setPointerCapture(event.pointerId);
});

elements.canvas.addEventListener('pointermove', (event) => {
  if (!state.map.drag) return;
  state.map.offsetX = state.map.drag.offsetX + (event.clientX - state.map.drag.x) * devicePixelRatio;
  state.map.offsetZ = state.map.drag.offsetZ + (event.clientY - state.map.drag.y) * devicePixelRatio;
  drawMap();
});

elements.canvas.addEventListener('pointerup', () => {
  state.map.drag = null;
});

function downloadFromExport(kind) {
  if (!state.exports?.[kind]) return;
  window.location.href = state.exports[kind];
}

function setStatus(title, detail) {
  elements.statusTitle.textContent = title;
  elements.statusDetail.textContent = detail;
}

function emptyAnalysis() {
  return {
    structures: [],
    players: [],
    regions: [],
    biomes: [],
    landmarks: []
  };
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(value >= 100 ? 0 : 1)} ${units[index]}`;
}

function formatNumber(value) {
  return new Intl.NumberFormat().format(value || 0);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

new ResizeObserver(resizeCanvas).observe(elements.canvas);
resizeCanvas();
renderTable();
