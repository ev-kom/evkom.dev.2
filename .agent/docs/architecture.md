# Architecture

## Core Engine

**File**: `backend/renderer.js`

The SSG uses a unified renderer with 3 modes.

| Mode      | Command         | Walker            | Logic                                                          |
| --------- | --------------- | ----------------- | -------------------------------------------------------------- |
| **Dev**   | `npm run dev`   | `walkFull`        | JIT. Recurses includes, executes dynamic tags, inlines assets. |
| **Build** | `npm run build` | `walkStaticOnly`  | Flattens includes. **Ignored** dynamic tags (saved for prod).  |
| **Prod**  | `npm start`     | `walkDynamicOnly` | Hydrates dynamic tags in pre-built HTML.                       |

## Routing

**File**: `backend/registries.js`

- **`PAGE_REGISTRY`**: Maps `url-path` → `filesystem-path`.
  - _Example_: `'page/home': 'pages/index/index.html'`
- **`DYNAMIC_REGISTRY`**: Maps `<x-dynamic>` keys → `handler-function`.

## Templating

Custom syntax parsed by `posthtml`.

- `<x-include src="path/to/file">`: Partial injection.
- `<x-dynamic src="key">`: Server-side logic logic.
- `<x-inline-css src="file.css">`: Inlines styles (Dev/Build).
- `{{variable}}`: String interpolation.
