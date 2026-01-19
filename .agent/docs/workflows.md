# Workflows

## 1. Create a Page

**Rule**: No Frameworks (Vanilla DOM only). No Client Router (Standard `<a>` tags).

1.  **File**: Create `pages/<name>/index.html`.
2.  **Route**: Add to `PAGE_REGISTRY` in `backend/registries.js`.
    - `'page/<url>': 'pages/<name>/index.html'`

## 2. Add Styles

**Rule**:

1. **No External CSS**: Must use `<x-inline-css src="...">`.
2. **No Hardcoded Values**: ALWAYS use tokens from `styles/variables.css` (e.g. `var(--color-navy)`, `var(--space-md)`). **Do not use hex codes or pixels directly.**

3. **File**: Create `styles/<name>.css`.
4. **Usage**: In your HTML head:
   ```html
   <x-inline-css src="<name>.css"></x-inline-css>
   ```
5. **Variables**: Check `styles/variables.css` first. If a value is missing, add it there, then use it.

## 3. Dynamic Logic

For pieces that change per-request (e.g. Auth, Guestbook).

1.  **Handler**: Create function in `backend/` (or `*.server.js`).
2.  **Registry**: Register in `DYNAMIC_REGISTRY` (`backend/registries.js`).
3.  **Template**:
    ```html
    <x-dynamic src="<registry-key>"></x-dynamic>
    ```
