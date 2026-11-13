# PRD: Remove Customer

**Product Requirements Document**
**Date:** 11/11/2026 | **Status:** Draft, aligned in grilling session | **Version:** 1.0

**Related:** [`customer-ranking-indications-v1.md`](customer-ranking-indications-v1.md) (rank and indication on create), [`employee-lifecycle-v1.md`](employee-lifecycle-v1.md) (employee remove, the precedent), [design doc](../design-docs/remove-customer-v1.md), [ADRs](../adr/remove-customer/)
**Glossary:** [`src/modules/customers/CONTEXT.md`](../../src/modules/customers/CONTEXT.md) (Customer, Referrer, Remove, Removed customer)

This document specifies how a customer is **removed** from the salon's customer base. Removal is an anonymization that keeps the customer's identity, so the links that point at it (indications today, sales tomorrow) stay whole. It does **not** specify inactivity, updating a customer, or sales.

---

## 1. Overview and objective

Today a customer can be created and listed, nothing more. There is no way to take a customer out of the base. The business needs one for a single situation: **the customer asks for their data to be erased**.

A hard delete is not acceptable. Other records already point at a customer by id: a Friend indication stores the Referrer's `referrerCustomerId`. Sales, which do not exist yet, will point at the customer too. Deleting the document would orphan those links and erase history the salon still needs to show.

**Objective:** `POST /api/customer/remove` takes an existing customer out of the customer base. The customer keeps its id and name, so its history still reads correctly. Its contact data and NIF are erased. It no longer appears in the customer list and can no longer be chosen as a Referrer.

**Non-goals (this version):**

- Correcting a wrong registration (a future update command covers it)
- Inactivity. It will be **computed** from the date of the customer's last paid order, by rules the domain experts will define. No manual inactive status is created here
- Undoing a removal (there is no restore)
- Any change to sales, commissions, or rank rules
- Recording who removed the customer

---

## 2. Business rules (core logic)

### Rule 2.1 — Remove is anonymization, not deletion

The customer document stays. Its id never changes.

| Field | After remove |
|-------|--------------|
| `id` | kept |
| `name` | kept |
| `email` | replaced by a unique sentinel; the original email is freed |
| `phone` | erased |
| `nif` | erased |
| `rank` | kept, frozen |
| `indication` | kept |
| `createdAt` | kept |
| `removedAt` | set to the moment of removal |

### Rule 2.2 — The name is kept on purpose

The name stays so that the history of indications (and, later, of sales) can still say **who** the customer was. This is a conscious choice: keeping the name does not fully satisfy a GDPR erasure request. See [ADR 0001](../adr/remove-customer/0001-customer-remove-is-anonymization-keeping-the-name.md).

### Rule 2.3 — Removal is terminal

A removed customer cannot be removed again, edited back, or restored. Removing an already removed customer is refused.

### Rule 2.4 — A returning person is a new customer

The original email is freed, so the same person can be registered again. That registration is a **new customer**: a new id, born Bronze, with no indication inherited and no link to the removed record. Everything stored against the removed id stays there.

### Rule 2.5 — A removed customer leaves the customer base

- It does not appear in `GET /api/customers`, in the items, the `total`, or the search.
- It cannot be chosen as the Referrer of a new customer. A create with `amigo` pointing at a removed customer is refused, as if the referrer did not exist.

### Rule 2.6 — A removed customer stays in the history

- Customers it referred keep their indication. The listing still shows the Referrer's name and flags that the Referrer was removed (`referrerRemoved: true`).
- Its own indication, `createdAt`, and rank are kept, so removing a customer does not rewrite channel, campaign, or referral numbers retroactively. Rules that need to ignore removed customers (future rank rules) filter on `removedAt`.

### Rule 2.7 — Who may remove

Only `ADMIN` and `MANAGER`. An `EMPLOYEE` is refused. This differs from employees, where only `ADMIN` removes: the customer base is operational data that a manager runs day to day.

### Rule 2.8 — The actor confirms their own password

The request carries the password of the employee who is removing. A wrong password, or an actor who can no longer sign in, is refused with the same opacity as login. Nothing is changed.

---

## 3. Data contracts and dependencies

**HTTP:**

```http
POST /api/customer/remove
Authorization: Bearer <token>
{ "id": "<customer id>", "password": "<actor password>" }
→ 200 { "data": { "id": "<customer id>" } }
```

**Listing (additive change):** the Friend indication gains `referrerRemoved`.

```json
{ "categoryId": "amigo", "referrerCustomerId": "...", "name": "Maria Silva", "referrerRemoved": true }
```

Canal and Campanha indications are unchanged.

**Dependencies:**

| Dependency | Effect |
|-----------|--------|
| `auth` (existing) | Verifies the actor's password, reusing what login already does. `customers` asks through its own port and gets a boolean back |
| Frontend `grau-frontend` | Offers remove to `ADMIN` and `MANAGER` only, asks for the password, and shows a removed Referrer as such (no link to open) |
| Sales (future PRD) | Will link sales to the customer id. Decides whether a sale keeps its own copy of the customer name |
| Rank rules (future PRD) | Excludes removed customers from metrics using `removedAt` |

