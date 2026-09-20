import { rm } from "node:fs/promises";
import path from "node:path";
import { renderCsound } from "./render.js";

const CONCURRENCY = Number(process.env.WORKER_CONCURRENCY || 1);

/**
 * Minimal in-process job queue. Fine for a single free-tier container;
 * swap this module for a Redis/BullMQ-backed queue when you outgrow it —
 * the job shape (status/result/error) and the API layer don't need to change.
 */
const jobs = new Map(); // id -> job record
const pending = [];
let active = 0;

export function createJob(id, csd) {
  const job = {
    id,
    status: "queued",
    createdAt: Date.now(),
    startedAt: null,
    finishedAt: null,
    error: null,
    outputPath: null,
    log: "",
  };
  jobs.set(id, job);
  pending.push({ id, csd });
  drain();
  return job;
}

export function getJob(id) {
  return jobs.get(id);
}

function drain() {
  while (active < CONCURRENCY && pending.length > 0) {
    const { id, csd } = pending.shift();
    const job = jobs.get(id);
    if (!job) continue;
    active++;
    job.status = "running";
    job.startedAt = Date.now();

    renderCsound(csd)
      .then(({ outputPath, log }) => {
        job.status = "done";
        job.outputPath = outputPath;
        job.log = log;
        job.finishedAt = Date.now();
      })
      .catch((err) => {
        job.status = "error";
        job.error = err.message || String(err);
        job.log = err.log || job.log;
        job.finishedAt = Date.now();
      })
      .finally(() => {
        active--;
        drain();
      });
  }
}

// Prevent unbounded memory growth on a long-running free-tier instance:
// sweep finished jobs (and their temp output files) after a retention window.
const RETENTION_MS = Number(process.env.JOB_RETENTION_MS || 30 * 60 * 1000);
setInterval(() => {
  const cutoff = Date.now() - RETENTION_MS;
  for (const [id, job] of jobs) {
    if (job.finishedAt && job.finishedAt < cutoff) {
      if (job.outputPath) {
        rm(path.dirname(job.outputPath), { recursive: true, force: true }).catch(() => {});
      }
      jobs.delete(id);
    }
  }
}, 60_000).unref();
