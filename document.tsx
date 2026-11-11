import { BandageIcon } from 'lucide-react'
import { formatAgo, plural, useDocOf } from '@/sdk'
import { PapercutDoc } from './refs.ts'
import type { Papercut } from './refs.ts'

/**
 * The papercut index in the Documents tab: the open rows, then the closed ones still kept. The index lives on the root
 * conversation, so this reads conversation 1 rather than the shown conversation's own (always empty) document.
 */
export function PapercutsDocument() {
  const rows = (useDocOf(1, PapercutDoc)?.rows ?? []).toReversed()
  const open = rows.filter((row) => row.status === 'open')
  const closed = rows.filter((row) => row.status !== 'open')
  if (!rows.length)
    return (
      <p className="px-3 font-sans text-[12px] leading-relaxed text-muted-foreground/70">
        Empty. Agents record frictions with the <code className="font-mono">papercut</code> tool as
        they hit them; the next dream's failures pass starts from this list.
      </p>
    )
  return (
    <div className="space-y-2 px-3 py-1">
      <p className="font-mono text-[11px] text-muted-foreground">
        {open.length ? plural(open.length, 'open') : 'None open'}
        {closed.length ? ` · ${closed.length} closed` : ''}
      </p>
      {open.length > 0 && (
        <ul className="space-y-1.5">
          {open.map((row) => (
            <Item key={row.id} row={row} />
          ))}
        </ul>
      )}
      {closed.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer font-mono text-[11px] text-muted-foreground/80 hover:text-foreground">
            {plural(closed.length, 'closed row')}
          </summary>
          <ul className="mt-1.5 space-y-1.5 opacity-70">
            {closed.map((row) => (
              <Item key={row.id} row={row} />
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}

function Item({ row }: { row: Papercut }) {
  return (
    <li className="min-w-0 border-l-2 border-border/70 pl-2" data-papercut={row.id}>
      <div className="flex flex-wrap items-baseline gap-x-2 font-mono text-[11px] text-muted-foreground">
        <span>{row.id}</span>
        <span className="text-foreground/70">{row.kind}</span>
        {row.count > 1 && <span>{row.count}×</span>}
        <span>{formatAgo(row.at, Date.now(), { ago: true })}</span>
        {row.where && <span className="min-w-0 truncate text-foreground/60">{row.where}</span>}
        {row.status !== 'open' && (
          <span className="rounded-full border border-border/70 px-1.5 leading-4">
            {row.status}
            {row.closed?.ref ? ` · ${row.closed.ref}` : ''}
          </span>
        )}
      </div>
      <p className="font-sans text-[12.5px] leading-relaxed text-foreground/90">{row.what}</p>
      {row.fix && (
        <p className="font-sans text-[11.5px] leading-relaxed text-muted-foreground">
          fix: {row.fix}
        </p>
      )}
      <p className="font-mono text-[10.5px] text-muted-foreground/60">
        #{row.conversation} · {row.by}
      </p>
    </li>
  )
}

/** The document's icon, shown in its Documents tab row. */
export const PapercutIcon = BandageIcon