---

## 4. User stories

1. **As an ADMIN or MANAGER:** I want to remove a customer who asked for their data to be erased, so their contact data and NIF leave the system.
2. **As an ADMIN or MANAGER:** I want to confirm my password before removing, so an open session at the counter cannot remove a customer by accident.
3. **As any employee:** I want removed customers out of the customer list, so I do not contact or pick them.
4. **As any employee:** I want customers referred by a removed customer to still show who referred them, marked as removed.
5. **As a receptionist:** I want to register a returning person as a new customer, even with the same email.
6. **As the domain expert (later):** I want removed customers distinguishable by `removedAt`, so rank metrics can leave them out.

---

## 5. Edge cases

- **Existing customer, correct password, ADMIN or MANAGER:** removed, `200`.
- **Already removed:** refused (`409`), nothing changed.
- **Unknown or malformed id:** refused (`400`).
- **Missing `id` or `password`:** refused (`400`).
- **Wrong password, or an actor who cannot sign in:** refused (`401`), nothing changed.
- **EMPLOYEE:** refused (`403`).
- **No session:** refused (`401`).
- **Customer who is the Referrer of others:** removed. The referred customers keep their indication; the listing shows the name with `referrerRemoved: true`.
- **Customer with a Canal or Campanha indication:** removed. The indication stays.
- **Create with `amigo` pointing at a removed customer:** refused (`400`), as an unknown referrer.
- **Create with the email of a removed customer:** allowed. A new customer, born Bronze.
- **Search in the list by the removed customer's name:** not found.
- **Two removals of the same customer at the same time:** one succeeds, the other is refused as already removed.

---

## 6. Interview analysis (how these rules were reached)

**Why only "erase my data" is a removal.** Three situations were walked: a wrong registration, a request to erase, and a customer who stopped coming. A wrong registration is fixed by updating it. A customer who stopped coming is inactive, and inactivity will be computed from the last paid order. Only the erasure request needs a removal.

**Why not a hard delete.** Friend indications already point at customers by id, and sales will. Deleting would orphan those links. The employees module reached the same conclusion for the same reason.

**Why keep the name.** The links survive on the id alone, but the history must still say who the customer was, in sales and in indications. The GDPR risk was discussed and accepted. A shortened name (e.g. "Maria S.") remains a possible later mitigation.

**Why no manual inactive status.** Inactivity follows from sales. A manual flag would drift as soon as a marked customer comes back and buys.

**Why `removedAt` and not a status.** With inactivity computed, `REMOVED` would be the only stored state. A one-value status invites someone to store `INACTIVE` next to it later, which would clash with the computed one.

**Why keep rank, indication, and createdAt.** Removing a customer must not change, after the fact, how many customers a campaign brought. Future rank rules will separate active, inactive, and removed customers on their own.

**Why ADMIN and MANAGER.** The action is irreversible, so not every employee should have it. Unlike employees, the manager owns the customer base day to day.

**Why ask for the password.** The action cannot be undone, and now two roles can perform it. Employees already require it for remove.

**Why a returning person is a new identity.** Recognising them would require keeping exactly the data they asked to erase.

**Why flag a removed Referrer.** Without the flag, a receptionist reads "referred by Maria Silva", looks for Maria, and does not find her.

---

## 7. Acceptance criteria (minimum)

- [ ] An ADMIN or MANAGER with the correct password removes an existing customer: same id and name, sentinel email, no phone, no NIF, `removedAt` set; rank, indication, and `createdAt` unchanged.
- [ ] The original email can be used to create a new customer, born Bronze, with a different id.
- [ ] Removing an already removed customer is refused and changes nothing.
- [ ] A wrong password is refused and changes nothing.
- [ ] An EMPLOYEE is refused. No session is refused.
- [ ] An unknown or malformed id is refused.
- [ ] `GET /api/customers` never returns a removed customer, and its `total` and search ignore removed customers.
- [ ] A create with `amigo` pointing at a removed customer is refused and writes nothing.
- [ ] A customer referred by a removed customer is listed with the Referrer's name and `referrerRemoved: true`. Other Friend indications carry `referrerRemoved: false`.
- [ ] No endpoint restores a removed customer.

---

## 8. Open decisions

| Decision | Owner | Blocks |
|----------|-------|--------|
| Whether a sale keeps its own copy of the customer name at the time of purchase | Product / sales PRD | Sales read model |
| How inactivity is computed from the last paid order | Domain experts | Inactivity PRD |
| How rank rules treat removed customers (expected: excluded via `removedAt`) | Domain experts | Rank-transition PRD |
| Shortening the kept name (e.g. "Maria S.") if GDPR requires it | Product / legal | Nothing today |
