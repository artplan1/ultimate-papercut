import { BandageIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Tool, ToolContent, ToolHeader, ToolOutput, ToolSection } from '@/components/ai/tool'
import { useDocOf, useToolDuration } from '@/sdk'
import type { ToolCallView } from '@/sdk'
import { PapercutDoc } from './refs.ts'
import type { Papercut } from './refs.ts'

const words = (value: unknown) => (typeof value === 'string' ? value.trim() : '')

/** One line on a raise: kind and where, as the header's meta. */
const place = (row: Papercut) => [row.kind, row.where].filter(Boolean).join(' · ')

/** A `papercut` call as one line of a folded run: what it raised, listed or closed. */
export function PapercutLine({ call }: { call: ToolCallView }) {
  const action = words(call.args.action) || 'raise'
  const id = typeof call.args.id === 'number' ? call.args.id : undefined
  const text =
    action === 'list'
      ? 'list'
      : action === 'resolve'
        ? `closed ${id ?? ''} · ${words(call.args.how)}`
        : `${words(call.args.kind) || 'raised'}: ${words(call.args.what)}`
  return (
    <>
      <span className="text-foreground/80">papercut</span> {text}
    </>
  )
}

/** A `papercut` call as what happened: a friction raised or counted up, the list, or a row closed. */
export function PapercutCall({ call, core }: { call: ToolCallView; core: ReactNode }) {
  const duration = useToolDuration(call)
  const rows = useDocOf(1, PapercutDoc)?.rows
  if (call.status === 'error' || call.status === 'interrupted') return core
  const action = words(call.args.action) || 'raise'
  const id = typeof call.args.id === 'number' ? call.args.id : undefined
  // The result names the row (`Raised papercut 12 …`); while it runs, the arguments already say what it is.
  const called = /papercut (\d+)/i.exec(call.output)?.[1]
  const raised = rows?.find((row) => String(row.id) === (called ?? String(id)))
  if (action === 'list')
    return (
      <Tool>
        <ToolHeader
          icon={BandageIcon}
          meta={duration && <span>{duration}</span>}
          name=""
          state={call.status}
          title="Listed papercuts"
        />
        <ToolContent>
          <ToolOutput output={call.output} />
        </ToolContent>
      </Tool>
    )
  if (action === 'resolve') {
    const how = words(call.args.how)
    return (
      <Tool>
        <ToolHeader
          icon={BandageIcon}
          meta={duration && <span>{duration}</span>}
          name=""
          state={call.status}
          title={
            <>
              <span className="text-foreground">Closed papercut{id ? ` ${id}` : ''}</span>
              {how && <span> · {how}</span>}
              {words(call.args.ref) && <span> · {words(call.args.ref)}</span>}
            </>
          }
        />
        <ToolContent>{raised && <Row row={raised} />}</ToolContent>
      </Tool>
    )
  }
  const kind = words(call.args.kind)
  const what = raised?.what ?? words(call.args.what)
  // How many times it had been raised by this call: `Papercut 1 raised again (tool · bash, now 2×)`.
  const counted = /now (\d+)×/.exec(call.output)?.[1]
  return (
    <Tool>
      <ToolHeader
        icon={BandageIcon}
        meta={
          <>
            {!raised && kind && <span>{kind}</span>}
            {counted && (
              <span className="rounded-full border border-border/70 px-1.5 leading-4">
                {counted}×
              </span>
            )}
            {duration && <span>{duration}</span>}
          </>
        }
        name=""
        state={call.status}
        title={
          <>
            <span className="text-foreground">{raised ? 'Papercut' : 'Raised a papercut'}</span>
            {what && <span> · {what}</span>}
          </>
        }
      />
      <ToolContent>
        {raised ? (
          <Row row={raised} />
        ) : (
          (words(call.args.where) || words(call.args.fix)) && (
            <ToolSection>
              {words(call.args.where) && (
                <p className="font-mono text-[11.5px] text-muted-foreground">
                  {words(call.args.where)}
                </p>
              )}
              {words(call.args.fix) && (
                <p className="font-sans text-[13px] leading-relaxed text-foreground/90">
                  {words(call.args.fix)}
                </p>
              )}
            </ToolSection>
          )
        )}
      </ToolContent>
    </Tool>
  )
}

/** A raised row in full: the kind and place, what it was, and the fix that would make it cheap. */
function Row({ row }: { row: Papercut }) {
  return (
    <ToolSection>
      <div className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
        <span className="rounded-full border border-border/70 px-1.5 leading-4">{place(row)}</span>
        <span>#{row.id}</span>
      </div>
      <p className="font-sans text-[13px] leading-relaxed whitespace-pre-wrap text-foreground/90">
        {row.what}
      </p>
      {row.fix && (
        <p className="font-sans text-[12px] leading-relaxed text-muted-foreground">
          fix: {row.fix}
        </p>
      )}
    </ToolSection>
  )
}
