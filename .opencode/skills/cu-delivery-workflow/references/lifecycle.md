# Lifecycle And Routing

Use the current repository documents as the authoritative roadmap. At present they list CU-03 through CU-11, but that list is informational, not a permanent rule in this skill.

## Official Lifecycle

1. Select one CU.
2. Read product sources.
3. Review dependencies from previous CUs.
4. Define scope.
5. Plan.
6. Obtain user approval.
7. Run `/opsx:propose`.
8. Review artifacts.
9. Run `/opsx:apply`.
10. Run automated tests.
11. Perform manual or E2E acceptance when applicable.
12. Correct within the same OpenSpec change.
13. Repeat relevant checks.
14. Run `/opsx:verify`.
15. Resolve blockers.
16. Obtain final user acceptance.
17. Run `/opsx:archive`.
18. Review `git status`.
19. Commit.
20. Push.
21. Confirm the working tree is clean.
22. Update `docs/HANDOFF.md` and `docs/STATUS.md` as appropriate.
23. Only then start the next CU.

Never jump from apply directly to archive.

## Skill Routing

`cu-delivery-workflow` owns phase gates and delivery evidence. Load only relevant specialist skills:

- React or Next.js: `react-next-best-practices`.
- React Flow, canvas, layout, or viewport: `react-flow-editor`.
- UML workspace visual design: `uml-editor-design`.
- UI, UX, accessibility, responsive, or acceptance review: `web-quality-audit`.
- Browser evidence, console checks, E2E, or screenshots: `webapp-e2e-testing`.

Do not load a specialist merely because a CU exists.

## Initial Checks

From `C:\Orlando693\Examen-SW1` in PowerShell, inspect before starting:

```powershell
openspec status
git status --short --untracked-files=all
```

Confirm the output matches the intended active change and that unrelated work is not accidentally included.
