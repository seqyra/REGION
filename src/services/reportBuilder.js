import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';

export async function writeReportFiles(jobId, analysis) {
  const reportDir = path.join(config.storage.reports, jobId);
  await fs.mkdir(reportDir, { recursive: true });

  const jsonPath = path.join(reportDir, 'analysis.json');
  const statsPath = path.join(reportDir, 'statistics.json');
  const htmlPath = path.join(reportDir, 'region-viewer.html');

  await fs.writeFile(jsonPath, JSON.stringify(analysis, null, 2));
  await fs.writeFile(statsPath, JSON.stringify(analysis.stats, null, 2));
  await fs.writeFile(htmlPath, buildStandaloneHtml(analysis));

  return {
    json: `/api/reports/${jobId}/analysis.json`,
    statistics: `/api/reports/${jobId}/statistics.json`,
    html: `/api/reports/${jobId}/region-viewer.html`
  };
}

export function buildStandaloneHtml(analysis) {
  const embedded = JSON.stringify(analysis).replace(/</g, '\\u003c');
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>REGION Viewer - ${escapeHtml(analysis.world.name)}</title>
  <style>${standaloneCss()}</style>
</head>
<body>
  <main class="shell">
    <aside class="panel">
      <div class="brand">REGION</div>
      <div class="subtitle">Standalone Minecraft Geographic Intelligence Viewer</div>
      <div class="stat-grid">
        <div><span>Total chunks</span><strong>${analysis.stats.totalChunks}</strong></div>
        <div><span>Regions</span><strong>${analysis.stats.totalRegions}</strong></div>
        <div><span>Players</span><strong>${analysis.stats.players}</strong></div>
        <div><span>Structures</span><strong>${analysis.stats.structures}</strong></div>
      </div>
      <label>Layer <select id="layer">
        <option value="terrain">Terrain</option>
        <option value="heat">Exploration heatmap</option>
        <option value="density">Density</option>
        <option value="structures">Structures</option>
        <option value="ownership">Chunk ownership</option>
      </select></label>
      <input id="search" placeholder="Search coordinates, players, structures">
      <div id="results" class="results"></div>
    </aside>
    <section class="map-wrap">
      <canvas id="map"></canvas>
      <div class="hud" id="hud">Pan with drag. Zoom with wheel.</div>
    </section>
  </main>
  <script>window.REGION_ANALYSIS=${embedded};</script>
  <script>${standaloneJs()}</script>
</body>
</html>`;
}

function standaloneCss() {
  return `
*{box-sizing:border-box}body{margin:0;background:#030707;color:#e8fff7;font-family:Inter,Segoe UI,Arial,sans-serif}.shell{min-height:100vh;display:grid;grid-template-columns:360px 1fr;background:radial-gradient(circle at 20% 10%,rgba(0,255,190,.16),transparent 34%),linear-gradient(135deg,#020303,#0b1111 55%,#031713)}.panel{padding:24px;border-right:1px solid rgba(77,255,218,.18);background:rgba(8,16,17,.72);backdrop-filter:blur(18px)}.brand{font-size:34px;font-weight:900;letter-spacing:.14em;color:#58ffd0}.subtitle{color:#91bdb3;margin:8px 0 24px}.stat-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px}.stat-grid div{border:1px solid rgba(94,255,210,.2);background:rgba(255,255,255,.045);border-radius:8px;padding:14px}.stat-grid span{display:block;color:#8eb5ad;font-size:12px}.stat-grid strong{font-size:24px}select,input{width:100%;margin:8px 0 16px;padding:12px;border-radius:8px;border:1px solid rgba(94,255,210,.22);background:#071111;color:#e8fff7}.map-wrap{position:relative;overflow:hidden}canvas{width:100%;height:100%;display:block}.hud{position:absolute;left:18px;bottom:18px;background:rgba(3,8,8,.74);border:1px solid rgba(94,255,210,.24);border-radius:8px;padding:10px 12px;color:#bfffea}.results{max-height:42vh;overflow:auto}.result{padding:10px;border-bottom:1px solid rgba(255,255,255,.08);color:#d8fff6}@media(max-width:860px){.shell{grid-template-columns:1fr}.panel{border-right:0;border-bottom:1px solid rgba(77,255,218,.18)}.map-wrap{height:70vh}}`;
}

function standaloneJs() {
  return `
const data=window.REGION_ANALYSIS;const canvas=document.getElementById('map');const ctx=canvas.getContext('2d');const layer=document.getElementById('layer');const hud=document.getElementById('hud');let scale=4,ox=0,oz=0,drag=null;function resize(){canvas.width=canvas.clientWidth*devicePixelRatio;canvas.height=canvas.clientHeight*devicePixelRatio;draw()}addEventListener('resize',resize);function color(c){if(layer.value==='heat')return 'rgba(0,255,190,'+Math.min(.95,(c.activity||1)/80)+')';if(layer.value==='density')return c.sectors>2?'#18ffd1':'#0f6f62';if(layer.value==='ownership')return c.dimension&&c.dimension.includes('nether')?'#ff4d6d':c.dimension&&c.dimension.includes('end')?'#b983ff':'#28f0a5';return '#1ecf8e'}function draw(){ctx.clearRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#020707';ctx.fillRect(0,0,canvas.width,canvas.height);const cx=canvas.width/2+ox,cz=canvas.height/2+oz;for(const c of data.chunks){const x=c.x*scale+cx,z=c.z*scale+cz;if(x<-20||z<-20||x>canvas.width+20||z>canvas.height+20)continue;ctx.fillStyle=color(c);ctx.fillRect(x,z,Math.max(1,scale),Math.max(1,scale));if(scale>=7){ctx.strokeStyle='rgba(180,255,235,.12)';ctx.strokeRect(x,z,scale,scale)}}if(layer.value==='structures'){ctx.fillStyle='#7df9ff';for(const s of data.structures){if(s.x==null||s.z==null)continue;ctx.beginPath();ctx.arc(s.x/16*scale+cx,s.z/16*scale+cz,5,0,Math.PI*2);ctx.fill()}}hud.textContent='Chunks '+data.stats.totalChunks+' | Scale '+scale.toFixed(1)+' | '+layer.value}canvas.addEventListener('wheel',e=>{e.preventDefault();scale=Math.max(.6,Math.min(28,scale+(e.deltaY<0?1:-1)));draw()},{passive:false});canvas.addEventListener('pointerdown',e=>drag={x:e.clientX,y:e.clientY,ox,oz});canvas.addEventListener('pointermove',e=>{if(!drag)return;ox=drag.ox+((e.clientX-drag.x)*devicePixelRatio);oz=drag.oz+((e.clientY-drag.y)*devicePixelRatio);draw()});canvas.addEventListener('pointerup',()=>drag=null);layer.addEventListener('change',draw);document.getElementById('search').addEventListener('input',e=>{const q=e.target.value.toLowerCase();const rows=[...data.players.map(p=>({kind:'Player',label:p.name||p.uuid,x:p.position.x,z:p.position.z})),...data.structures.map(s=>({kind:'Structure',label:s.type,x:s.x,z:s.z}))].filter(r=>(r.label||'').toLowerCase().includes(q)).slice(0,60);document.getElementById('results').innerHTML=rows.map(r=>'<div class="result"><b>'+r.kind+'</b> '+(r.label||'Unknown')+'<br>X '+(r.x??'n/a')+' Z '+(r.z??'n/a')+'</div>').join('')});resize();`;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
