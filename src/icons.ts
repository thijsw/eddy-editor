import { h, type FunctionalComponent } from 'vue'

type VNode = ReturnType<typeof h>

function lucide(paths: () => VNode[]): FunctionalComponent {
  return () =>
    h(
      'svg',
      {
        xmlns: 'http://www.w3.org/2000/svg',
        width: '1rem',
        height: '1rem',
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: 'currentColor',
        'stroke-width': '2',
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
        'aria-hidden': 'true',
        focusable: 'false',
      },
      paths(),
    )
}

// Lucide "Bold"
export const BoldIcon = lucide(() => [
  h('path', { d: 'M6 12h9a4 4 0 0 1 0 8H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7a4 4 0 0 1 0 8' }),
])

// Lucide "Italic"
export const ItalicIcon = lucide(() => [
  h('line', { x1: '19', x2: '10', y1: '4', y2: '4' }),
  h('line', { x1: '14', x2: '5', y1: '20', y2: '20' }),
  h('line', { x1: '15', x2: '9', y1: '4', y2: '20' }),
])

// Lucide "Underline"
export const UnderlineIcon = lucide(() => [
  h('path', { d: 'M6 4v6a6 6 0 0 0 12 0V4' }),
  h('line', { x1: '4', x2: '20', y1: '20', y2: '20' }),
])

// Lucide "Strikethrough"
export const StrikethroughIcon = lucide(() => [
  h('path', { d: 'M16 4H9a3 3 0 0 0-2.83 4' }),
  h('path', { d: 'M14 12a4 4 0 0 1 0 8H6' }),
  h('line', { x1: '4', x2: '20', y1: '12', y2: '12' }),
])

// Lucide "List"
export const ListIcon = lucide(() => [
  h('line', { x1: '8', x2: '21', y1: '6', y2: '6' }),
  h('line', { x1: '8', x2: '21', y1: '12', y2: '12' }),
  h('line', { x1: '8', x2: '21', y1: '18', y2: '18' }),
  h('line', { x1: '3', x2: '3.01', y1: '6', y2: '6' }),
  h('line', { x1: '3', x2: '3.01', y1: '12', y2: '12' }),
  h('line', { x1: '3', x2: '3.01', y1: '18', y2: '18' }),
])

// Lucide "ListOrdered"
export const ListOrderedIcon = lucide(() => [
  h('line', { x1: '10', x2: '21', y1: '6', y2: '6' }),
  h('line', { x1: '10', x2: '21', y1: '12', y2: '12' }),
  h('line', { x1: '10', x2: '21', y1: '18', y2: '18' }),
  h('path', { d: 'M4 6h1v4' }),
  h('path', { d: 'M4 10h2' }),
  h('path', { d: 'M6 18H4c0-1 2-2 2-3s-1-2-2-2' }),
])

// Lucide "Heading1"
export const Heading1Icon = lucide(() => [
  h('path', { d: 'M4 12h8' }),
  h('path', { d: 'M4 18V6' }),
  h('path', { d: 'M12 18V6' }),
  h('path', { d: 'm17 12 3-2v8' }),
])

// Lucide "Heading2"
export const Heading2Icon = lucide(() => [
  h('path', { d: 'M4 12h8' }),
  h('path', { d: 'M4 18V6' }),
  h('path', { d: 'M12 18V6' }),
  h('path', { d: 'M21 18h-4c0-4 4-3 4-6 0-1.5-2-2.5-4-1' }),
])

// Lucide "Heading3"
export const Heading3Icon = lucide(() => [
  h('path', { d: 'M4 12h8' }),
  h('path', { d: 'M4 18V6' }),
  h('path', { d: 'M12 18V6' }),
  h('path', { d: 'M17.5 10.5c1.7-1 3.5 0 3.5 1.5a2 2 0 0 1-2 2' }),
  h('path', { d: 'M17 17.5c2 1.5 4 .3 4-1.5a2 2 0 0 0-2-2' }),
])

// Lucide "Heading4"
export const Heading4Icon = lucide(() => [
  h('path', { d: 'M4 12h8' }),
  h('path', { d: 'M4 18V6' }),
  h('path', { d: 'M12 18V6' }),
  h('path', { d: 'M17 10v4h4' }),
  h('path', { d: 'M21 10v8' }),
])

// Lucide "Heading5"
export const Heading5Icon = lucide(() => [
  h('path', { d: 'M4 12h8' }),
  h('path', { d: 'M4 18V6' }),
  h('path', { d: 'M12 18V6' }),
  h('path', { d: 'M17 10h3' }),
  h('path', { d: 'M17 10v4' }),
  h('path', { d: 'M20 14a2 2 0 1 1 0 4h-3' }),
])

// Lucide "Heading6"
export const Heading6Icon = lucide(() => [
  h('path', { d: 'M4 12h8' }),
  h('path', { d: 'M4 18V6' }),
  h('path', { d: 'M12 18V6' }),
  h('circle', { cx: '19', cy: '16', r: '2' }),
  h('path', { d: 'M20 10c-2 2-3 3.5-3 6' }),
])
