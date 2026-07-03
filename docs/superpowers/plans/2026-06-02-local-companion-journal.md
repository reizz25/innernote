# Local Companion Journal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local diary app with automatic date archiving, companion comments, retained chat summaries, local browser persistence, and desktop backups.

**Architecture:** Use a dependency-free static frontend plus a small local Node server. Keep pure behavior in `src/journal-core.js` so date archiving, summaries, analysis, and export formatting can be tested with Node's built-in test runner.

**Tech Stack:** HTML, CSS, browser JavaScript modules, Node `http`, Node `node:test`, `localStorage`, local filesystem backup API.

---

### Task 1: Core Behavior

**Files:**
- Create: `src/journal-core.js`
- Create: `test/journal-core.test.mjs`

- [ ] Write failing tests for automatic date entry creation, companion analysis, conversation summary, weekly/monthly summaries, and backup documents.
- [ ] Run `node --test test/journal-core.test.mjs` and confirm failures are caused by missing implementation.
- [ ] Implement the minimal pure functions in `src/journal-core.js`.
- [ ] Run `node --test test/journal-core.test.mjs` and confirm passing output.

### Task 2: App UI

**Files:**
- Create: `index.html`
- Create: `src/styles.css`
- Create: `src/app.js`

- [ ] Build the three-pane layout from the approved mockup.
- [ ] Connect local storage, date archive, editor save, analysis comments, retained chat summaries, and summary generation.
- [ ] Add backup status UI and call `POST /api/backup` after saves.
- [ ] Add reminder setting UI using browser notifications while the app is open.

### Task 3: Backup Server

**Files:**
- Create: `server.mjs`
- Create: `package.json`

- [ ] Serve the static app on localhost.
- [ ] Implement `POST /api/backup` to write daily Markdown, daily JSON, conversation summaries, and weekly/monthly summaries to `~/Desktop/InnerNotesBackup`.
- [ ] Add npm scripts for `test` and `start`.

### Task 4: Verification

- [ ] Run `npm test`.
- [ ] Start the server.
- [ ] Open the app and verify the UI loads.
- [ ] Save an entry, retain a chat, generate summaries, and verify backup status.

