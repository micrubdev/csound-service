import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = process.env.TEMPLATES_DIR || path.join(__dirname, "..", "templates");
const MAX_EVENTS = Number(process.env.MAX_EVENTS_PER_JOB || 200);
const SCORE_MARKER = "; TEMPLATE_EVENTS";
const EFFECTS_TAIL_MARKER = "; TEMPLATE_EFFECTS_TAIL";
const EFFECTS_TAIL_SECONDS = 3; // let delay/reverb tails ring out past the last note

/**
 * Loads every templates/<id>.json manifest + its paired .csd at startup.
 * Templates are the ONLY way to render audio: users submit numeric params
 * against a known field schema, never raw orchestra/score text, so there's
 * no arbitrary-code-execution surface even before --sandbox kicks in.
 */
const templates = new Map();

function loadTemplates() {
  const files = readdirSync(TEMPLATES_DIR).filter((f) => f.endsWith(".json"));
  for (const file of files) {
    const manifest = JSON.parse(readFileSync(path.join(TEMPLATES_DIR, file), "utf8"));
    validateManifest(manifest, file);
    const csd = readFileSync(path.join(TEMPLATES_DIR, manifest.csd), "utf8");
    if (!csd.includes(SCORE_MARKER)) {
      throw new Error(`Template "${manifest.id}" .csd is missing the ${SCORE_MARKER} marker`);
    }
    templates.set(manifest.id, { manifest, csd });
  }
}

function validateManifest(manifest, file) {
  if (!manifest.id || !manifest.csd || !Number.isInteger(manifest.instrNum)) {
    throw new Error(`Template manifest ${file} missing id/csd/instrNum`);
  }
  if (!Array.isArray(manifest.fields)) {
    throw new Error(`Template manifest ${file} missing fields[]`);
  }
  for (const f of manifest.fields) {
    if (!f.name || !Number.isInteger(f.pfield) || f.pfield < 4) {
      throw new Error(`Template ${manifest.id} field "${f.name}" needs a name and pfield >= 4`);
    }
  }
}

export function listTemplates() {
  return [...templates.values()].map(({ manifest }) => ({
    id: manifest.id,
    name: manifest.name,
    fields: manifest.fields.map(({ name, type, default: d, min, max }) => ({
      name, type, default: d, min, max,
    })),
  }));
}

export function getTemplateSchema(id) {
  const t = templates.get(id);
  return t ? templates.get(id).manifest : null;
}

/**
 * Validates a job request's events against a template's field schema and
 * builds the final .csd text with generated score lines substituted for
 * the marker. Throws a ValidationError (with `.status = 400`) on any bad
 * input so the route handler can return it directly.
 */
export function buildCsdForJob(templateId, events) {
  const entry = templates.get(templateId);
  if (!entry) throw badRequest(`unknown template "${templateId}"`, 404);

  if (!Array.isArray(events) || events.length === 0) {
    throw badRequest("events must be a non-empty array");
  }
  if (events.length > MAX_EVENTS) {
    throw badRequest(`events exceeds max of ${MAX_EVENTS}`);
  }

  const { manifest, csd } = entry;
  const fieldsByName = new Map(manifest.fields.map((f) => [f.name, f]));

  const lines = events.map((event, i) => buildScoreLine(manifest, fieldsByName, event, i));

  let result = csd.replace(SCORE_MARKER, lines.join("\n"));
  if (result.includes(EFFECTS_TAIL_MARKER)) {
    const maxEnd = events.reduce((max, e) => Math.max(max, (e.start || 0) + (e.dur || 0)), 0);
    const tailLine = Number.isInteger(manifest.effectsInstr)
      ? `i${manifest.effectsInstr} 0 ${(maxEnd + EFFECTS_TAIL_SECONDS).toFixed(3)}`
      : "";
    result = result.replace(EFFECTS_TAIL_MARKER, tailLine);
  }
  return result;
}

function buildScoreLine(manifest, fieldsByName, event, index) {
  if (typeof event !== "object" || event === null) {
    throw badRequest(`events[${index}] must be an object`);
  }
  const { start, dur, ...params } = event;
  if (typeof start !== "number" || !Number.isFinite(start) || start < 0) {
    throw badRequest(`events[${index}].start must be a non-negative number`);
  }
  if (typeof dur !== "number" || !Number.isFinite(dur) || dur <= 0) {
    throw badRequest(`events[${index}].dur must be a positive number`);
  }

  for (const key of Object.keys(params)) {
    if (!fieldsByName.has(key)) {
      throw badRequest(`events[${index}] has unknown param "${key}"`);
    }
  }

  const maxPfield = Math.max(3, ...manifest.fields.map((f) => f.pfield));
  const pfields = new Array(maxPfield - 3).fill(null); // slots for p4, p5, ...

  for (const field of manifest.fields) {
    const raw = Object.prototype.hasOwnProperty.call(params, field.name)
      ? params[field.name]
      : field.default;

    if (typeof raw !== "number" || !Number.isFinite(raw)) {
      throw badRequest(`events[${index}].${field.name} must be a number`);
    }
    if (field.min !== undefined && raw < field.min) {
      throw badRequest(`events[${index}].${field.name} below min ${field.min}`);
    }
    if (field.max !== undefined && raw > field.max) {
      throw badRequest(`events[${index}].${field.name} above max ${field.max}`);
    }
    pfields[field.pfield - 4] = raw;
  }

  if (pfields.some((v) => v === null)) {
    throw badRequest(`template "${manifest.id}" has a gap in its pfield mapping`);
  }

  return `i${manifest.instrNum} ${start} ${dur} ${pfields.join(" ")}`;
}

function badRequest(message, status = 400) {
  return Object.assign(new Error(message), { status });
}

loadTemplates();
