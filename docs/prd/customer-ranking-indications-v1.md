# PRD: Customer Rank and Indication on Create

**Product Requirements Document**
**Date:** 15/10/2026 | **Status:** Draft, aligned in grilling session | **Version:** 1.0

**Related:** [`indication-catalog-v1.md`](indication-catalog-v1.md) (catalog of origins), [`docs/specs/create-customer.md`](../specs/create-customer.md) (Create Customer Part 1), [`docs/specs/customer-ranking-indications/`](../specs/customer-ranking-indications/README.md) (implementation specs)
**Glossary:** the catalog terms (Category, Origin, End, Reopen) live in [`src/modules/indications/CONTEXT.md`](../../src/modules/indications/CONTEXT.md). A `CONTEXT.md` for `customers` (Rank, Indication, Referrer) is created together with the design doc.

This document specifies how a **customer is born** in the API: with a **rank** (always Bronze) and, optionally, with one **indication** (Canal, Campanha, or Amigo). It does **not** specify how a customer climbs to Silver or Gold, nor how customers are listed or read.

---

## 1. Overview and objective

Today the API creates a customer with `name`, `email`, `phone`, `nif`, and `createdAt`. Nothing more. The frontend (`grau-frontend`) already designs a richer customer: a **rank** (Bronze, Prata, Ouro) and a question at registration, "Veio por indicação?", which links the customer to a Channel, a Campaign, or a Friend. Today that lives in a hardcoded client adapter, and the friend link is a typed name matched by text.

The business wants two things from the moment a customer exists:

1. **A ranking.** Every customer is born at the bottom of the ladder: Bronze. The rule that moves a customer to Silver or Gold is still being defined with the domain expert and is **not** part of this version.
2. **An indication.** The operator can record where the customer came from: a catalog **Channel**, a catalog **Campaign**, or an existing customer who referred them (**Friend**).

**Objective:** `POST /api/customer` creates a customer already holding its rank (Bronze) and, when sent, exactly one valid indication. Nothing is written when the indication is invalid.

**Non-goals (this version):**

- Any rule, command, job, or endpoint that changes a rank (Silver, Gold, or back to Bronze)
- Listing or reading customers (list, get, filter by rank, summary by rank, "Indicou N")
- Changing or removing an indication after the customer is created
- A friend picker backed by the API (it depends on reading customers, see section 3)
- The indications board
- A migration or backfill (there are no customers stored before this feature)

---

## 2. Business rules (core logic)

### Rule 2.1 — Rank ladder

There are exactly three ranks, from lowest to highest:

| Order | Value | UI label (frontend) |
|-------|-------|---------------------|
| 1 | `BRONZE` | Bronze |
| 2 | `SILVER` | Prata |
| 3 | `GOLD` | Ouro |

The contract values are in English, like roles. The frontend maps them to the Portuguese labels it already shows. "Bronx" in early notes is a typo for Bronze, not a term.

### Rule 2.2 — A customer is born Bronze

Every new customer has rank `BRONZE`. This is a domain rule, not input:

- The create body does not carry a rank. A `rank` sent in the body has no effect.
- There is no way to create a customer as Silver or Gold.
- The rank is part of the customer from birth. A customer without a rank does not exist.

### Rule 2.3 — Climbing is not defined yet

This version defines **no** transition from Bronze to Silver or from Silver to Gold, and no endpoint to change a rank. What characterizes the climb is an **open decision** with the domain expert (see section 8). The frontend comment "frequency changes it later" is an intention, not a rule.

The entity must be able to hold the three ranks so a later PRD can add the transition without reshaping the customer.

### Rule 2.4 — The indication is optional and all-or-nothing

A customer may be created with **no indication**. In that case the `indication` field is absent or `null`, and the customer has no link.

When an indication is sent, it is complete and valid, or the create is refused. There is no half link. There is no `wasReferred` flag: "came by indication" is simply "has an indication".

One customer has **at most one** indication.

