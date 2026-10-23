---
name: verifying-work
description: Use before claiming any work is complete, fixed, or passing; when a UI change needs visual confirmation in a real browser before being declared done; or when driving the app via Chrome DevTools to screenshot state, simulate interaction, or inspect console/network. Evidence before assertions, always.
---

# Verifying Work

Claiming work is complete without verification is dishonesty, not efficiency. Evidence before claims, always.

This is the single verification gate: the discipline (never claim without evidence), the routing (which evidence proves which claim), and the UI workflow (how to produce browser evidence). Browser tool mechanics live in [chrome-devtools.md](chrome-devtools.md) — load that only when actually driving the browser.

## The Iron Law

```
NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE
```

If you haven't run the verification command **in this turn**, you cannot claim the result.

## The gate

Before stating success, satisfaction, or completion:

```
1. IDENTIFY  — what command proves the claim?
2. RUN       — execute the full command, fresh, no shortcuts
3. READ      — full output, exit code, failure count
4. VERIFY    — does the output confirm the claim?
                - No  → state actual status with evidence
                - Yes → state claim with evidence
5. CLAIM     — only now
```

Skip any step = lying.

## What proves what

| Claim                 | Required evidence                                         | Insufficient                                   |
| --------------------- | --------------------------------------------------------- | ---------------------------------------------- |
| Tests pass            | Test command output: 0 failures, this turn                | "Last run was clean", "Should pass now"        |
| Linter clean          | Linter output: 0 errors, this turn                        | Partial check, extrapolation from related code |
| Build succeeds        | Build command exit 0, this turn                           | Linter passed, types passed                    |
| Bug fixed             | Failing reproduction now passes                           | Code changed, "I think it's fixed"             |
| Regression test works | Red-green cycle verified                                  | Test passes once on the fixed code             |
| Subagent finished     | `git status` / `git diff` shows the changes               | Subagent's own success report                  |
| Feature implemented   | `mise run check` green, this turn (+ tests if they exist) | Code looks right                               |
| UI change works       | Checklist walk with screenshots (workflow below)          | `mise run build` succeeded                     |
| All requirements met  | Line-by-line checklist against the brainstorm             | Tests pass                                     |

For a regression test, the full red-green proof:

```
1. Write the test
2. Run it (with fix) — must PASS
3. Revert the fix
4. Run it — must FAIL (otherwise the test isn't testing what you think)
5. Restore the fix
6. Run it — must PASS again
```

Without step 4, you don't know the test catches the bug.

## Verifying UI changes

A UI change needs a checklist walk in a real browser, not a build that exits 0. Checklist-driven: every item is a concrete expected behavior, every verdict is backed by a captured screenshot. No checklist = exploratory clicking, a different task — write one first (or ask for one).

**What counts as UI:** anything that renders markup a user sees, regardless of directory — Remix action files returning JSX (`app/actions/*.tsx`) are UI too, not just `app/components/`. Changed a shared component? Check its call sites; the checklist must include at least one adjacent route that renders it.

**Inputs:** a short description of the change (routes, components, what should look different) and a checklist of behaviors, e.g. "Loaded with three entries: shows three rows, newest first." / "On viewport width 360px: layout stacks instead of side-by-side."

**Workflow:**

1. **Confirm the dev server is up.** Per [AGENTS.md](../../../AGENTS.md), do NOT run `mise run dev` yourself — the user runs it. Open the dev URL (`new_page`, default `http://localhost:1612/`); if it isn't reachable, stop and ask the user to start it.
2. **Per checklist item** (tool syntax in [chrome-devtools.md](chrome-devtools.md)):
    - **Set up the state**: navigate to the precondition; if the item is responsive, set the viewport first.
    - **Trigger** the behavior if needed (`click`, `fill`, `press_key`).
    - **Capture**: screenshot to `.build/visual/<short-feature-slug>/<NN>-<short-name>.png` (gitignored), plus the accessibility snapshot and console messages.
    - **Judge**: read the screenshot and snapshot back against the expected behavior — correct text, expected elements present/absent, correct empty/loaded/error state, layout/spacing, regressions on adjacent UI, console errors.
3. **Report** per item:

```
### <NN> <short name>
expected: <one-line description from the checklist>
observed: <one-paragraph description of what's actually on screen>
status:   ✅ pass | ⚠️ off (cosmetic) | 🔴 broken (functional)
screenshot: <path>
notes: <if not ✅: what's wrong; relevant console/network anomalies>
```

End with a one-paragraph summary and a recommended next action: "ready to merge", "fix <thing> then re-run", or "checklist item ambiguous — clarify <item>".

**UI-specific rules:**

- **Don't fix bugs mid-verification.** Report with screenshot + observation; fixing is a separate step — mixing the two muddies the evidence.
- **Don't go off-checklist.** Spot something broken outside it? Flag it in the summary; don't run a full verification on it.
- **Don't claim ✅ if the screenshot isn't readable.** Mid-animation, blank, or browser error → `🔴 broken — could not capture state`, and explain.

## Red flags — stop

- Using "should", "probably", "seems to", "I'm pretty sure"
- "Great!", "Perfect!", "Done!" before running anything
- About to commit / open a PR without re-running tests
- Trusting a subagent's success report without checking the diff
- Claiming success based on a partial check ("typecheck passed, build will pass")
- Declaring a UI change done without a screenshot from this turn
- Tired and wanting the work to be over
- "Just this once"

Any of these = run the verification first.

## Common rationalizations

| Excuse                    | Reality                                           |
| ------------------------- | ------------------------------------------------- |
| "Should work now"         | Run the command.                                  |
| "I'm confident"           | Confidence ≠ evidence.                            |
| "Linter passed"           | Linter doesn't compile. Linter doesn't run tests. |
| "Build passed, UI's fine" | The build doesn't look at pixels. Screenshot it.  |
| "Subagent said success"   | Verify independently — check the diff.            |
| "I'm tired"               | Not an excuse.                                    |
| "Partial check is enough" | Partial proves nothing.                           |

## How to phrase results

```
✅ I ran `mise run check` — clean. Implementation complete.
```

Not: ❌ "Looks good now!" / "Tests should be passing." / "I think we're done."

Even when the result is bad, state it cleanly:

```
mise run check reports 2 errors:
  - app/actions/blog.tsx:41 — unused variable `slug`
  - app/components/Breadcrumbs.tsx:12 — type mismatch
Investigating now.
```

## When to apply

**Always before:**

- Saying "done", "complete", "fixed", "passing", "ready", "shipped"
- Saying anything positive about the state of the work
- Committing (or asking the user to commit)
- Moving to the next task in the todo list
- Reporting subagent success up to the user
- Wrapping up an `implementing-a-feature` session

The rule applies to exact phrases, paraphrases, synonyms, and **anything that implies success**.

## Bottom line

Run the command. Read the output. Then claim the result. Non-negotiable.

## Related skills

- `test-driven-development` — verification at the unit level (where most coverage lives).
- `systematic-debugging` — when verification fails for a reason you don't understand.
- `implementing-a-feature` — the workflow this gate closes.
- `finding-test-gaps` — coverage reconnaissance; tells you what has no test to run.

## Reference

- [chrome-devtools.md](chrome-devtools.md) — Chrome DevTools MCP mechanics: open/navigate, screenshot, snapshot, interact, console, network, evaluate.
