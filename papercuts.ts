/**
 * The papercut index and its rules, as plain functions over the document's value: what a repeat is, what the cap drops,
 * what the tool and the list action say. No packages and no harness, so `test/papercuts.test.ts` runs them on their own;
 * `server.ts` wires them to the tool, the action and the document.
 */
import type { Closing, Papercut, PapercutKind, PapercutsDoc } from './refs.ts'

/** What kind of friction it was, as the tool offers them. */
export const KINDS = [
  'tool',
  'instruction',
  'harness',
  'environment',
  'model',
  'slow',
] as const satisfies readonly PapercutKind[]
/** Why a row was closed. */
export const CLOSINGS = ['fixed', 'noise', 'superseded'] as const satisfies readonly Closing[]

/** Rows kept, open or closed: the newest. An older one's conversation entry stays the record. */
export const ROWS = 100
export const WHAT_CHARS = 280
export const WHERE_CHARS = 120
export const FIX_CHARS = 200
export const REF_CHARS = 120
/** A row raised once and left open this long is stale: the failures pass offers it for closing. */
export const STALE_MS = 30 * 24 * 60 * 60 * 1000

/** An empty index, as the document starts: a brand new chapter's root has none yet. */
export function initialPapercuts(): PapercutsDoc {
  return { next: 1, rows: [] }
}

/** A row as plain JSON: a document overlay is unusable once its transaction settles. */
export function copyRow(row: Papercut): Papercut {
  return JSON.parse(JSON.stringify(row))
}

/** A row is one line: whitespace collapses, so a list stays a list. */
const oneLine = (text: string) => text.replace(/\s+/g, ' ').trim()

const limited = (name: string, value: unknown, max: number) => {
  if (value === undefined || value === null) return undefined
  if (typeof value !== 'string') throw new Error(`${name} must be a string`)
  const text = oneLine(value)
  if (!text) return undefined
  if (text.length > max) throw new Error(`${name} must be at most ${max} characters`)
  return text
}

/**
 * How long ago `at` was, as a row line writes it: `now`, `5m`, `3h`, `2d`, then a short date from 7 days on. The web
 * facet's document uses the SDK's version; this is the server's, so the repository needs no checkout for it.
 */
function ago(at: number, now = Date.now()): string {
  const minutes = Math.floor(Math.max(0, now - at) / 60000)
  if (minutes < 1) return 'now'
  if (minutes < 60) return `${minutes}m`
  if (minutes < 60 * 24) return `${Math.floor(minutes / 60)}h`
  if (minutes < 60 * 24 * 7) return `${Math.floor(minutes / 60 / 24)}d`
  const date = new Date(at)
  return date.toLocaleDateString(
    undefined,
    date.getFullYear() === new Date(now).getFullYear()
      ? { month: 'short', day: 'numeric' }
      : { month: 'short', year: '2-digit' },
  )
}

const isStale = (row: Papercut, now: number) => row.count === 1 && now - row.at > STALE_MS

/**
 * What makes two raises the same friction: kind and where. Without a where, the start of the words it uses, so twenty
 * branches' "max one failing lookup" stays one row instead of twenty.
 */
function keyOf(row: Pick<Papercut, 'kind' | 'where' | 'what'>) {
  const where = row.where ? oneLine(row.where).toLowerCase() : ''
  if (where) return `${row.kind} · ${where}`
  const start = oneLine(row.what)
    .toLowerCase()
    .replace(/[^\p{L}\p{N} ]+/gu, ' ')
    .split(' ')
    .filter(Boolean)
    .slice(0, 6)
    .join(' ')
  return `${row.kind} · ${start}`
}

export type RaiseInput = {
  what: string
  kind: PapercutKind
  where?: string
  fix?: string
  conversation: number
  by: string
  cwd: string
}
/** A raise's row, whether it counted an open one up, and how many oldest rows the cap dropped. */
export type Raised = { row: Papercut; repeat: boolean; dropped: number }

