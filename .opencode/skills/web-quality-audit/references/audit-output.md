# Audit Output

Use only these severity classes:

- `BLOCKER`: prevents a required user flow, makes essential content/control inaccessible, causes data loss/corruption, or fails an acceptance-critical browser behavior.
- `WARNING`: material quality, accessibility, responsive, console, or maintainability risk that does not currently block the verified core flow.
- `SUGGESTION`: improvement with limited impact and no demonstrated requirement failure.

For each finding, report:

```text
[SEVERITY] file:line (when available)
Rule: <short rule>
Impact: <user-facing or technical consequence>
Recommendation: <specific corrective action>
```

End every audit with:

```text
Ready for acceptance: YES|NO
```

For review-only tasks, report findings and readiness without modifying code automatically. State browser verification gaps explicitly.
