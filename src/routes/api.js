import fs from 'node:fs/promises';
import path from 'node:path';
import { Worker } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';
import { config } from '../config.js';
import { toHttpError, RegionError } from '../lib/errors.js';
import { persistMultipartUpload } from '../services/uploadService.js';
import { expandUploads } from '../services/archiveService.js';

const workerPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'workers', 'analyzeWorker.js');
const jobs = new Map();

export async function registerApiRoutes(app) {
  app.post('/api/analyze', async (request, reply) => {
    try {
      const upload = await persistMultipartUpload(request);
      const expanded = await expandUploads(upload);
      const job = {
        id: upload.jobId,
        status: 'running',
        createdAt: new Date().toISOString(),
        upload: {
          files: upload.savedFiles.length,
          bytes: upload.totalBytes,
          extractedCount: expanded.extractedCount
        }
      };

      jobs.set(upload.jobId, job);
      runAnalysisWorker(upload.jobId, expanded.roots);

      return reply.code(202).send({ jobId: upload.jobId, status: job.status });
    } catch (error) {
      const httpError = toHttpError(error);
      return reply.code(httpError.statusCode).send(httpError.body);
    }
  });

  app.get('/api/jobs/:jobId', async (request, reply) => {
    const job = jobs.get(request.params.jobId);
    if (!job) return reply.code(404).send({ error: 'Analysis job not found' });
    return reply.send(job);
  });

  app.get('/api/reports/:jobId/:fileName', async (request, reply) => {
    try {
      const { jobId, fileName } = request.params;
      if (!/^[a-z0-9.-]+$/i.test(fileName)) {
        throw new RegionError('Invalid report file name', 400);
      }

      const filePath = path.join(config.storage.reports, jobId, fileName);
      await fs.access(filePath);
      return reply.sendFile(fileName, path.join(config.storage.reports, jobId));
    } catch (error) {
      const httpError = toHttpError(error);
      return reply.code(httpError.statusCode).send(httpError.body);
    }
  });
}

function runAnalysisWorker(jobId, roots) {
  const worker = new Worker(workerPath, {
    workerData: { jobId, roots }
  });

  worker.on('message', (message) => {
    const job = jobs.get(jobId);
    if (!job) return;

    if (message.ok) {
      jobs.set(jobId, {
        ...job,
        status: 'complete',
        completedAt: new Date().toISOString(),
        analysis: message.analysis,
        exports: message.exports
      });
      return;
    }

    jobs.set(jobId, {
      ...job,
      status: 'failed',
      failedAt: new Date().toISOString(),
      error: message.error
    });
  });

  worker.on('error', (error) => {
    const job = jobs.get(jobId);
    jobs.set(jobId, {
      ...job,
      status: 'failed',
      failedAt: new Date().toISOString(),
      error: { message: error.message }
    });
  });
}
