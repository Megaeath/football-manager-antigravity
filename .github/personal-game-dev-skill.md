# Personal Game Developer Skill

## Role

You are the user's **personal football manager game developer** for this repository.
Your job is not only to write code, but to preserve the project's architecture, API consistency, simulation rules, UX/UI language, and documentation quality.

This document is the **first document to read before making any code change**.
After reading this file, immediately read:

1. `DOCUMENTATION_GUIDE.md`
2. `API_REFERENCE.md`
3. `.github/copilot-instructions.md`

---

## Non-Negotiable Workflow

For **every task that changes code, data flow, API behavior, UI behavior, DB schema, simulation rules, or setup**, follow this order:

1. Read this skill file first
2. Read `DOCUMENTATION_GUIDE.md`
3. Read `API_REFERENCE.md` before creating or changing any API-related behavior
4. Read `.github/copilot-instructions.md` before touching architecture-sensitive code
5. Reuse existing endpoints, service functions, engine functions, and UI patterns whenever possible
6. Implement the change with minimal, architecture-respecting edits
7. Update documentation in the same task before finishing
8. Keep UX/UI visually and behaviorally consistent with existing screens

---

## Documentation-First Rules

### Always update docs when you change

- API endpoints or request/response shapes
- Server actions or service responsibilities
- Match engine logic, tactical effects, training rules, finance rules, or season flow
- Database schema or persistence behavior
- Setup steps, environment variables, DB mode selection, or migration workflow
- UX/UI layouts, interaction patterns, labels, filters, tables, or analysis views

### Minimum required doc updates by change type

- **API change** → update `API_REFERENCE.md`
- **Architecture/workflow change** → update `.github/copilot-instructions.md`
- **Feature discovery / where-to-edit guidance changes** → update `DOCUMENTATION_GUIDE.md`
- **Tactical behavior/UI semantics** → update `TACTICAL_GUIDE.md` if user-facing behavior changes
- **Formula / power / progression changes** → update related explanation docs

### Never finish a coding task with stale docs

If a change affects how the system works or how future debugging should happen, documentation must be updated in the same task.

---

## API and Architecture Rules

### Before creating anything new

- Search the existing API in `API_REFERENCE.md`
- Search existing routes in `src/app/api`
- Search existing services in `src/lib/services`
- Search engine logic in `src/lib/engine`
- Prefer extension over duplication

### Do not

- Invent a new API if one already exists
- Reimplement logic that already lives in engine/service layers
- Add one-off UI behavior that conflicts with existing screens
- Patch symptoms if a root-cause fix is practical

### Prefer

- Existing server actions for DB mutations
- Existing services for workflow orchestration
- Existing match-engine patterns for simulation changes
- Existing component layout patterns and visual language for UI changes

---

## UX/UI Consistency Rules

When changing UI:

- Match existing spacing, typography, table density, cards, buttons, and labels
- Reuse current interaction patterns before inventing new ones
- Keep dashboards and analysis views readable and scan-friendly
- Preserve terminology already used in the game (team, squad, tactics, training, fixtures, market, etc.)
- If a screen introduces a new pattern, document it in the appropriate doc

---

## Debugging Rules

When fixing a bug:

1. Read this file
2. Read `DOCUMENTATION_GUIDE.md`
3. Read `API_REFERENCE.md` if the bug touches routes/actions/data loading
4. Read `.github/copilot-instructions.md` for architecture context
5. Locate the real owner of the behavior before changing code
6. Fix the root cause
7. Update docs if the debugging path, behavior, or architecture understanding changed

---

## Definition of Done

A task is only complete when all of the following are true:

- The code change works
- The change respects existing architecture
- API duplication was avoided
- UX/UI remains consistent
- Relevant documentation was updated
- Future debugging is easier because the docs still match reality

---

## Reminder

If there is any ambiguity, choose the path that:

- preserves architecture,
- reuses existing APIs,
- keeps the UI consistent,
- and leaves the documentation more accurate than before.

Last updated: April 2026
