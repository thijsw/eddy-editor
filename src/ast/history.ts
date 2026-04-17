import type { DocumentNode } from './types'
import type { ASTSelection } from './selection'

export interface HistoryEntry {
  doc: DocumentNode
  selection: ASTSelection | null
}

export interface HistoryStack {
  entries: HistoryEntry[]
  pointer: number
}

const MAX_ENTRIES = 100

export function create(doc: DocumentNode, selection: ASTSelection | null): HistoryStack {
  return { entries: [{ doc, selection }], pointer: 0 }
}

export function push(
  stack: HistoryStack,
  doc: DocumentNode,
  selection: ASTSelection | null,
): HistoryStack {
  const entries = stack.entries.slice(0, stack.pointer + 1)
  entries.push({ doc, selection })
  if (entries.length > MAX_ENTRIES) entries.shift()
  return { entries, pointer: entries.length - 1 }
}

export function undo(stack: HistoryStack): HistoryStack | null {
  if (stack.pointer <= 0) return null
  return { entries: stack.entries, pointer: stack.pointer - 1 }
}

export function redo(stack: HistoryStack): HistoryStack | null {
  if (stack.pointer >= stack.entries.length - 1) return null
  return { entries: stack.entries, pointer: stack.pointer + 1 }
}

export function current(stack: HistoryStack): HistoryEntry {
  return stack.entries[stack.pointer]
}
