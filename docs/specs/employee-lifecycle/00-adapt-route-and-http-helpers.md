# Spec: Slice 0 — `adaptRoute` Actor stamp + HTTP helpers

> Shared seams used by later lifecycle slices.  
> Parent: [`README.md`](./README.md).  
> Design §11 / §6 / [ADR 0011](../../adr/remove-or-inactivate-emp/0011-adapt-route-stamps-actor-id.md) / [ADR 0012](../../adr/remove-or-inactivate-emp/0012-lifecycle-http-status-mapping.md).  
> Next: [`01-domain.md`](./01-domain.md).

## Responsibility (this spec only)

Stamp `actorId` from the JWT onto every adapted request, and add the two HTTP helpers the frontend needs to branch on (`403` / `409`).

| Spec | Responsibility |
|------|----------------|
| **This file** | `adaptRoute` + `forbidden` / `conflict` |
| [`01-domain.md`](./01-domain.md) | Matrix, Last Admin, `REMOVED`, `anonymize()` |
| [`03-update-employee-status.md`](./03-update-employee-status.md) | Controllers start **using** `actorId` / `forbidden` / `conflict` |
| [`04-remove-employee.md`](./04-remove-employee.md) | Remove command consumes the same seams |
| Auth (not this feature) | JWT re-check of current status after decode |

## When to use this spec

Use this document to change the shared HTTP adapter and helpers **before** any employees command trusts `actorId` or returns `403`/`409`.

| Artifact | This slice? |
|----------|-------------|
| `adaptRoute` stamps `actorId` last from `req.decoded.id` | Yes |
| Co-located `express-route.adapter.spec.ts` | Yes |
| `forbidden` + `conflict` in `http-helper` | Yes |
| Co-located `http-helper.spec.ts` (new helpers) | Yes |
| Employees controllers / DTOs / use cases | **No** |
| Auth middleware / JWT decode | **No** — keep reading `req.decoded` that middleware already sets |
| `employees.module` / `app.ts` / `.http` / `AGENT.md` | **No** |

**Prompt sketch for the agent:**

> Implement slice 0 of employee lifecycle following [`docs/specs/employee-lifecycle/00-adapt-route-and-http-helpers.md`](./00-adapt-route-and-http-helpers.md).  
> Stamp `actorId` from `req.decoded.id` last in `adaptRoute`. Add `forbidden` (`403`) and `conflict` (`409`) next to `unauthorized`.  
> Do not change employees controllers, use cases, or auth.

## `adaptRoute` (normative)

File: [`src/shared/infrastructure/adapters/http/express-route.adapter.ts`](../../../src/shared/infrastructure/adapters/http/express-route.adapter.ts).

Today the adapter spreads `body` + `params` + `query` + `headers` and stops. Change it to:

```ts
const request = {
  ...(req.body || {}),
  ...(req.params || {}),
  ...(req.query || {}),
  ...(req.headers || {}),
  ...(req.decoded?.id ? { actorId: String(req.decoded.id) } : {}),
};
```

Rules:

1. `actorId` is applied **last**. A body/query/header field named `actorId` is overwritten when a decoded token is present.
2. Routes without `req.decoded` (login) omit `actorId`. Do not invent a fallback.
3. Do **not** import `TokenPayload` / auth types into `@shared`. `req.decoded` is already declared on `Express.Request` by the auth middleware. Optional chaining is enough.
4. Do **not** decode `Authorization` here. Do not change `authTokenMiddleware`.
5. Create and list controllers ignore the extra field until later slices; extra keys on the request object are harmless.

Coverage already excludes `*.adapter.ts`. The spec still **runs**; do not move this logic into a covered wrapper to “fix coverage”.

## HTTP helpers (normative)

File: [`src/shared/presentation/helpers/http-helper.ts`](../../../src/shared/presentation/helpers/http-helper.ts).

Add next to `unauthorized`, same shape (`HttpErrorBody`):

