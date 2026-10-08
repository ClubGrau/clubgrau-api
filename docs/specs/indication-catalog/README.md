# Specs: Indication Catalog (v1)

> Implementation contracts for the slices in design-doc §13.  
> Design: [`docs/design-docs/indication-catalog-v1.md`](../../design-docs/indication-catalog-v1.md).  
> PRD: [`docs/prd/indication-catalog-v1.md`](../../prd/indication-catalog-v1.md) (v1.1).  
> Glossary: [`src/modules/indications/CONTEXT.md`](../../../src/modules/indications/CONTEXT.md).  
> ADRs: [`docs/adr/indication-catalog/`](../../adr/indication-catalog/).  
> Constitution: [`AGENTS.md`](../../../AGENTS.md).

Implement **one slice at a time**, in this order. Do not skip. Do not pull a later slice’s use case, query, or HTTP into an earlier slice.

This is a **new hexagon** `src/modules/indications`. Today that folder holds only `CONTEXT.md`. There is no `AGENT.md` until slice 4. Do not create it before the routes exist.

`adaptRoute`, `authTokenMiddleware`, `requireRoles`, `created` / `ok` / `badRequest` / `conflict` / `unauthorized` / `forbidden` / `serverError` already exist. No shared-infra slice. The module does not take the encrypter, the mailer, or a compare-hash port. Use cases do not load an actor.

| Slice | Spec | Ships |
|-------|------|-------|
| 0 | [`00-domain.md`](./00-domain.md) | `IndicationCategories`; `IndicationOrigin`; errors; `IndicationOriginNamePolicy` + availability port |
| 1 | [`01-persistence.md`](./01-persistence.md) | Schema, mapper, repository methods in design §10, including `11000` → name taken. Write port + `list` row type live here so the repository can implement them |
| 2 | [`02-commands.md`](./02-commands.md) | Create, correct the name, end, reopen. Inbound ports + use cases. No-op correct / end / reopen does not write |
| 3 | [`03-query.md`](./03-query.md) | `GetIndicationCatalogQuery` groups the category constant with `list` rows. No intervals, no `nameKey`, no `position` on the result |
| 4 | [`04-http-and-contract.md`](./04-http-and-contract.md) | Five controllers, routes, `makeIndicationsModule`, `app.ts`, `src/client/indication.http`, `AGENT.md` |

**Dependencies:** `1` needs the domain error and the snapshot types from `0`. `1` does not need `2`. `2` needs `0` and `1`. `3` needs `1` (the `list` port); it does not need `2`. `4` needs `2` and `3`. Do not merge `2` and `4`. Do not merge `3` and `4`.

The write repository port is born in slice 1, with the class that implements it. Slice 2 does not invent a second write interface. Slice 3 does not invent a second `list`.

Use the glossary. Do not invent parallel terms (Category / Origin / Channel / Campaign / Friend / End / Reopen / Correct the name). `nameKey`, `position`, `intervals`, and `holdsOrigins` are implementation names, not glossary terms.

**Out of these slices:** creating, renaming, or removing a category. Deleting an origin, or moving it to the other category. An origin in Amigo. Seeding Instagram, TikTok, Google, or any campaign. The board (last entry, pace, quality, signal, brief, period, search, attention order, day count). Returning intervals or days on the catalog `GET`. A field on Customer. Rank. The friend row. A domain policy for the role matrix (`requireRoles` is the gate). Boot inserting origins.
