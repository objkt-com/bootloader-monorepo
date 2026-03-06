# Implementing A Bootloader

This repo treats a bootloader as three layers:

1. Shared identity and chain metadata
2. Frontend definition and UI
3. Optional worker/runtime support

## 1. Add shared metadata

Update:

- `shared/bootloaders/catalog.ts`
- `shared/bootloaders/contracts.ts`

Add the new bootloader id, current version, spec string, storage type, and any contract addresses.

If the bootloader is an uploaded-project runtime, also add or reuse a protocol module like `shared/bootloaders/boot-web.ts`.

## 2. Add frontend definition

Create a folder under `apps/web/src/bootloaders/<bootloader-id>/`.

At minimum define:

- `definition.ts`
- `creator.tsx`
- `viewer.tsx`
- `generator-detail-view.tsx`
- `token-detail-view.tsx`

Optional:

- `edit-page.tsx`
- protocol-specific helpers such as URL, workflow, or artifact parsing modules

The definition must export a `BootloaderDefinition` and provide:

- `id`
- `currentVersion`
- `spec`
- `features`
- `ViewerComponent`
- `CreatorComponent`
- `GeneratorDetailViewComponent`
- `TokenDetailViewComponent`
- `operations`

Then register it in `apps/web/src/lib/bootloader-registry.ts`.

## 3. Wire read/write adapters

Frontend reads should go through service/adaptor code, not page-local chain parsing.

Current shared entry points:

- `apps/web/src/services/tzkt.ts`
- `apps/web/src/services/tezos.ts`

If the new bootloader needs special read or write behavior, add small adapter functions/modules and keep pages calling the shared service surface.

## 4. Add worker support only if needed

Not every bootloader needs worker changes.

Examples:

- thumbnail/share metadata support
- worker-side feature extraction
- uploaded-project manifest/runtime handling

Current worker extension points live in:

- `worker/src/lib/bootloader-chain.ts`
- `worker/src/lib/render-jobs.ts`
- `worker/src/lib/share-meta.ts`

Keep bootloader-specific logic in those modules rather than adding more branching to `worker/src/index.ts`.

## 5. Verify

Run:

- `npm run test:bootloaders`
- `npm run build --prefix apps/web`
- `npm run check:worker`

## Notes

- `svg-js` is manifest-free because it is on-chain code, not an uploaded project.
- `boot:web`-style manifests apply only to uploaded-project bootloaders such as `generic-web`.
- New bootloaders should be additive: shared metadata, frontend definition, optional worker hooks, then tests.