```ts
export const forbidden = (error: Error): HttpResponse<HttpErrorBody> => ({
  statusCode: 403,
  body: { error: error.message },
});

export const conflict = (error: Error): HttpResponse<HttpErrorBody> => ({
  statusCode: 409,
  body: { error: error.message },
});
```

Do not change `badRequest` / `unauthorized` / `ok` / `created` / `serverError`.

No employees controller may call these helpers in this slice.

## Files

| File | Action |
|------|--------|
| `src/shared/infrastructure/adapters/http/express-route.adapter.ts` | Stamp `actorId` last |
| `src/shared/infrastructure/adapters/http/express-route.adapter.spec.ts` | Create |
| `src/shared/presentation/helpers/http-helper.ts` | Add `forbidden` + `conflict` |
| `src/shared/presentation/helpers/http-helper.spec.ts` | Create (cover the two new helpers; existing ones optional) |
| Employees / auth / `app.ts` | Do not change |

## Spec expectations

### `express-route.adapter.spec.ts`

Build a fake `BaseController` (`handle` resolved to `{ statusCode: 200, body: { data: { ok: true } } }`) and a fake Express `res` (`status` + `json` chainable).

| `it(...)` | Assert |
|-----------|--------|
| `should be defined` | adapter factory returns a function |
| `should forward body, params, query and headers to handle` | merged object contains those keys |
| `should stamp actorId from req.decoded.id` | `handle` received `actorId` equal to the JWT id |
| `should overwrite body actorId with req.decoded.id` | body `{ actorId: 'forged' }` + decoded `{ id: 'jwt-actor' }` → `actorId: 'jwt-actor'` |
| `should coerce decoded.id with String()` | numeric/other id becomes string |
| `should omit actorId when req.decoded is missing` | login-style request has no `actorId` from the adapter |
| `should omit actorId when req.decoded.id is missing` | decoded object without `id` does not stamp |
| `should write the controller HttpResponse status and body` | `res.status(200).json({ data: { ok: true } })` |

Do not hit Express, Mongo, or a real employees controller.

### `http-helper.spec.ts`

| `it(...)` | Assert |
|-----------|--------|
| `should return 403 with { error } from forbidden` | `forbidden(new Error('nope'))` → `{ statusCode: 403, body: { error: 'nope' } }` |
| `should return 409 with { error } from conflict` | same shape, `409` |

## Checklist (agent)

- [ ] `actorId` is set last from `req.decoded.id`
- [ ] Body cannot forge `actorId` when a token is present
- [ ] Routes without `decoded` omit `actorId`
- [ ] No auth decode in `@shared`
- [ ] `forbidden` → `403`; `conflict` → `409`; body `{ error: message }`
- [ ] Co-located specs pass
- [ ] No employees / auth / schema / entity edits

## Out of scope

- Forwarding `actorId` into `UpdateEmployeeStatusDto` / Remove DTO
- Mapping domain errors to `403`/`409` in controllers
- JWT re-check of current employee status
- Changing `authTokenMiddleware`

## Acceptance criteria

- [ ] Request with Bearer whose decoded id is `A` and body `{ actorId: "B", id: "T" }` reaches `handle` with `actorId: "A"`
- [ ] Request without `decoded` does not receive an adapter-stamped `actorId`
- [ ] `forbidden(err).statusCode === 403` and `conflict(err).statusCode === 409`
- [ ] Adapter + helper specs pass
- [ ] Existing employees/auth unit specs still pass (extra `actorId` key is ignored)

## Reference map

| Concern | Look at |
|---------|---------|
| Adapter today | `src/shared/infrastructure/adapters/http/express-route.adapter.ts` |
| `req.decoded` | `src/modules/auth/infrastructure/inbound/http/auth-token.middleware.ts` |
| Helper style | `unauthorized` in `http-helper.ts` |
| Why stamp here | [ADR 0011](../../adr/remove-or-inactivate-emp/0011-adapt-route-stamps-actor-id.md) |
| Why `403`/`409` | [ADR 0012](../../adr/remove-or-inactivate-emp/0012-lifecycle-http-status-mapping.md) |
| Next slice | [`01-domain.md`](./01-domain.md) |
