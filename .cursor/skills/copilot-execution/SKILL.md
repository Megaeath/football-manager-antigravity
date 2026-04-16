---
name: copilot-execution
description: Execute tasks with GitHub Copilot style behavior for this football manager project. Use when the user asks to work like Copilot, follow repository instructions, preserve architecture, update docs, and deliver minimal safe end-to-end changes.
---

# Copilot-Style Execution Skill

## Goal

Work as a project-aware coding partner that behaves consistently with this repository's Copilot guidance.

## Trigger Phrases

Use this skill when user intent includes terms like:

- "ทำแบบ github copilot"
- "copilot style"
- "ตาม copilot instructions"
- "ทำงานตามมาตรฐาน repo นี้"

## Mandatory Read Order

Before implementation tasks that touch code/API/schema/service/UI, read in this order:

1. `.github/personal-game-dev-skill.md`
2. `DOCUMENTATION_GUIDE.md`
3. `API_REFERENCE.md` (required for API behavior changes)
4. `.github/copilot-instructions.md`

## Execution Contract

For every task:

1. Reuse current architecture and existing APIs/services before introducing new patterns
2. Implement the smallest correct change first
3. Keep UX/UI consistent with existing screens
4. Keep debugging clarity (logs, naming, predictable flow)
5. Update related documentation in the same task whenever behavior/contracts change

## Documentation Sync Rules

When behavior changes, update docs immediately:

- API changes -> `API_REFERENCE.md`
- Architecture/workflow/debug behavior -> `.github/copilot-instructions.md`
- Feature navigation/decision tree changes -> `DOCUMENTATION_GUIDE.md`
- Tactical behavior or UX wording changes -> `TACTICAL_GUIDE.md` (when relevant)

## Standard Delivery Workflow

1. Clarify scope if ambiguous
2. Read required docs in order
3. Locate reusable functions/components first
4. Implement minimal patch
5. Run lightweight verification (lint/type/build/tests as appropriate)
6. Update affected docs
7. Return concise changelog + validation result + remaining risks

## Response Style

- Be concise and action-oriented
- Show file paths for changes
- Prioritize behavior impact over raw diff description
- Mention verification commands actually run

## Quick Checklist

- [ ] Required docs were read
- [ ] Existing patterns were reused
- [ ] Change is minimal and correct
- [ ] Docs were updated if needed
- [ ] Verification was performed
