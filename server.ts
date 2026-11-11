/**
 * Papercuts: the small frictions agents hit while working, recorded at the moment they happen on the root conversation,
 * so the next dream's failures pass starts from a list instead of a search through every entry.
 */
import { type Annotations, int, obj, oneOf, opt, str, type Schema } from '@earendil-works/pi-schema'
import {
  defineDoc,
  defineExtension,
  defineTool,
  ROOT_CONVERSATION_ID,
} from '@earendil-works/pi-durable'
import type { Tx } from '@earendil-works/pi-durable'
import type { Context, JsonValue } from '@earendil-works/chord'
import { BACKGROUND_CONTEXT as context } from '@earendil-works/chord/context'
import {
  CLOSINGS,
  closedText,
  copyRow,
  initialPapercuts,
  KINDS,
  listText,
  raise,
  raisedText,
  resolve,
} from './papercuts.ts'
import { PapercutDoc } from './refs.ts'
import type { PapercutsDoc } from './refs.ts'

/**
 * What this extension uses of the host it runs in, as a shape rather than an import: it is its own repository and
 * depends on no Ultimate checkout, only on the packages Ultimate supplies at runtime.
 */
type Host = {
  /** The project folder the extension runs for. */
  projectRoot: string
  /** Summaries of every conversation, as the web's conversation list shows them. */
  conversations(): readonly { id: number; label?: string; title?: string; cwd?: string }[]
  /** The open harness: outside a tool call, a document read or write commits through it. */
  harness(): { commit<T>(change: (tx: Tx) => T | Promise<T>, context: Context): Promise<T> }
}

/** The context an extension action runs with, as this extension uses it. */
type ActionContext = { host: Host }

/**
 * One of the given strings, declared with `type: 'string'`. pi-schema's `oneOf()` emits a bare `{ enum }`, which is
 * valid JSON Schema, but Moonshot (Kimi, e.g. `opencode-go/kimi-k3.1-pro`) rejects the whole request with "type is not
 * defined". Copied from Ultimate's `lib/schema.ts` so this repository needs no checkout; drop it once `oneOf()` emits
 * the type.
 */
function strEnum<const V extends readonly string[]>(
  values: V,
  options?: Annotations<V[number]>,
): Schema<V[number]> {
  return { ...oneOf(values, options), type: 'string' }
}

export const Papercuts = defineDoc<PapercutsDoc>({
  kind: PapercutDoc.kind,
  checkpointWhen: () => false,
  version: 1,
  scope: 'conversation',
  history: 'latest',
  fork: 'initial',
  initial: initialPapercuts,
})
export const docs = [Papercuts]

export const actions = {
  /** `papercut/list` (`ListAction` in refs.ts is the same contract for the browser): the open rows, never a search. */
  list: async (_args: JsonValue, { host }: ActionContext) => {
    const kept = await host.harness().commit(async (tx) => {
      const rows = (await tx.doc(Papercuts, ROOT_CONVERSATION_ID)).rows
      return rows.map(copyRow)
    }, context)
    return { text: listText(kept), rows: kept }
  },
}

export default function papercutExtension(host: Host) {
  return defineExtension({
    name: 'papercut',
    tools: [
      defineTool({
        name: 'papercut',
        description:
          'A small friction, recorded while it is fresh, so the next dream can find it reliably: a tool that failed or needed a workaround, an instruction that misled you, a harness or environment limitation, a model mistake worth knowing, something slow enough to cost you time. raise {what, kind, where?, fix?} (default); list the open ones; resolve {id, how, ref?} once it is fixed, noise or superseded, ref naming the commit or memory slug for fixed. Repeating the same kind and where counts up on the open row instead of adding one. Nothing records itself here.',
        parameters: obj({
          action: opt(strEnum(['raise', 'list', 'resolve'])),
          what: opt(str()),
          kind: opt(strEnum(KINDS)),
          where: opt(str()),
          fix: opt(str()),
          id: opt(int({ minimum: 1 })),
          how: opt(strEnum(CLOSINGS)),
          ref: opt(str()),
        }),
        // Not replay-safe (the default): an interrupted raise is never rerun, so it counts at most once.
        async execute(args, api, ctx) {
          const action = args.action ?? 'raise'
          const conversation = api.conversationId
          const caller = host.conversations().find((item) => item.id === conversation)
          // The label names the role (`coordinator`, `lander`); a standing or child agent's label is just `agent`, so
          // its `@name` title says which one raised it.
          const by =
            caller?.label && caller.label !== 'agent' ? caller.label : (caller?.title ?? 'agent')
          const text = await api.commit(async (tx) => {
            const papercuts = await tx.doc(Papercuts, ROOT_CONVERSATION_ID)
            if (action === 'list') return listText(papercuts.rows)
            if (action === 'resolve') {
              if (args.id === undefined) throw new Error('resolve needs id')
              if (args.how === undefined)
                throw new Error('resolve needs how: fixed, noise or superseded')
              return closedText(resolve(papercuts, args.id, args.how, args.ref))
            }
            if (args.what === undefined)
              throw new Error('raise needs what: the friction in one line')
            if (args.kind === undefined) throw new Error(`raise needs kind: ${KINDS.join(', ')}`)
            return raisedText(
              raise(papercuts, {
                what: args.what,
                kind: args.kind,
                where: args.where,
                fix: args.fix,
                conversation,
                by,
                cwd: caller?.cwd ?? host.projectRoot,
              }),
            )
          }, ctx)
          return { output: [{ type: 'text', text }] }
        },
      }),
    ],
  })
}
