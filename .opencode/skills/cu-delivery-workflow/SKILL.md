---
name: cu-delivery-workflow
description: Use when working on a CU, OpenSpec change, /opsx:propose, /opsx:apply, /opsx:verify, /opsx:archive, CU closure, STATUS/HANDOFF, acceptance, next-CU preparation, or questions such as "que sigue", "ya esta listo", "podemos archivar", or "que comando uso". Governs the complete Examen-SW1 delivery workflow.
---

# CU Delivery Workflow

This skill governs delivery process, not runtime implementation. Repository sources of truth override this skill when they change.

## Start Here

1. Read `AGENTS.md`, product, roadmap, `docs/STATUS.md`, and `docs/HANDOFF.md`.
2. Confirm the active CU, active OpenSpec change, prior-CU dependencies, and worktree state.
3. Read [lifecycle.md](references/lifecycle.md) and the reference for the current phase.
4. Load specialized skills only when the CU needs them; this skill coordinates them.

## Non-Negotiable Gates

- One active CU and one primary OpenSpec change at a time.
- Do not implement during propose. Do not archive, commit, or push during apply unless explicitly instructed to close the CU.
- Do not move directly from apply to archive. Verify, resolve blockers, and obtain final user acceptance first.
- Tests, typecheck, lint, build, or HTTP 200 alone do not prove a UI works.
- State results precisely: `Passed`, `Failed`, `Not run`, or `Pending manual verification`.

## Phase References

- [Lifecycle and routing](references/lifecycle.md)
- [Propose](references/propose-phase.md)
- [Apply](references/apply-phase.md)
- [Verification](references/verification-phase.md)
- [Browser acceptance](references/browser-acceptance.md)
- [Archive and Git](references/archive-and-git.md)
- [Corrections](references/correction-policy.md)
- [Handoff and context](references/handoff-and-context.md)
- [Model selection](references/model-selection.md)

## Definition Of Done

A CU is complete only after applicable implementation, automated checks, functional acceptance, real-browser evidence for UI work, documentation, complete OpenSpec artifacts, verification with zero blockers, user acceptance, archive, commit, push, and a clean working tree.
