# Browser Acceptance

Use `webapp-e2e-testing` whenever a CU changes UI, responsive behavior, browser interaction, hydration, React Flow, or other browser-visible behavior. Automated tests, compilation, and an HTTP response are insufficient.

When reasonably possible, collect real-browser evidence for:

- Initial load.
- The primary user interaction.
- Browser console errors and page errors.
- Relevant states and error paths.
- Responsive viewports when layout changes.

For a manual command, specify the exact folder, command, expected result, and follow-up check. Example:

```powershell
cd C:\Orlando693\Examen-SW1
npm run dev
```

Then open `http://localhost:3000/editor`, exercise the changed flow, and inspect the browser console.

If real-browser execution is unavailable, state exactly: `Real browser verification remains pending.` Keep the corresponding acceptance task pending. Never invent acceptance.

CU-02 established that `GET /editor` returning `200` proves only that Next.js served HTML. It does not prove hydration, React Flow, console cleanliness, or responsive interaction. A task may remain pending despite green unit tests until real browser evidence exists.
