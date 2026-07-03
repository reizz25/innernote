# Local Companion Journal Design

## Goal

Build a first usable local diary app for a few days of real use. It should feel like a clean Feishu-style document, while giving Codex a vivid companion role through summaries, inline highlights, comments, and retained conversations.

## Product Shape

- Left side is a date archive, not a feature menu.
- The app creates or opens the current day automatically based on the first local record time.
- The center page is a calm document view with a top companion summary area, light prompts, and a free writing area.
- The right side is interactive: comments, pattern notes, hidden strengths, small action suggestions, and a chat box.
- A user can save a conversation with Codex into the current diary day. The saved conversation gets a short summary.
- Weekly and monthly summaries appear as archive items and are generated from local entries.

## Companion Role

Codex should be warm and direct, not a praise machine. It acts like a friend, lover, family member, and coach in one product voice: intimate but bounded, honest but not controlling.

Feedback principles:

- Find patterns without judging the user.
- Ask questions without controlling the user.
- Name obstacles and hidden strengths.
- Suggest small actions instead of vague encouragement.

## Local Data And Backup

- Browser storage is the primary working copy for the first version.
- A local Node server writes timely backups to the desktop folder `InnerNotesBackup`.
- Backups include daily Markdown, daily JSON, saved conversation summaries, and weekly/monthly summary files.
- If the backup server is not running, the app keeps browser data and shows that desktop backup is waiting.

## First Version Scope

- Deterministic local analysis, not cloud AI.
- No login, sync, or remote storage.
- No rich text editor beyond a clean textarea and rendered highlights.
- Browser notification reminders are configurable but only reliable while the app is open.
- Codex-side recurring reminders can be added separately with daily automation.

