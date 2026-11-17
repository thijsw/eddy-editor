---
'eddy-editor': patch
---

- Security: string children in a `DOMSpec` are now rendered as escaped text. They were treated as tag names, so a block rendering an attr as a child (e.g. `['figcaption', {}, b.attrs.caption]`) let user input inject markup into the saved HTML. Built-in plugins were not affected.
- Toolbar button items written as `{ run: (ed) => … }` now infer `ed`'s type instead of failing strict TypeScript with an implicit `any`.
