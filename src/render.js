import { spawn } from "node:child_process";
import { mkdtemp, writeFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const RENDER_TIMEOUT_MS = Number(process.env.RENDER_TIMEOUT_MS || 30_000);
const MAX_OUTPUT_BYTES = Number(process.env.MAX_OUTPUT_BYTES || 50 * 1024 * 1024); // 50MB

/**
 * Renders a fully-built Csound .csd (a template with score events already
 * substituted in — see src/templates.js) to a WAV file inside an isolated
 * temp dir. Enforces a hard wall-clock timeout and an output size cap so a
 * runaway render can't hang or fill the container.
 *
 * @param {string} csd - complete .csd document text
 * @returns {Promise<{outputPath: string, cleanup: () => Promise<void>, log: string}>}
 */
export async function renderCsound(csd) {
  const dir = await mkdtemp(path.join(tmpdir(), "csound-job-"));
  const csdPath = path.join(dir, "job.csd");
  const outPath = path.join(dir, "out.wav");

  await writeFile(csdPath, csd, "utf8");

  const cleanup = () => rm(dir, { recursive: true, force: true });

  let log = "";
  try {
    await runCsound(csdPath, outPath, dir, (chunk) => {
      log += chunk;
    });
  } catch (err) {
    await cleanup();
    throw Object.assign(err, { log });
  }

  const info = await stat(outPath).catch(() => null);
  if (!info) {
    await cleanup();
    throw Object.assign(new Error("Csound did not produce output audio"), { log });
  }
  if (info.size > MAX_OUTPUT_BYTES) {
    await cleanup();
    throw Object.assign(new Error("Rendered output exceeded size limit"), { log });
  }

  return { outputPath: outPath, cleanup, log };
}

function runCsound(csdPath, outPath, cwd, onOutput) {
  return new Promise((resolve, reject) => {
    const proc = spawn(
      "csound",
      ["-o", outPath, csdPath],
      { cwd, stdio: ["ignore", "pipe", "pipe"] }
    );

    let killedForTimeout = false;
    const timer = setTimeout(() => {
      killedForTimeout = true;
      proc.kill("SIGKILL");
    }, RENDER_TIMEOUT_MS);

    proc.stdout.on("data", (d) => onOutput(d.toString()));
    proc.stderr.on("data", (d) => onOutput(d.toString()));

    proc.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });

    proc.on("close", (code) => {
      clearTimeout(timer);
      if (killedForTimeout) {
        reject(new Error(`Render timed out after ${RENDER_TIMEOUT_MS}ms`));
        return;
      }
      if (code !== 0) {
        reject(new Error(`csound exited with code ${code}`));
        return;
      }
      resolve();
    });
  });
}
