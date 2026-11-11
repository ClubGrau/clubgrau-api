# The actor's password is verified through a port that auth implements

Removing a customer requires the password of the employee who removes. The password hash lives with the employee, and `customers` must not read another module's domain or collection (`AGENTS.md` rule 6).

`customers` declares `VerifyActorPasswordPort.verify(actorId, password): Promise<boolean>` in `application/ports/outbound/`. An adapter in `auth` implements it, reusing what login already uses: `FindAuthenticatableByIdPort` and `CompareHashPort`. It answers `false` when the actor is unknown, cannot sign in (`loginCapable` is `false`), has no hash, or the password does not match. It never returns the hash or any employee data. `app.ts` injects it into `makeCustomersModule`.

This is the shape `auth` already uses to serve `employees` (`ReissueOwnSessionTokenPort`) and that `indications` uses to serve `customers` ([customer-ranking-indications ADR 0001](../customer-ranking-indications/0001-customers-consult-origins-through-a-port-implemented-by-indications.md)).

## Considered options

- **A password-confirmation middleware in `auth`**, reusable on any sensitive route. Rejected for now: the rule "remove requires the password" would live only on the route, so a second entry point to the use case would skip it and the use case specs would not notice. Employees already verify in the use case, so there would be two patterns. Middlewares in this API read the token, never the body. Revisit when a third sensitive action appears.
- **Verify through `employees`.** Rejected: `auth` already owns credential checks.
- **`customers` reads the employee collection.** Rejected: violates rule 6.

## Consequences

- `customers` does not know the actor is an employee. If another kind of user signs in one day, only `auth` changes.
- `EmployeeAuthAdapter` already imports the employee schema directly. This ADR reuses that coupling and does not resolve it.