### Rule 2.5 — Indication by Channel or Campaign

For `categoryId` `canal` or `campanha`, the request carries an `originId`. The origin must:

- exist in the catalog;
- belong to the category named in `categoryId` (a campaign id under `canal` is refused);
- be **active**. An ended origin is refused.

A `referrerCustomerId` in this shape is refused.

### Rule 2.6 — Indication by Friend

For `categoryId` `amigo`, the request carries a `referrerCustomerId`: the id of the **existing customer who referred** the new one. That customer must exist.

- A friend is a customer, not a typed name. There is no free-text friend.
- An `originId` in this shape is refused. Amigo holds no origins.
- One customer can have referred many customers.
- A customer cannot refer themselves: the new customer has no id before the create, so the case does not arise at birth.

### Rule 2.7 — Incoherent or unknown shapes are refused

Refused, with nothing written:

- `indication` present with an unknown `categoryId`, or without `categoryId`;
- `canal` or `campanha` without `originId`;
- `amigo` without `referrerCustomerId`;
- `originId` and `referrerCustomerId` together, or the one that does not belong to the category.

### Rule 2.8 — The link is a record of the moment

The indication is fixed at creation. This version has no command to change or clear it.

Ending an origin later does **not** affect customers already linked to it. The origin record stays in the catalog (the catalog never deletes), so the customer's link keeps pointing at a real row. Reopening changes nothing in existing links either.

### Rule 2.9 — Create is atomic

The create validates everything (name, email, email availability, indication) before writing. If anything is refused, no customer is written.

### Rule 2.10 — Who may operate

- `POST /api/customer`: any authenticated employee (`ADMIN`, `MANAGER`, `EMPLOYEE`). Unchanged. A missing or invalid session is refused as today.
- Reading linkable origins (Rule 2.11): any authenticated employee.
- The full catalog read and all catalog commands (create, correct name, end, reopen): still `ADMIN` and `MANAGER` only. **Not changed by this PRD.**

### Rule 2.11 — Linkable origins read

So that an `EMPLOYEE` can choose an origin while registering a customer, a new, small read returns the origins that can be linked **now**:

- Only **active** origins of Canal and Campanha.
- Each item exposes `id`, `categoryId`, and `name`. Nothing else.
- Order: Canal first, then Campanha. Inside a category, in the order the origins were created.
- Amigo never appears (it holds no origins).
- With no active origin, the list is empty.

This is not the catalog. It does not return ended origins, and it does not return categories.

This read exists **only to feed the picker**. The create never trusts it: the `originId` that arrives in `POST /api/customer` is always validated against the catalog (Rule 2.5), because the list can be stale (an origin ended after the screen loaded) or the call can come from outside the screen. An `ADMIN` or `MANAGER` may keep reading the full catalog for the same picker; the linkable read is what makes it possible for an `EMPLOYEE`.

---

## 3. Data contracts and dependencies

**HTTP:**

```http
POST /api/customer
Authorization: Bearer <token>
{
  "name": "Maria Silva",
  "email": "maria@example.com",
  "phone": "...",          // optional
  "nif": 123456789,        // optional
  "indication": { "categoryId": "canal", "originId": "<origin id>" }
}
```

```http
POST /api/customer
Authorization: Bearer <token>
{
  "name": "João Costa",
  "email": "joao@example.com",
  "indication": { "categoryId": "amigo", "referrerCustomerId": "<customer id>" }
}
```

```http
POST /api/customer
Authorization: Bearer <token>
{ "name": "Ana Reis", "email": "ana@example.com" }
```

Success: `201` `{ "data": { "id": "..." } }`, as today. The customer is stored with `rank = BRONZE` and the indication that was sent, if any.

```http
GET /api/indication-linkable-origins
Authorization: Bearer <token>
→ 200 { "data": { "origins": [ { "id": "...", "categoryId": "canal", "name": "Instagram" } ] } }
```

**Removed from the frontend contract:** `wasReferred` and the free-text `referral`. `indicationCategoryId` and `indicationOriginId` become the nested `indication` object.

