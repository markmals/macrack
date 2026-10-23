---
name: finding-test-gaps
description: Use when asked what's untested, before refactoring code whose coverage is unknown, or when auditing test coverage for a file, folder, or feature area. Read-only reconnaissance — surfaces gaps without writing tests.
---

# Finding Test Gaps

Scan a target area, identify the testable units, and report which ones have no test coverage. This is reconnaissance: surface the gaps; filling them is a separate task (via `test-driven-development`).

## When to Use

- "Is anything in `app/lib` untested?"
- Before refactoring a unit — map the coverage around it first.
- Auditing a feature area's coverage before declaring it stable.

**Not for:** judging test _quality_ (that's code review), or purely-visual components (use `verifying-work`'s UI workflow).

## Inputs

- **Target** — a file, directory, or feature area (e.g. `app/lib/`, `app/components/about/`, `app/actions/blog.tsx`).
- _Optional:_ a focus hint ("functions only", "components only", "controllers only") — otherwise scan all testable kinds in the target.

## What counts as a testable unit

- **Exported functions and classes** in `app/lib/`, `app/utils/`, and similar utility folders.
- **Controllers / actions** in `app/actions/` (each action in a `createController` actions object).
- **Server components** with non-trivial logic in their factory or render scope — wherever they live (`app/components/`, or co-located in an action file).
- **Hydrated `clientEntry` islands** in `app/components/` — their behavior is observable, not just visual.
- **Validation schemas and parsers** (`remix/data-schema` usages).
- **Middleware** in `app/middleware/`.

Things that are usually **not** testable units on their own:

- Pure JSX server components with no logic in factory/render scope (verify visually instead).
- Type aliases, constants, re-exports.
- Generated files (`dist/`, `worker-configuration.d.ts`, `node_modules/`).

Non-exported module-scope logic with real branching (a private helper or inline factory component inside an action file) is not a separate unit — fold it into the enclosing exported unit's "behavior to test" line.

## Workflow

1. **List the testable units** in the target. Read the files; surface every export that fits the categories above.
2. **Locate tests** for each unit. Search for:
    - `*.test.ts` / `*.test.tsx` files alongside the source, or under a sibling `__tests__/` folder.
    - Test names mentioning the unit's name (function name, component name, action name).
    - `describe` / `it` blocks that import the unit.
3. **Run the suite** to learn which existing tests actually pass:
    - `mise run test`
      Capture the pass/fail map; correlate by file path or test name.
    - If `mise.toml` defines no `test` task, don't improvise a runner: skip this step, classify by test-file existence only (✅/🔴, no 🟡), and state "suite not runnable — no `test` task defined" in the report summary.
4. **Classify each unit**:
    - ✅ **covered** — at least one test exists and runs green.
    - 🟡 **failing** — at least one test exists, but it currently fails.
    - 🔴 **missing** — no test references this unit.

## Output

```
## test-gap report
target: <path or area>

summary:
  total units:     N
  covered (✅):    A
  failing (🟡):    B
  missing (🔴):    C

🔴 missing:
  - <unit kind>: <unit name> (<source file:line>)
    behavior to test: <one-line description of what the unit does>
    suggested test name: "<unit name>: <expected behavior>"
    suggested location:  <path/to/proposed/test/file>

🟡 failing:
  - <unit kind>: <unit name> (<source file:line>)
    test: <test_name> in <test_file:line>
    failure: <one-line excerpt of the failure message>
```

End with a one-line aggregate: "X units missing tests; Y tests failing."

## What NOT to do

- **Don't write tests.** Surface the gap; tests get written separately (typically via the `test-driven-development` skill).
- **Don't review test quality.** Whether the test asserts the right thing is a code-review concern. Only check: does a test for this unit exist, and does it run?
- **Don't conflate flakes with failures.** If a test is marked flaky (`// FLAKY`, `it.flaky`, `test.skip`, etc.), surface it with a "flaky/skipped" annotation, not as failing.
- **Don't run the suite more than once per scan.** Cache the result.
- **Don't flag purely-visual server components** that have no logic worth unit-testing — those belong to `verifying-work`'s UI workflow.

## Related skills

- `test-driven-development` — fills the gaps this skill finds.
- `verifying-work` — visual verification for the components this skill skips.

## Reference

- [AGENTS.md](../../../AGENTS.md) — controller, component, and middleware conventions (informs what counts as a "unit").
