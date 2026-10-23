# Commit Discipline

> The default policy here is that the agent commits at natural commit points. If you'd rather hold commit boundaries yourself, override this with a feedback memory like `"Don't run git commits — I'll handle them"` and the agent will stop committing.

The agent commits often, atomically, and with messages a human would write. Commits are how work becomes durable; treat them as a primary deliverable, not an afterthought.

## When to commit

A commit lands at a **natural commit point** — a moment where the working tree represents one coherent, internally consistent unit of work. Typical natural commit points:

- A failing test was written, then the implementation made it pass, and the test now passes. (Two commits if the test-then-implementation distinction matters; one commit if they're tightly bound.)
- A self-contained refactor is complete and all tests still pass.
- A configuration change was made and verified in the relevant tool.
- A new page, route, component, or content entry is complete and renders correctly.

Do **not** commit mid-task work. If tests are red, if the file is half-edited, if the change is incomplete — keep going (or stash and pivot). A WIP commit is the wrong answer; finish the thought, then commit.

## What goes in one commit

**One logical change per commit.** If you can describe the commit as "X and also Y", it's two commits.

Counter-examples that are _not_ one logical change:

- "Add the talks index page and also bump the Tailwind version"
- "Fix the broken breadcrumbs and reformat the file"
- "Add the talks index and the talk detail page"

In each case, split. The Tailwind bump is its own commit. The reformat is either its own commit or, ideally, dropped because it has nothing to do with the bug.

## What goes in a good message

A commit message has three parts: **subject**, optional **body**, optional **footer**.

This repo uses **[Scoped Commits](https://scopedcommits.com/)**, not Conventional Commits. The subject leads with the **scope** — the section, area, or concern the commit touches — because on a content site spread across pages, components, and content collections, _where_ a change lands is the first thing a reader needs to know.

### Subject

The shape is **`<scope>: <description>`**.

The **description**:

- Imperative, present tense: "add", "fix", "remove" — not "added" or "adds".
- The whole subject (scope included) stays under ~72 characters.
- No trailing period.
- Specific. "fix bug" is useless; "render breadcrumbs correctly on nested project pages" is useful.

The **scope** names what the commit touches. The harness areas (`hooks`, `skills`, `commands`, `agents`, `templates`, `rules`, `docs`, `mise`, `readme`) and `treewide` are always accepted.

| Scope                                                                                      | Use for                                                                                      |
| ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| `content`                                                                                  | New or updated MDX / content-collection entries (`blog`, `projects`, data files).            |
| a **section** — `blog`, `projects`, `resume`, `canon`                                      | Changes scoped to one site section's pages, layout, or data.                                 |
| an **app area** — `actions`, `components`, `entry`, `lib`, `middleware`, `styles`, `utils` | Changes inside that part of the `app/` tree.                                                 |
| a **concern** — `config`, `deps`, `build`, `ci`, `auth`, `seo`                             | Cross-cutting work: tooling, dependencies, the deploy pipeline, the password gate, metadata. |
| `app`                                                                                      | A change spanning the app that has no single narrower home.                                  |
| a **harness area** — `hooks`, `rules`, `agents`, `skills`, `docs`, `mise`, ...             | Changes to this repo's own `.agents/` machinery.                                             |
| `treewide`                                                                                 | A genuinely repo-wide sweep with no single home.                                             |

When a change spans more than one area, prefer the **broadest scope that still describes it**; only fall back to a comma-separated list (`blog, components: …`) when no single scope fits, and to `treewide` for a true global sweep. A ticket number, when there is one, goes in parentheses after the scope: `blog (#42): …`.

Examples:

- `content: add learning-remix-3 post`
- `blog: add /blog/talks index with sorted talk list`
- `components: split PostArticle render logic into header and body`
- `projects: render breadcrumbs correctly on nested project pages`
- `deps: bump Tailwind to v4.1`
- `hooks: dispatch format-on-edit to vp fmt`

Reverts, merges, and other mechanical commits don't have to follow this shape — format them however is clearest.

### Body

Optional. Use it when the WHY isn't obvious from the subject. Wrap at ~72 characters. Explain:

- The motivation (what user-facing problem this addresses)
- Any non-obvious trade-offs
- Anything a future reader would want to know that the diff doesn't show

Skip the body for trivial changes.

### Footer

Optional. Use for:

- Cross-references: `Refs: #42`, `See: app/components/PostArticle.tsx`
- Breaking changes: `BREAKING CHANGE: <description>`
- Co-authorship (if collaborating)

## Staging

- **Never `git add .` or `git add -A`.** Both will sweep up files you didn't intend to include — untracked artifacts, env files, build outputs. Stage by explicit path.
- **`git status` before staging.** Look at what's in the working tree. Decide what belongs in this commit and stage exactly that.
- **Review the diff.** `git diff --staged` before committing. If something is in there you don't recognize or didn't intend, take it out.

## Pre-commit hooks

- If a pre-commit hook fails, **the commit didn't happen**. Fix the issue, re-stage, create a new commit. Do **not** `--amend` after a failed hook — there's nothing to amend.
- Never bypass with `--no-verify` unless the user explicitly asks. Hook failures are usually telling you something real.

## When to amend vs. new commit

- **Default: new commit.** Easier to reason about, easier to revert, easier to review.
- **Amend only when:** the previous commit is local (not pushed), the new change is genuinely part of the same logical unit, and amending makes the history clearer (not just smaller).

## What never to commit

- Secrets (`.env`, credential files, API keys). If you see these in `git status`, stop and warn the user.
- Build outputs (`dist/`, `.output/`, `build/`). The `.gitignore` should already exclude these — if it doesn't, fix the gitignore in its own commit.
- Personal IDE config (`.vscode/`, `.idea/`). Unless the user explicitly asks.
- Large binaries unless the project explicitly tracks them.

## Frequency

Prefer **many small commits** over a few large ones. Five focused commits with clear messages beat one giant "rework the blog" commit every time. Small commits are easier to review, revert, cherry-pick, and reason about months later.

## Push policy

Committing is one thing; pushing is another. **Do not push unless the user asks** — even if commits are clean. The user controls when work goes upstream.
