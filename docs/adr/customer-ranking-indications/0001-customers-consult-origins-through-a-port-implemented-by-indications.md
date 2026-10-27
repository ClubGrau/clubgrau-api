# Customers consult origins through a port that indications implements

To link a customer to a Channel or Campaign, `customers` must know, for an `originId`, whether the origin exists, which category it sits in, and whether it is active. Those facts belong to `indications`. `customers` declares an outbound port in `application/ports/outbound/` that returns **facts** (`{ id, categoryId, active }`, or `null`). An adapter inside `indications` implements it, reusing `FindIndicationOriginByIdPort` and the origin entity's `active`. `app.ts` injects the adapter into `makeCustomersModule`. This is the same shape `auth` already uses to serve `employees` (`ReissueOwnSessionTokenPort`).

The use case calls the port, then hands the facts as plain data to a pure domain rule on `Indication` (the category matches, the origin is active). The domain calls no port, so the port can live in `application` and `indications` imports a port, never a `customers` domain type. The same pattern covers "the referrer customer exists", with the port implemented by `customers`' own repository.

## Considered options

- **Adapter inside `customers` reading the `origins` collection.** Rejected: `customers` would learn the schema and the interval rule for "active", and break whenever `indications` changes it.
- **The port answers only "may link / may not".** Rejected: the rule "what a customer may link" is a customer rule, and `customers` could not say why it refused (unknown, wrong category, ended).
- **Domain service with the port in `domain/ports/`** (the style of the email policy). Rejected: `indications` would import a `customers` domain file, which `AGENTS.md` rule 6 forbids.
- **Policy service in `application` that decides everything.** Rejected: it moves a business rule out of the domain for no gain.

## Consequences

`customers` keeps its own copy of the three category codes (see [ADR 0002](0002-indication-is-an-embedded-value-object-owned-by-customers.md)). `app.ts` must build `indications` before `customers`.
