# Spec: Slice 3 — Actor password verifier (auth)

> `auth` answers "does this password belong to this actor?" for `customers`.  
> Parent: [`README.md`](./README.md).  
> Depends on: [`02-application.md`](./02-application.md) (`VerifyActorPasswordPort`).  
> Design §9 / [ADR 0003](../../adr/remove-customer/0003-actor-password-is-verified-through-a-port-implemented-by-auth.md).  
> Next: [`04-http.md`](./04-http.md).

## Responsibility (this spec only)

One adapter in `auth` that implements a `customers` port, reusing what login already uses. It returns a boolean and never exposes the hash or the actor.

Paths below are under `src/modules/auth/`.

## When to use this spec

| Artifact | This slice? |
|----------|-------------|
| `infrastructure/outbound/actor-password-verifier.adapter.ts` + spec | Yes |
| `makeAuthModule` builds and returns it | **No** (slice 5) |
| A new auth port, use case, or route | **No** |

**Prompt sketch for the agent:**

> Implement slice 3 of Remove Customer following [`docs/specs/remove-customer/03-auth.md`](./03-auth.md).  
> Create `ActorPasswordVerifierAdapter` implementing `VerifyActorPasswordPort` from customers, using `FindAuthenticatableByIdPort` and `CompareHashPort`. Do not change login or the module factory.

## Adapter

File: `infrastructure/outbound/actor-password-verifier.adapter.ts`. Same placement and style as `ReissueOwnSessionTokenAdapter`, which implements an `employees` port.

```ts
import { FindAuthenticatableByIdPort } from '@modules/auth/application/ports/outbound/find-authenticatable-by-id.port'
import { VerifyActorPasswordPort } from '@modules/customers/application/ports/outbound/verify-actor-password.port'
import { CompareHashPort } from '@shared/application/ports/compare-hash.port'

export class ActorPasswordVerifierAdapter implements VerifyActorPasswordPort {
  constructor(
    private readonly findAuthenticatableById: FindAuthenticatableByIdPort,
    private readonly compareHash: CompareHashPort,
  ) {}

  async verify(actorId: string, password: string): Promise<boolean>
}
```

`verify`:

1. `actorId` or `password` empty → `false`.
2. `const user = await findAuthenticatableById.findAuthenticatableById(actorId)`.
3. `!user`, `!user.loginCapable`, or `!user.passwordHash` → `false`.
4. `return await compareHash.compare(password, user.passwordHash)`. A throw from `compare` → `false`.

A throw from `findAuthenticatableById` (database down) propagates. It is not a wrong password.

The only `customers` import is the port file. Do not import `@modules/customers/domain`.

## Files

| Action | Path |
|--------|------|
| Create | `src/modules/auth/infrastructure/outbound/actor-password-verifier.adapter.ts` |
| Create | `src/modules/auth/infrastructure/outbound/actor-password-verifier.adapter.spec.ts` |

## Spec expectations

Stubs for `FindAuthenticatableByIdPort` and `CompareHashPort`. Default user: `loginCapable: true`, `passwordHash: 'hash'`.

- Matching password → `true`; `compare` receives `(password, 'hash')`.
- `compare` resolves `false` → `false`.
- `compare` rejects → `false`.
- User `null` → `false`; `compare` not called.
- `loginCapable: false` → `false`; `compare` not called.
- No `passwordHash` → `false`; `compare` not called.
- Empty `actorId` or `password` → `false`; neither stub called.
- `findAuthenticatableById` rejects → the error propagates.

## Acceptance criteria

- [ ] The adapter returns only a boolean.
- [ ] An actor who cannot sign in is refused even with the right password.
- [ ] Login, reset, and the token middleware are unchanged.

## Out of scope

- Building it in `makeAuthModule` and passing it to customers (slice 5).

## Checklist

- [ ] Implements `VerifyActorPasswordPort`.
- [ ] Reuses `FindAuthenticatableByIdPort` and `CompareHashPort`; no direct Mongoose access.
- [ ] Spec covers every row above.