/** Raise one in `index`, or count up the open row with the same kind and where. */
export function raise(index: PapercutsDoc, input: RaiseInput): Raised {
  const what = limited('what', input.what, WHAT_CHARS)
  if (!what) throw new Error('what must say the friction in one line')
  if (!KINDS.includes(input.kind)) throw new Error(`kind must be one of ${KINDS.join(', ')}`)
  const where = limited('where', input.where, WHERE_CHARS)
  const fix = limited('fix', input.fix, FIX_CHARS)
  const key = keyOf({ kind: input.kind, where, what })
  const open = index.rows.find((row) => row.status === 'open' && keyOf(row) === key)
  if (open) {
    open.count++
    return { row: copyRow(open), repeat: true, dropped: 0 }
  }
  const row: Papercut = {
    id: index.next++,
    at: Date.now(),
    conversation: input.conversation,
    by: input.by,
    cwd: input.cwd,
    kind: input.kind,
    what,
    ...(where ? { where } : {}),
    ...(fix ? { fix } : {}),
    count: 1,
    status: 'open',
  }
  index.rows.push(row)
  const dropped = Math.max(0, index.rows.length - ROWS)
  if (dropped) index.rows.splice(0, dropped)
  return { row: copyRow(row), repeat: false, dropped }
}

/** A closed row and how many are still open. */
export type Closed = { row: Papercut; open: number }

/** Close row `id`: fixed, noise or superseded; `fixed` needs the commit or memory slug that fixed it. */
export function resolve(index: PapercutsDoc, id: unknown, how: Closing, ref?: unknown): Closed {
  if (!CLOSINGS.includes(how)) throw new Error(`how must be one of ${CLOSINGS.join(', ')}`)
  const reference = limited('ref', ref, REF_CHARS)
  if (how === 'fixed' && !reference)
    throw new Error('resolve fixed needs ref: the commit or memory slug that fixed it')
  const row = index.rows.find((item) => item.id === id)
  if (!row) throw new Error(`No papercut ${String(id)}: the index keeps the newest ${ROWS} rows`)
  if (row.status !== 'open') throw new Error(`Papercut ${row.id} is already ${row.status}`)
  row.status = how
  row.closed = { at: Date.now(), ...(reference ? { ref: reference } : {}) }
  return {
    row: copyRow(row),
    open: index.rows.filter((item) => item.status === 'open').length,
  }
}

const rowLine = (row: Papercut, now: number) => {
  return [
    `- ${row.id} · ${row.kind}`,
    row.count > 1 ? ` · ${row.count}×` : '',
    ` · ${ago(row.at, now)}${isStale(row, now) ? ', never repeated' : ''}`,
    row.where ? ` · ${row.where}` : '',
    `: ${row.what}`,
    row.fix ? ` · fix: ${row.fix}` : '',
  ].join('')
}

/** The open rows as model text, newest first; rows open over 30 days without a repeat are named as candidates. */
export function listText(rows: readonly Papercut[], now = Date.now()) {
  const open = rows.filter((row) => row.status === 'open').toSorted((a, b) => b.id - a.id)
  if (!open.length) return 'No open papercuts.'
  const stale = open.filter((row) => isStale(row, now)).length
  return [
    `${open.length} open, newest first:`,
    ...open.map((row) => rowLine(row, now)),
    ...(stale
      ? [`${stale} open over 30 days without a repeat: the failures pass proposes closing them.`]
      : []),
  ].join('\n')
}

export function raisedText({ row, repeat, dropped }: Raised) {
  return [
    repeat
      ? `Papercut ${row.id} raised again (${row.kind}${row.where ? ` · ${row.where}` : ''}, now ${row.count}×).`
      : `Raised papercut ${row.id} (${row.kind}${row.where ? ` · ${row.where}` : ''}).`,
    dropped ? `The index keeps the newest ${ROWS} rows: dropped the ${dropped} oldest.` : '',
  ]
    .filter(Boolean)
    .join(' ')
}

export function closedText({ row, open }: Closed) {
  return `Papercut ${row.id} closed as ${row.status}${row.closed?.ref ? ` (${row.closed.ref})` : ''}: ${open} open.`
}
