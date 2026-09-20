import express from "express";
import { nanoid } from "nanoid";
import fs from "node:fs";
import { createJob, getJob } from "./queue.js";
import { listTemplates, getTemplateSchema, buildCsdForJob } from "./templates.js";

const app = express();
app.use(express.json({ limit: "256kb" }));

app.get("/health", (_req, res) => res.json({ ok: true }));

app.get("/templates", (_req, res) => {
  res.json({ templates: listTemplates() });
});

app.get("/templates/:id", (req, res) => {
  const schema = getTemplateSchema(req.params.id);
  if (!schema) return res.status(404).json({ error: `unknown template "${req.params.id}"` });
  res.json(schema);
});

app.post("/jobs", (req, res) => {
  const { template, events } = req.body || {};

  if (typeof template !== "string" || template.trim() === "") {
    return res.status(400).json({ error: "template must be a non-empty string" });
  }

  let csd;
  try {
    csd = buildCsdForJob(template, events);
  } catch (err) {
    return res.status(err.status || 400).json({ error: err.message });
  }

  const id = nanoid(12);
  const job = createJob(id, csd);
  res.status(202).json({ id: job.id, status: job.status });
});

app.get("/jobs/:id", (req, res) => {
  const job = getJob(req.params.id);
  if (!job) return res.status(404).json({ error: "job not found" });

  res.json({
    id: job.id,
    status: job.status,
    error: job.error,
    log: job.log,
    createdAt: job.createdAt,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
    audioUrl: job.status === "done" ? `/jobs/${job.id}/audio` : null,
  });
});

app.get("/jobs/:id/audio", (req, res) => {
  const job = getJob(req.params.id);
  if (!job) return res.status(404).json({ error: "job not found" });
  if (job.status !== "done" || !job.outputPath) {
    return res.status(409).json({ error: `job is ${job.status}, not ready` });
  }
  if (!fs.existsSync(job.outputPath)) {
    return res.status(410).json({ error: "audio has expired" });
  }
  res.sendFile(job.outputPath, { headers: { "Content-Type": "audio/wav" } }, (err) => {
    if (err && !res.headersSent) res.status(500).json({ error: "failed to send audio" });
  });
});

const port = Number(process.env.PORT || 8080);
app.listen(port, () => {
  console.log(`csound-service listening on :${port}`);
});