**Dependencies:**

| Dependency | Effect |
|-----------|--------|
| Indication catalog (existing) | Source of origins. The linkable read is served from it. Customers do not read the indications domain directly: they consult it through their own outbound port. |
| Frontend `grau-frontend` | Maps `BRONZE/SILVER/GOLD` to Bronze/Prata/Ouro, sends `indication` as one object, and uses the linkable read instead of the catalog read for the origin picker. |
| Customer read (future PRD) | A friend picker needs customer search. Until it exists, the API accepts Amigo but the frontend cannot pick a real friend and keeps its hardcoded data for that step. |

**Other modules:** `indications` exposes the linkable read and the lookup used to validate an origin. `employees` and `auth` are unchanged.

---

## 4. User stories

1. **As an ADMIN, MANAGER, or EMPLOYEE:** I want every customer I register to start as Bronze, so no one begins with an unearned rank.
2. **As an ADMIN, MANAGER, or EMPLOYEE:** I want to register a customer with no indication when they simply walked in.
3. **As an ADMIN, MANAGER, or EMPLOYEE:** I want to record that a customer came from a Channel or a Campaign, choosing among the origins in use now.
4. **As an ADMIN, MANAGER, or EMPLOYEE:** I want to record that a customer came from another customer (a friend), pointing at that customer and not typing a name.
5. **As an EMPLOYEE:** I want to see the origins I may choose, without being able to read or change the whole catalog.
6. **As an ADMIN or MANAGER:** I want ending an origin to leave existing customers intact, with their link still valid.
7. **As the domain expert (later):** I want the entity ready for Silver and Gold, so the climb rule can be added without reshaping the customer.

---

## 5. Edge cases

- **No `indication` / `indication: null`:** customer created, no link, rank Bronze.
- **`rank` in the body (any value):** ignored. The customer is Bronze.
- **`canal` with an active channel:** created and linked.
- **`canal` with an ended channel:** refused, nothing written.
- **`canal` with a campaign id, or `campanha` with a channel id:** refused.
- **`canal` or `campanha` with an unknown `originId`:** refused.
- **`canal` or `campanha` without `originId`:** refused.
- **`amigo` with an existing customer id:** created and linked.
- **`amigo` with an unknown customer id:** refused, nothing written.
- **`amigo` without `referrerCustomerId`:** refused.
- **`amigo` with `originId`:** refused.
- **`canal` with `referrerCustomerId`:** refused.
- **Unknown `categoryId`, or `indication` without `categoryId`:** refused.
- **A valid indication but an email already used:** refused. The indication does not rescue a duplicate email.
- **An invalid indication but a valid customer:** refused. The customer is not created "without indication".
- **Origin ended after the customer was linked:** the customer keeps the link. The origin stays in the catalog, ended.
- **Origin reopened after being ended:** can be chosen again. Customers linked earlier are unchanged.
- **Same customer referring many:** allowed.
- **Linkable read with no active origins:** empty list. An origin ended after the read is refused at create (Rule 2.5).
- **Linkable read, ended origin:** not returned.
- **No session:** refused on create and on the linkable read.
- **EMPLOYEE on `POST /api/customer` and on the linkable read:** allowed. **EMPLOYEE on the catalog read or catalog commands:** still refused.

---

## 6. Interview analysis (how these rules were reached)

These scenarios were walked during the grilling session. They are the rationale, not extra product scope.

**Why the indication is optional.** The registration form already asks "Veio por indicação? Sim/Não", and "Não" is a real answer. Forcing an indication would invent a false origin for walk-ins. Absence of the link is the honest state, so there is no fourth category and no `wasReferred` flag, which could drift out of line with the link itself.

**Why a friend is an id, not a name.** The prototype stores the friend as typed text and later matches it by name. Two customers with the same name, or a rename, would break the link. The catalog glossary already says Friend is "a customer who referred another", not a name in the catalog. The id keeps the link and lets a later read count how many customers someone referred.

