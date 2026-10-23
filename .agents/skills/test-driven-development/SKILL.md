---
name: test-driven-development
description: Use when writing any production code in this repo — features, bug fixes, refactors, behavior changes. Write the failing test first, watch it fail, write minimal code to pass, refactor green.
---

# Test-Driven Development

Write the test first. Watch it fail. Write the minimal code to pass it. Refactor while green.

**Core principle:** if you didn't watch the test fail, you don't know if it tests the right thing.

**Lifted from superpowers' TDD skill.** Slimmed for this repo.

## The Iron Law

```
NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST
```

If you wrote code before the test, **delete it** and start over. Don't keep it as "reference". Don't "adapt it" while writing the test. Delete means delete.

## When to use

**Always:**

- New features (every new behavior gets a test first)
- Bug fixes (write a failing regression test first)
- Behavior changes
- Refactors that change observable behavior

**Exceptions (ask first):**

- Generated code
- Configuration files
- Throwaway prototypes that will be deleted, not kept

If you're thinking "skip TDD just this once" — stop. That's rationalization.

## Red → Green → Refactor

```
1. RED      Write one failing test for one behavior.
2. Verify   Run the test. Confirm it fails — for the right reason.
3. GREEN    Write the minimal code to make it pass.
4. Verify   Run the test. Confirm it passes. Confirm other tests still pass.
5. Refactor Clean up while staying green.
6. Repeat   Next failing test for next behavior.
```

### RED — write one failing test

- One behavior per test.
- Clear name: `<unit>: <what the user observes>` — readable as a sentence.
- Test real code; mock only what you can't control (network, time, randomness).

```ts
// Vitest
describe("PostArticle", () => {
    it("renders the post title from frontmatter", () => {
        let html = renderToString(<PostArticle entry={fixturePost({ title: "Hello" })} />);
        expect(html).toContain("Hello");
    });
});
```

### Verify RED — watch it fail

**Mandatory. Never skip.** Run the test command. Confirm:

- It **fails**, not errors out (failing assertion ≠ undefined symbol).
- The failure message matches what you expect.
- It fails because the **feature is missing**, not because of a typo or import error.

If the test passes immediately, you're testing existing behavior — fix the test. If the test errors, fix the error and re-run until it fails for the right reason.

### GREEN — minimal code

Write the simplest code that makes the failing test pass.

- No defensive `if` for cases not yet tested.
- No options objects, configuration, or hooks for future flexibility (YAGNI).
- No "while I'm here" refactors of unrelated code.

### Verify GREEN — watch it pass

Run the test. Confirm:

- It passes.
- All other tests in the suite still pass.
- Output is pristine — no warnings, no leaked logs, no "test passed but skipped".

### Refactor

Now that you're green, clean up. Remove duplication, improve names, extract helpers. Keep tests green throughout — every change should leave the suite passing. Do not add new behavior.

## Why order matters

> "I'll write tests after to verify it works."

Tests written after the implementation **pass immediately**. That proves nothing:

- Might test the wrong thing
- Might test what you implemented, not what's required
- Might miss edge cases you forgot
- You never saw it catch a bug

Test-first forces you to **see the test fail**, which proves the test actually tests something.

## Naming discipline

Tests in this project use Vitest. Group with `describe(<unit>, ...)` and name with `it(<observable behavior>, ...)` so the test list reads as a sentence:

```
PostArticle
  ✓ renders the post title from frontmatter
  ✓ hides drafts when NODE_ENV is production
blog controller
  ✓ /blog/:slug returns 404 for unknown slugs
```

When something fails, the test name alone should tell you what broke.

## Common rationalizations

| Excuse                       | Reality                                                 |
| ---------------------------- | ------------------------------------------------------- |
| "Too simple to test"         | Simple code still breaks. The test takes 30 seconds.    |
| "I'll test after"            | Tests passing immediately prove nothing.                |
| "Already manually tested"    | Manual ≠ automated. No record, can't re-run.            |
| "Deleting work is wasteful"  | Sunk cost. Keeping unverified code is technical debt.   |
| "Need to explore first"      | Fine — throw the exploration away, then start with TDD. |
| "Test hard = design unclear" | Listen to the test. Hard to test means hard to use.     |

## Red flags — stop and start over

- Code before the test
- Test added "after we ship"
- Test passes immediately
- Can't explain why the test failed
- "Just this once"
- "Keep as reference, write tests, then adapt"

All of these mean: **delete the code, start with TDD**.

## When stuck

| Problem                | Solution                                             |
| ---------------------- | ---------------------------------------------------- |
| Don't know how to test | Write the wished-for API. Write the assertion first. |
| Test too complicated   | Design too complicated. Simplify the interface.      |
| Must mock everything   | Code too coupled. Use dependency injection.          |
| Test setup huge        | Extract helpers. Still big? Simplify the design.     |

## Verification checklist

Before marking work complete:

- [ ] Every behavior has at least one test
- [ ] Watched each test fail before implementing
- [ ] Each test failed for the expected reason
- [ ] Wrote minimal code to pass each test
- [ ] All tests pass
- [ ] Output pristine (no warnings, no leaked logs)
- [ ] Tests use real code (mocks only when unavoidable)
- [ ] Test names read as sentences and locate the failure on sight

Can't tick every box? You skipped TDD. Start over.

## Commit

Each green-refactor cycle is a natural commit boundary. Once the suite is green and the refactor is clean, commit before starting the next red. See `.agents/rules/commit-discipline.md`.

Typical shape:

- **One commit per behavior** when test and impl are tightly bound: `feat: <behavior>` or `fix: <bug>`. The commit contains the new test and the minimum code to make it pass.
- **Split into two commits** when the failing test is valuable on its own (e.g. a regression test that should land even if the fix takes longer): `test: add failing test for <bug>` then `fix: <bug>`.

Do **not** commit while red. A WIP commit between red and green is the wrong answer — finish the cycle, then commit.

## Related skills

- `implementing-a-feature` — the workflow that invokes this skill
- `verifying-work` — the gate before claiming the work is done
- `systematic-debugging` — for when a test fails for a reason you don't yet understand
