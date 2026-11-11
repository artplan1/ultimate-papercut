import assert from 'node:assert/strict'
import test from 'node:test'
import {
  closedText,
  initialPapercuts,
  listText,
  raise,
  raisedText,
  resolve,
  ROWS,
  STALE_MS,
} from '../papercuts.ts'
import type { RaiseInput } from '../papercuts.ts'
import type { Papercut } from '../refs.ts'

const input = (patch: Partial<RaiseInput>): RaiseInput => ({
  what: 'pnpm test extensions/x hung until the timeout',
  kind: 'tool',
  conversation: 7,
  by: 'coordinator',
  cwd: '/work/x',
  ...patch,
})

test('the document starts empty, with the first id waiting', () => {
  assert.deepEqual(initialPapercuts(), { next: 1, rows: [] })
})

test('raises a row with its derived fields, lists open rows and closes one', () => {
  const index = initialPapercuts()
  const first = raise(
    index,
    input({ what: '  pnpm test\nhung  ', where: 'bash', fix: 'run that folder suite' }),
  )
  assert.equal(first.repeat, false)
  assert.equal(first.dropped, 0)
  const { at, ...derived } = first.row
  assert.deepEqual(derived, {
    id: 1,
    conversation: 7,
    by: 'coordinator',
    cwd: '/work/x',
    kind: 'tool',
    what: 'pnpm test hung',
    where: 'bash',
    fix: 'run that folder suite',
    count: 1,
    status: 'open',
  })
  assert.equal(typeof at, 'number')
  assert.equal(raisedText(first), 'Raised papercut 1 (tool · bash).')

  raise(index, input({ what: 'the lint rule contradicted the prompt', kind: 'instruction' }))
  assert.equal(
    listText(index.rows, 0),
    [
      '2 open, newest first:',
      '- 2 · instruction · now: the lint rule contradicted the prompt',
      '- 1 · tool · now · bash: pnpm test hung · fix: run that folder suite',
    ].join('\n'),
  )

  const closed = resolve(index, 1, 'fixed', 'abc1234')
  assert.equal(closed.open, 1)
  assert.deepEqual(closed.row, {
    ...first.row,
    status: 'fixed',
    closed: { at: closed.row.closed?.at, ref: 'abc1234' },
  })
  assert.equal(closedText(closed), 'Papercut 1 closed as fixed (abc1234): 1 open.')
  assert.equal(
    listText(index.rows, 0),
    ['1 open, newest first:', '- 2 · instruction · now: the lint rule contradicted the prompt'].join(
      '\n',
    ),
  )
  resolve(index, 2, 'noise')
  assert.equal(listText(index.rows, 0), 'No open papercuts.')
})

test('counts a repeat of the same kind and where up instead of adding a row', () => {
  const index = initialPapercuts()
  raise(index, input({ what: 'max one failing lookup', where: 'Bash' }))
  const again = raise(index, input({ what: 'bash: lookup failed again', where: 'bash' }))
  assert.equal(again.repeat, true)
  assert.equal(again.row.id, 1)
  assert.equal(again.row.count, 2)
  // The row keeps the wording of the raise that opened it; matching ignores case.
  assert.equal(raisedText(again), 'Papercut 1 raised again (tool · Bash, now 2×).')
  // Without a where, the first words stand in for it; another kind is another row.
  raise(index, input({ what: 'the tool list rule misled me twice' }))
  const worded = raise(index, input({ what: 'the tool list rule misled me' }))
  assert.equal(worded.row.id, 2)
  assert.equal(worded.row.count, 2)
  assert.equal(index.rows.length, 2)
})

test('keeps the newest rows and says what the cap dropped', () => {
  const index = initialPapercuts()
  for (let i = 0; i <= ROWS; i++) raise(index, input({ what: `friction ${i}`, where: `tool-${i}` }))
  assert.equal(index.rows.length, ROWS)
  assert.equal(index.rows[0].id, 2)
  assert.equal(index.rows.at(-1)?.id, ROWS + 1)
  const raised = raise(index, input({ what: 'one more', where: 'tool-more' }))
  assert.equal(raised.dropped, 1)
  assert.ok(
    raisedText(raised).includes(
      `The index keeps the newest ${ROWS} rows: dropped the 1 oldest.`,
    ),
  )
  assert.throws(
    () => resolve(index, 1, 'noise'),
    new RegExp(`the index keeps the newest ${ROWS} rows`),
  )
})

test('offers rows open over 30 days without a repeat for closing', () => {
  const index = initialPapercuts()
  raise(index, input({ what: 'stale one', where: 'a' }))
  raise(index, input({ what: 'repeated', where: 'b' }))
  raise(index, input({ what: 'repeated again', where: 'b' }))
  const now = Date.now()
  for (const row of index.rows) row.at = now - STALE_MS - 1000
  const text = listText(index.rows, now)
  // Past a week, the age prints as a short date instead of a count.
  assert.match(text, /- 1 · tool · .+, never repeated · a: stale one/)
  assert.match(text, /- 2 · tool · 2× · .+ · b: repeated/)
  assert.ok(!text.includes('b: repeated, never repeated'))
  assert.ok(text.includes('1 open over 30 days without a repeat'))
})

test('refuses an empty what, an unknown kind, a long field and a fixed row without ref', () => {
  const index = initialPapercuts()
  assert.throws(() => raise(index, input({ what: '   ' })), /what must say the friction/)
  assert.throws(
    () => raise(index, input({ kind: 'vibes' as Papercut['kind'] })),
    /kind must be/,
  )
  assert.throws(() => raise(index, input({ what: 'x'.repeat(281) })), /at most 280/)
  assert.throws(() => raise(index, input({ where: 'y'.repeat(121) })), /at most 120/)
  assert.throws(() => raise(index, input({ fix: 'z'.repeat(201) })), /at most 200/)
  raise(index, input({}))
  assert.throws(() => resolve(index, 1, 'fixed'), /needs ref/)
  assert.throws(() => resolve(index, 99, 'noise'), /No papercut 99/)
  resolve(index, 1, 'superseded', 'memory:model-families')
  assert.throws(() => resolve(index, 1, 'noise'), /already superseded/)
})
