import {
  AlertTriangle,
  CheckCircle2,
  Code2,
  FileDiff,
  Heading,
  Image,
  Info,
  LayoutTemplate,
  ListChecks,
  ListOrdered,
  MessageCircleQuestion,
  Network,
  ShieldAlert,
  Split,
  Table2,
  Text,
  Workflow,
  type LucideIcon,
} from 'lucide-react'
import type { Block } from '@/lib/schema'

export function blockMeta(b: Block): { label: string; icon: LucideIcon } {
  switch (b.type) {
    case 'markdown':
      return { label: 'Notes', icon: Text }
    case 'section':
      return { label: b.title, icon: Heading }
    case 'callout':
      return {
        label: { info: 'Note', warning: 'Heads up', risk: 'Risk', success: 'Done' }[b.tone],
        icon: { info: Info, warning: AlertTriangle, risk: ShieldAlert, success: CheckCircle2 }[b.tone],
      }
    case 'decision':
      return { label: 'Decision', icon: Split }
    case 'question':
      return { label: 'Question', icon: MessageCircleQuestion }
    case 'confirm':
      return { label: 'Please confirm', icon: ListChecks }
    case 'steps':
      return { label: 'Steps', icon: ListOrdered }
    case 'diagram':
      return { label: 'Diagram', icon: Network }
    case 'mermaid':
      return { label: 'Diagram', icon: Workflow }
    case 'image':
      return { label: 'Image', icon: Image }
    case 'mockup':
      return { label: 'Mockup', icon: LayoutTemplate }
    case 'files':
      return { label: 'Files changed', icon: FileDiff }
    case 'code':
      return { label: b.path ?? 'Code', icon: Code2 }
    case 'table':
      return { label: 'Comparison', icon: Table2 }
  }
}
