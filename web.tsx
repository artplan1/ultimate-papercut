import { defineWebExtension } from '@/sdk'
import { PapercutCall, PapercutLine } from './call.tsx'
import { PapercutIcon, PapercutsDocument } from './document.tsx'

export default defineWebExtension({
  tools: { papercut: PapercutCall },
  toolLines: { papercut: PapercutLine },
  documents: [
    {
      kind: 'papercut',
      title: 'Papercuts',
      icon: PapercutIcon,
      component: PapercutsDocument,
    },
  ],
})
