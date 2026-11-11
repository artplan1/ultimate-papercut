# Papercuts

Small frictions recorded the moment an agent hits them, so the next dream finds them instead of searching for them: a
tool that failed or needed a workaround, an instruction that misled, a harness or environment limitation, a model
mistake worth knowing, something slow enough to cost time.

An Ultimate extension: it provides the `papercut` tool, its card, the `papercut` document in the Documents tab and the
`papercut/list` action, and depends on no Ultimate checkout — only on the packages Ultimate supplies at runtime.

## Install

```sh
git clone git@github.com:artplan1/ultimate-papercut.git ~/projects/ultimate-papercut
cd ~/projects/ultimate-papercut
npm run install:local
```

That links the checkout into `~/.ultimate/extensions/papercut`; Ultimate picks it up on the next save or reload, with no
restart. Running it again is harmless, and it refuses to replace anything already sitting there.

## The tool

An agent raises one with `papercut {what, kind, where?, fix?}`, reads the open ones with `list`, and closes them with
`{action: 'resolve', id, how, ref?}` once they are fixed, noise or superseded; `ref` names the commit or memory slug that
fixed it, and `fixed` will not close a row without one. A repeat of the same `kind` and `where` counts up on the open row
rather than adding one (without a `where`, the first words of `what` stand in for it), so twenty branches hitting the
same wall leave one row with a `count`. Text is one line each: 280 characters of `what`, 120 of `where`, 200 of `fix`.
Nothing writes here automatically, the same as memory.

The tool call stays as the durable evidence: the row says `#conversation`, `at`, `by` (the raiser's label, or a standing
or child agent's `@name`) and `cwd`. Rows live in the `papercut` document on the root conversation, newest 100 kept;
when the cap drops an oldest row, the tool says so, and its conversation entry still has it.

## Where a dream reads it

Ultimate's `extensions/dream/DREAM.md` failures pass starts from the `list` action rather than a search over every
entry, which is exactly the cost this tool exists to avoid: `ultimate.action('papercut', 'list')` returns `{ text,
rows }` — `text`, the same compact list the tool gives for the open rows, and `rows`, every kept row, closed ones
included. Each row is a pointer to verify, not a verdict, and the pass proposes closing rows open over 30 days without a
repeat.

The document lives with the chapter: after "Fall asleep" the next chapter's root gets its own, so the pass (and the
handover) name the rows still open instead of assuming they carry across. Conversation entries stay readable there
through codemode's `chapter` option.

## Layout

- `papercuts.ts` — the index and its rules as plain functions over the document value: dedupe, the cap, validation, and
  the text the tool and the list action return. No packages, so the tests need none.
- `refs.ts` — the browser-safe contract: the row type and the document ref the Documents tab reads.
- `server.ts` — the wiring: the document, the tool, the `list` action, and the `Host` shape it needs from Ultimate.
- `web.tsx`, `call.tsx`, `document.tsx` — the card in a conversation and the row in the Documents tab, built on
  Ultimate's web SDK (`@/sdk`).
- `test/` — `node --test`, no dependencies: the rules and the installer.

## Checks

```sh
npm run check
npm test
```
