# Exterminator API

Base URL: `http://localhost:4000` (configurable via `PORT` env var)

---

## Endpoints

### `POST /api/runs`

Start a new bug-fix run. Only one run can be active at a time.

**Request body** (JSON):

| Field             | Type   | Required | Description                          |
|-------------------|--------|----------|--------------------------------------|
| `stack_trace`     | string | yes      | Error stack trace from Sentry / browser SDK |
| `app_url`         | string | yes      | URL of the running app to test against |
| `source_dir`      | string | yes      | Absolute path to the app's source code |
| `app_description` | string | no       | Short description of what the app does |

**Response `201`:**

```json
{ "runId": "a1b2c3d4", "status": "in_progress" }
```

**Response `400`:** missing required fields.

**Response `409`:** a run is already in progress.

---

### `GET /api/runs/current`

Get the status of the current (or most recently completed) run.

**Response `200`:**

```json
{
  "active": true,
  "running": true,
  "runId": "a1b2c3d4",
  "context": { /* full RunContext — see schema below */ },
  "error": null
}
```

When no run is active:

```json
{ "active": false, "running": false, "runId": null, "context": null, "error": null }
```

| Field     | Type            | Meaning                                              |
|-----------|-----------------|------------------------------------------------------|
| `active`  | boolean         | Whether a run ID is tracked (active or recently finished) |
| `running` | boolean         | Whether the pipeline loop is currently executing      |
| `runId`   | string \| null  | The run ID, if any                                   |
| `context` | object \| null  | Full `RunContext` JSON from the shared state file     |
| `error`   | string \| null  | Error message if the pipeline crashed                |

---

### `DELETE /api/runs/current`

Stop the running pipeline and reset. Kills the active child process (if any)
and clears the tracked run so a new one can be started.

**Response `200`:**

```json
{ "stopped": true, "runId": "a1b2c3d4" }
```

**Response `404`:** no active run to stop.

---

### `GET /api/runs/:runId`

Retrieve the full state file for any run by ID (including past runs).

**Response `200`:** the `RunContext` JSON.

**Response `404`:** no run with that ID.

---

### `GET /api/runs`

List all runs on disk, sorted newest first.

**Response `200`:**

```json
[
  { "id": "a1b2c3d4", "mtime": "2026-03-01T01:23:45.000Z" },
  { "id": "e61b75f0", "mtime": "2026-02-28T12:00:00.000Z" }
]
```

---

### `GET /`

Serves the control interface (single-page HTML dashboard).

---

## RunContext Schema

The shared state file written to `runner/runs/{runId}.json`. Both the Node
server and the Python runner scripts read and write this file.

```jsonc
{
  "runId": "a1b2c3d4",
  "createdAt": "2026-03-01T00:19:28.435Z",
  "status": "in_progress",          // "in_progress" | "fixed" | "failed"
  "input": {
    "stack_trace": "TypeError: ...",
    "app_url": "http://localhost:3000",
    "app_description": "...",
    "source_dir": "/path/to/source"
  },
  "reproduce": {                     // null until reproduce agent finishes
    "reproduced": true,
    "error_message": "TypeError: ...",
    "steps": [ /* ordered browser actions */ ],
    "browser_logs": [ /* console output */ ],
    "notes": "..."
  },
  "attempts": [
    {
      "n": 1,
      "fix": {                       // null until fix agent finishes
        "summary": "Added null check...",
        "changed_files": ["index.html"]
      },
      "validate": {                  // null until validate agent finishes
        "fixed": false,
        "verdict": "error_persists", // "resolved"|"error_persists"|"regression"|"partial_fix"
        "verdict_reason": "...",
        "original_error_seen": true,
        "steps": [],
        "browser_logs": [],
        "new_errors": [],
        "notes": ""
      }
    }
  ],
  "resolvedAtAttempt": null,         // attempt number if fixed, else null
  "progress": {
    "currentAgent": "reproduce",     // "reproduce" | "fix" | "validate" | null
    "phase": "running",              // "idle" | "running" | "done" | "error"
    "currentStep": 3,
    "currentGoal": "clicking View Profile button",
    "lastUpdatedAt": "2026-03-01T00:19:40.695Z",
    "log": [
      {
        "ts": "2026-03-01T00:19:31.070Z",
        "agent": "reproduce",
        "message": "reproduce agent started",
        "step": null,
        "detail": null
      }
    ]
  }
}
```

## Pipeline Flow

```
POST /api/runs  →  reproduce  →  fix  →  validate
                                  ↑         ↓
                                  └── if not fixed (up to 5 attempts)
```

Termination conditions:

| Condition                        | Result            |
|----------------------------------|-------------------|
| `reproduce.reproduced == false`  | Stops — can't reproduce |
| `status == "fixed"`              | Done — bug resolved |
| `status == "failed"`             | Done — gave up    |
| 5 attempts exhausted             | Done — gave up    |