**Why the rank is stored, not computed.** The rule for Silver and Gold is not defined, and the API has no history (visits, spend) to compute it from. A stored rank, born Bronze, is the smallest truthful model. A later PRD adds the transition.

**Why no endpoint changes the rank now.** Exposing a manual change before the rule exists would let the floor invent a ladder. Rank moves only when the domain expert's rule is written.

**Why English values.** `BRONZE`, `SILVER`, `GOLD` follow the roles (`ADMIN`, `MANAGER`, `EMPLOYEE`). The frontend already owns the Portuguese labels, so the mapping costs one lookup. Category ids stay Portuguese (`canal`, `campanha`, `amigo`) because they were fixed by the catalog PRD and are business vocabulary.

**Why an invalid indication refuses the whole create.** Silently creating the customer without the link would lose information the operator believed was saved. A refusal lets the operator correct and resend.

**Why an ended origin is refused at create, but kept for old links.** End means "stop offering". It does not rewrite history. Customers already tied to the origin keep a valid row, which is the reason the catalog never deletes.

**Why a new read for linkable origins.** The catalog read is `ADMIN` and `MANAGER` only, by decision of the catalog PRD. Any employee may register customers, so an `EMPLOYEE` could not choose a Channel or Campaign. A small, active-only read solves the picker without reopening the catalog decision, and without exposing ended origins, the categories, or the write commands.

**Why a nested `indication` object.** All-or-nothing becomes visible in the shape, the cross-field validation lives in one place, and the client sends one object instead of four loose fields that can contradict each other.

**Why Amigo is in this version even without a customer read.** The create contract should be complete and not reopened. The friend picker waits on the customer read, which is declared as a dependency, not hidden.

**Why there is no migration.** The feature is new and no customers were stored before it.

**Why customers do not read the indications domain.** Hexagons do not import each other's `domain`. `customers` asks `indications` through its own port: "give me the origin I may link, with its category and whether it is active".

---

## 7. Acceptance criteria (minimum)

- [ ] A customer created with no `indication` is stored with rank `BRONZE` and no link.
- [ ] A customer created with any valid indication is stored with rank `BRONZE`.
- [ ] A `rank` sent in the body does not change the stored rank.
- [ ] Channel: an active channel id under `canal` creates and links the customer.
- [ ] Campaign: an active campaign id under `campanha` creates and links the customer.
- [ ] Friend: an existing customer id under `amigo` creates and links the customer.
- [ ] An ended origin, an unknown origin, an origin of another category, or a missing `originId` is refused and writes nothing.
- [ ] An unknown `referrerCustomerId` or a missing one under `amigo` is refused and writes nothing.
- [ ] `originId` under `amigo`, or `referrerCustomerId` under `canal`/`campanha`, is refused and writes nothing.
- [ ] An unknown `categoryId`, or `indication` without `categoryId`, is refused and writes nothing.
- [ ] A duplicate email is refused with or without an indication, and writes nothing.
- [ ] Ending an origin after linking leaves the linked customer unchanged.
- [ ] The linkable read returns only active Canal and Campanha origins (`id`, `categoryId`, `name`), Canal first, then Campanha, each in creation order, and an empty list when there are none.
- [ ] `EMPLOYEE` can create a customer and call the linkable read, and is still refused on the catalog read and every catalog command. No session is refused everywhere.
- [ ] No endpoint or code path changes a rank.

---

## 8. Open decisions

| Decision | Owner | Blocks |
|----------|-------|--------|
| What characterizes the climb from Bronze to Silver and Gold (frequency, spend, referrals, other) | Domain expert | The rank-transition PRD |
| Whether a referral (a customer referring others) counts toward the climb | Domain expert | The rank-transition PRD |
| Customer read: list, get, filter and summary by rank, "Indicou N", and the customer search the friend picker needs | Product / next PRD | Real friend picker in the frontend |
| Changing or correcting an indication after creation | Product | Not planned |
