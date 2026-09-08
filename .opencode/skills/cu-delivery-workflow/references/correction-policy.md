# Correction Policy

## A. Active, Unarchived CU

A reported bug or missing acceptance criterion remains in the same OpenSpec change. Add corrective tasks, implement the correction, update documentation/evidence, and rerun verification. Do not create a second CU or change for work within the active scope.

## B. Archived And Committed CU

Do not rewrite the archive or history. When the defect justifies it, create a new fix change such as `fix-cu-XX-description`, document the later correction in the original CU record, verify it, and create a new commit.

## C. Minor Non-Blocking Debt

Document, classify, and preserve it during archive. It does not block closure unless it violates an acceptance criterion.

CU-02 examples:

- `favicon.ico` 404: minor debt.
- Drawer `aria-hidden` focus warning: accessibility warning/debt.
- Hydration mismatch: blocker.
- React Flow #004: blocker while it affected acceptance.

Do not downgrade an actual acceptance or functional defect merely to close a CU.
