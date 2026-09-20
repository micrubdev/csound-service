# csound-service

Node API that renders audio from **server-side Csound templates**,
parameterized by numeric fields per event. Users never submit raw Csound
orchestra/score text — only numbers validated against a template's schema —
so there's no arbitrary-code-execution surface, on top of the `--sandbox`
mode, wall-clock timeout, and output size cap the renderer also enforces.

## Templates

Each template is a `.csd` file (`templates/<id>.csd`) plus a manifest
(`templates/<id>.json`) declaring its p-field schema:

```json
{
  "id": "pluck",
  "name": "Plucked string",
  "csd": "pluck.csd",
  "instrNum": 1,
  "fields": [
    { "name": "freq", "pfield": 4, "type": "number", "default": 440, "min": 20, "max": 20000 },
    { "name": "amp",  "pfield": 5, "type": "number", "default": 0.5, "min": 0, "max": 1 }
  ]
}
```

The `.csd`'s `<CsScore>` section must contain a `; TEMPLATE_EVENTS` marker,
which gets replaced with generated `i` score lines at render time. Ships
with two templates: `pluck` and `drone`.

## API

- `GET /templates` — list available templates and their field schemas
- `GET /templates/:id` — full schema for one template
- `POST /jobs` — body:
  ```json
  {
    "template": "pluck",
    "events": [
      { "start": 0, "dur": 1, "freq": 440, "amp": 0.5 },
      { "start": 1, "dur": 0.5, "freq": 660 }
    ]
  }
  ```
  `start`/`dur` are required per event; any template field omitted falls
  back to its manifest default. Unknown params or out-of-range values
  return `400`. Response: `{ id, status }`.
- `GET /jobs/:id` — poll status; when `status: "done"`, response includes `audioUrl`
- `GET /jobs/:id/audio` — streams the rendered WAV

## Run locally

Requires Csound installed locally (`apt install csound` / `brew install csound`).

```bash
npm install
npm start
# then:
curl localhost:8080/templates
curl -X POST localhost:8080/jobs -H 'content-type: application/json' -d '{
  "template": "pluck",
  "events": [{ "start": 0, "dur": 1, "freq": 440, "amp": 0.5 }]
}'
```

## Deploy to Fly.io (free tier)

```bash
fly launch --no-deploy     # creates the app, picks name/region interactively
fly deploy
```

`fly.toml` sets `auto_stop_machines`/`min_machines_running = 0` so the
machine scales to zero when idle, keeping it on the free allowance.

## Upgrade path

This uses a single in-process job queue (`src/queue.js`) — fine for personal,
low-concurrency use on one machine. When you outgrow it:

1. Swap `src/queue.js` for a Redis-backed queue (BullMQ) — the `Job` shape
   (`status`/`error`/`outputPath`) is already what the API expects, so the
   route handlers in `src/server.js` don't need to change.
2. Split the API and worker into separate Fly apps/processes so render load
   doesn't block request handling; scale worker instances independently.
3. Move rendered audio from local disk to object storage (Cloudflare R2 /
   Backblaze B2) and return signed URLs instead of streaming from the
   container filesystem.
4. Run each render in its own ephemeral container/VM if you need stronger
   isolation than `--sandbox` + timeout + non-root user provides.
