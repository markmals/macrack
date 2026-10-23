# Chrome DevTools MCP mechanics

Drive the web app via the Chrome DevTools MCP in tight verify-iterate loops: change code → reload → snapshot → assert → fix → repeat.

Tool names below are the chrome-devtools tool names; the exact MCP prefix (e.g. `mcp__chrome-devtools__*`) varies by session configuration — match whatever chrome-devtools tools are available.

## Prerequisites

- Dev server running (default `http://localhost:1612/`; check the actual port in the dev server output). Per [AGENTS.md](../../../AGENTS.md), do NOT run `mise run dev` yourself — if it's not up, ask the user to start it.

## Open a page

```
new_page        url: "http://localhost:1612/"
```

For an existing tab:

```
navigate_page   type: "url"     url: "http://localhost:1612/blog"
```

To reload (e.g. after a code change that didn't HMR-update):

```
navigate_page   type: "reload"  ignoreCache: true
```

## Wait and resize

```
wait_for        text: "<text expected on the settled page>"
resize_page     width: 360   height: 780
```

Use `wait_for` after navigation or an async action before capturing — screenshots of half-loaded pages produce false failures. Use `resize_page` before capturing responsive checklist items (set the viewport first, then navigate or reload if layout is set at load).

## Screenshot

```
take_screenshot   filePath: "<absolute path inside the repo>"   fullPage: true
```

Screenshots can only be saved inside workspace roots — `/tmp/` is rejected. Save under `.build/visual/<short-feature-slug>/` (gitignored). After saving, `Read` the path to view it.

Take screenshots aggressively when verifying visual changes. Name them `<NN>-<short-name>.png` with a descriptive name (`01-blog-list-empty.png`, `02-blog-list-populated.png`) so ordering and comparison are easy.

## Inspect what's on screen

Accessibility snapshot — text representation of the DOM with stable element UIDs:

```
take_snapshot
```

Use the returned UIDs to drive interactions or assert structure. Prefer snapshots over screenshots when checking _content_ rather than _visuals_.

## Interact

```
click        uid: <from snapshot>
fill         uid: <from snapshot>   value: "Jane Doe"
hover        uid: <from snapshot>
press_key    key: "Escape"
type_text    text: "Hello"
```

For full-form input use `fill_form` with multiple UIDs and values.

## Read console messages

```
list_console_messages   types: ["error", "warn"]   # filter when triaging
```

After a change, check the console **first** before deciding the change worked. Silent JS errors are a common cause of "looks blank but no obvious problem".

## Inspect network

```
list_network_requests   resourceTypes: ["document", "fetch", "xhr"]
get_network_request     reqid: <number from list>
```

Useful for catching unexpected requests, wrong status codes on document loads, or a fetch firing twice.

## Evaluate JavaScript in the page

The escape hatch for everything else:

```
evaluate_script
  function: |
    () => ({
      title: document.title,
      crumbCount: document.querySelectorAll('nav[aria-label="Breadcrumb"] a').length,
    })
```

Use this to read computed styles when a visual check is ambiguous, or to inspect page state when something behaves unexpectedly. Keep returned values JSON-serializable.

## Verify-iterate loop pattern

```
1. Make a code change.
2. The dev server should hot-reload. If you suspect it didn't:
   - navigate_page  type: "reload"  ignoreCache: true
3. Drive the UI to the state you want to verify (navigate → click → fill → …).
4. Wait for things to settle if the action is async (wait_for).
5. Take a screenshot OR a snapshot OR read console messages.
6. Decide: did the change work? If yes, move on. If no, repeat with a fix.
```

If you find yourself running the same sequence three times, define a mise task to script it.

## Common gotchas

- **Blank page but no obvious problem** = almost always a runtime error in the entry script — check `list_console_messages` without filters before anything else.
- **Stale UI after an edit** = HMR missed it; force `navigate_page type: "reload" ignoreCache: true` before concluding the change didn't work.
- **404 for `/favicon.ico`** is usually harmless — the browser's default request.
