import { parentPort, workerData } from 'node:worker_threads';
import { analyzeWorldUpload } from '../services/analyzer.js';
import { writeReportFiles } from '../services/reportBuilder.js';

try {
  const analysis = await analyzeWorldUpload(workerData);
  const exports = await writeReportFiles(workerData.jobId, analysis);
  parentPort.postMessage({ ok: true, analysis, exports });
} catch (error) {
  parentPort.postMessage({
    ok: false,
    error: {
      message: error.message,
      stack: error.stack
    }
  });
}
