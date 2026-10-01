# Application Agent Guidance

- Read only the documentation relevant to your changes:
  - `README.md`
- Inspect the existing files, structure, and package scripts before making changes.
- Before adding UI, read the affected page, shared components and their existing call sites. Reuse or extend suitable components instead of duplicating their behavior. Check affected consumers when changing a shared component.
- Retain and adapt useful primitives under `src/components`. The root already mounts `AppToaster` with Lucide icons; preserve that host and call `toast` from `sonner` from any page. Follow the actual feature's imports and established styling.
- Preserve established boundaries and keep changes focused on the requested behavior.
- Run the relevant checks defined in `package.json` before completing the task.

- By default, style all product components with inline Tailwind utilities. Keep CSS files limited to Tailwind imports, theme tokens, global base rules, and necessary custom keyframes; do not build a parallel stylesheet of component classes. If the user explicitly requests native CSS or another styling approach, follow that request instead of this application default.
- Format the files changed by the task with the configured formatter and inspect the final diff. Choose focused checks for the affected behavior and risk; do not run project-wide formatting, all tests, lint and build automatically for an isolated cosmetic edit. New functionality, shared contracts and build changes need the applicable broader checks. The configured Prettier plugins sort import groups with blank-line separation and order Tailwind classes.

## Server requests

- Use TanStack Query for server requests; do not manage request state and caching manually in effects. QueryClientProvider is already mounted in src/main.tsx. src/lib/query-client.ts owns the defaults. Follow the three hooks in src/examples (useQuery, useMutation with invalidation, useInfiniteQuery) and src/examples/query-examples.tsx. Replace the in-memory demo API with real endpoints using src/lib/request-json.ts and pass AbortSignal through to fetch.

## Tables and required fields

- Reuse the compound Table from `src/components/table.tsx`; inspect `src/examples/table-example.tsx` for its header, body, footer, row, cell and caption parts. Keep horizontal scrolling within the table.
- Keep required-field text and its asterisk together in the label text wrapper with a non-breaking space before the marker. Do not make the asterisk a separate grid or flex item. Follow the validated form example for required-state accessibility.
