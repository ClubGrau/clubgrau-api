# PRD: Indication Catalog

**Product Requirements Document**
**Date:** 07/10/2026 | **Status:** Aligned with design doc | **Version:** 1.1

**Glossary:** [`src/modules/indications/CONTEXT.md`](../../src/modules/indications/CONTEXT.md)
**Design:** [`docs/design-docs/indication-catalog-v1.md`](../design-docs/indication-catalog-v1.md)

This document specifies the **Indication Catalog**: the three categories born with the system, and the operator commands that add an origin, correct its name, end it, and reopen it. It does **not** specify the board (reading, brief, period, search) or the moment a customer is tied to an origin. Those topics remain for a later PRD.

Version 1.1: Canal is born empty. Instagram, TikTok, and Google are not product defaults.

---

## 1. Overview and objective

The indications screen already shows three groups — Canal, Campanha, and Amigo. The prototype also paints Instagram, TikTok, and Google inside Canal. The screen offers “Nova categoria” and computes a reading by joining the catalog to customers in the browser. Neither the button nor that reading belongs in this version. The three painted channels do not belong either.

Operators need a catalog they can trust before any customer is linked to it: the three categories always exist, Canal and Campanha start with no origins, and Amigo has no origins. An operator with Gestão authority can add a channel or a campaign, fix a name, and take an origin out of use without losing the record.

**Objective:** one catalog, with create, correct-the-name, end, and reopen. Nothing in the catalog is deleted. Nothing is inserted at startup.

**Non-goals (this version):**

- Creating, renaming, or removing a category (“Nova categoria”)
- Deleting an origin
- Moving an origin from Canal to Campanha or the reverse
- Typing an origin into Amigo
- The board: last entry, pace, quality, signal, brief cards, period, search, attention order
- Storing an indication on a customer, rank, or the friend row that appears when one customer refers another
- Instagram, TikTok, Google, Campanha Cristianinho, and Campanha Verão (prototype labels, not product defaults)

---

## 2. Business rules (core logic)

### Rule 2.1 — Three categories, closed

The catalog is born with exactly these categories, in this order:

| Order | Name | Holds origins |
|-------|------|----------------|
| 1 | Canal | yes |
| 2 | Campanha | yes |
| 3 | Amigo | no |

Names are singular, as the screen already prints them. An operator cannot add a fourth category, rename these, or remove them. The list always returns all three, even when Campanha has no origins and Amigo never will.

Amigo is recognized as the category that holds no origins. A magic id is not the rule.

### Rule 2.2 — Canal and Campanha start empty

Canal is born with no origins. Campanha is born with no origins. Amigo is born with no origins.

A channel is created the same way as a campaign: the operator sends a category and a name. The first origin in a category is the first in that category. The next one is appended after it.

Once created, a channel and a campaign are the same kind of record. The name can be corrected. The record cannot be removed. Ending it is allowed: it stays in the catalog and can be reopened.

### Rule 2.3 — End is not delete

Every origin follows the same life:

| Intent | Record | Name | Offered again | How to undo |
|--------|--------|------|---------------|-------------|
| End | same | still reserved | no | Reopen |
| Reopen | same | same | yes | End |

There is no delete. An ended origin remains in the catalog query, still occupying its name.

Ending an origin that is already ended succeeds and changes nothing. Reopening an origin that is already active succeeds and changes nothing. End or reopen of an id that does not exist is refused.

### Rule 2.4 — Where a new origin may go

Create asks for a category and a name.

- Canal: a new channel is appended after the ones already there.
- Campanha: a new campaign is appended after the ones already there.
- Amigo: refused. Friend is not a catalog origin.

The category is chosen at creation and never changes.

### Rule 2.5 — The name

The name uses the same ruler already used for a person:

- Trimmed.
- Repeated spaces in the middle collapse to one.
- At least 2 characters and at most 100 after that normalization.

Uniqueness is inside the category, on the normalized name, without distinguishing letter case. Canal and Campanha do not share a list: a campaign may be named Instagram.

An ended origin still holds its name. Creating or correcting onto that name is refused. The way back is Reopen, or a correction of that same record.

Correcting a name keeps the id and the category. The previous spelling is no longer reserved. Correcting an origin to the name it already has (after normalization) succeeds and changes nothing. Correcting onto a name held by a different origin in the same category is refused, whether that other origin is active or ended.

### Rule 2.6 — Who may operate

`ADMIN` and `MANAGER` may read the catalog, create an origin, correct a name, end, and reopen.

`EMPLOYEE` is refused on every one of those calls, including the read. Hiding the screen is not enough; the API enforces it. A missing or invalid session is refused as today.

### Rule 2.7 — Read order

The catalog query returns:

1. Categories in the order Canal, Campanha, Amigo.
2. Every origin, active and ended.
3. Origins inside a category in the order they were created. The first channel is first. A channel added later appears after the ones already there. A campaign appears in the order it was created.

Attention order (end signal, then review, then keep, then ended) belongs to the board and is out of scope here.

---

## 3. Data contracts and dependencies

The catalog is a new hexagon. It does not wait on customers. Customer indication and rank are a later PRD; this document does not add fields to Customer.

**HTTP (planned):**

```http
GET /api/indication-catalog
Authorization: Bearer <token>

POST /api/indication-origin
Authorization: Bearer <token>
{ "categoryId": "<Canal or Campanha>", "name": "Facebook" }

PATCH /api/indication-origin/:id
Authorization: Bearer <token>
{ "name": "Instagram Ads" }

POST /api/indication-origin/:id/end
Authorization: Bearer <token>

POST /api/indication-origin/:id/reopen
Authorization: Bearer <token>
```

Each write that succeeds returns the origin id. End and reopen return that id even when the origin was already in the requested state.

The catalog read returns the three categories and the origins. Each category exposes its id, its name, and whether it holds origins (so the client can keep Amigo out of the create form). Each origin exposes its id, its category id, its name, and whether it is active. Ended origins are included.

Create into Amigo, an unknown category, a name that fails Rule 2.5, or a duplicate name is refused and does not write. Correct, end, and reopen of an unknown origin id are refused.

**Other modules:** none. The screen’s reading stays a client concern until the board PRD.

---

## 4. User stories

1. **As an ADMIN or MANAGER:** I want Canal, Campanha, and Amigo to exist as soon as the catalog does, so I do not set up the groups by hand.
2. **As an ADMIN or MANAGER:** I want Canal to start empty, and to add a channel the same way I add a campaign, so the names in the catalog are the ones the floor actually uses.
3. **As an ADMIN or MANAGER:** I want to add a channel, or a campaign, without being able to add a name under Amigo.
4. **As an ADMIN or MANAGER:** I want to correct a misspelled name and keep the same origin.
5. **As an ADMIN or MANAGER:** I want to end an origin that should stop being offered, and reopen it later, without losing the name or the record.
6. **As an EMPLOYEE:** I must not read or change the catalog.

---

## 5. Edge cases

- **Create or correct with a name under 2 or over 100** after normalization: refuse.
- **Name that is only spaces:** refuse (normalization leaves it empty).
- **“Instagram” when Canal already has Instagram,** any letter case, active or ended: refuse.
- **“Instagram” as a campaign** while Canal has Instagram: allowed.
- **“Google  Ads” and “Google Ads”:** the same name after normalization; the second write is refused.
- **Correct Instagram to Instagram** (or to the same name with different spacing or case only): succeed, no change.
- **Correct Instagram to TikTok** while TikTok exists in Canal: refuse. The original name stays.
- **Correct an ended origin’s name:** allowed. The old spelling becomes free; the new one is reserved, including against active origins.
- **End an ended origin / reopen an active origin:** succeed, no change.
- **End, reopen, or correct an unknown id:** refuse.
- **Create with Amigo’s category id:** refuse.
- **EMPLOYEE, or no session:** refuse. No write.
- **API startup:** inserts no origins. A fresh catalog still has the three categories and no origins.

---

## 6. Interview analysis (how these rules were reached)

These scenarios were walked during the grilling session. They are the rationale, not extra product scope.

**Why the categories are closed.** The screen shows Canal, Campanha, and Amigo as the structure of the product. “Nova categoria” would only exist to add a fourth group. This version does not want a fourth group, so the button is out of the product, not deferred.

**Why an origin can be ended but not removed.** The screen already offers End after a long time without a new customer. End takes the origin out of use and keeps the history attached to the same record. Delete would drop the row the customer indication will later point at.

**Why a channel the operator adds follows the same life.** Once an indication can point at that origin, deleting it drops the row. This version has no “delete only if unused” path. End and reopen cover “stop offering it.”

**Why a name is not frozen.** What must not disappear is the record. A typo, or a clearer label, is a correction of the name. After the correction the previous spelling is free, because the name moved with the record.

**Why an ended name stays reserved.** Two origins named Instagram in Canal would make a later customer indication ambiguous. Reopen is the way back to the same record. A new create is not.

**Why correction exists at all.** There is no delete, and an ended name cannot be reused by a new origin. Without correction, a typo would be permanent.

**Why the category does not change.** Canal and Campanha are different lists. Moving an origin would rewrite which group its history belongs to. Correction touches the name only.

**Why Amigo has no origins.** A friend row is a customer who referred someone, not a name typed into the catalog. A free-text friend would duplicate the person and drop the link. The category exists so the catalog is complete; the row arrives with the customer, in a later PRD.

**Why Canal and Campanha start empty.** Instagram, TikTok, Google, Campanha Cristianinho, and Campanha Verão on the current screen are prototype data. The operator creates each origin when the floor uses it. A startup insert would freeze names the operator might not want, and a later correction of those names would fight the next boot.

**Why this PRD stops before the board.** Last entry, pace, quality, the brief, and friend rows need the customer’s indication and rank. The API customer does not have those yet. The catalog can ship alone.

**Why ADMIN and MANAGER.** The screen sits in Gestão, next to collaborators. Collaborator lifecycle already refuses `EMPLOYEE` at the API. The catalog is the same kind of screen, including the read.

**Why end and reopen are quiet when repeated.** The client can send the command twice. The state asked for is the state already stored. Refusal is reserved for an origin that is not there.

**Why birth order.** The board will sort by attention later. The catalog itself keeps origins in the order they were created, and appends what the operator adds.

---

## 7. Acceptance criteria (minimum)

- [ ] A fresh catalog has categories Canal, Campanha, and Amigo, in that order, and no origins. Starting the API does not insert origins.
- [ ] `ADMIN` or `MANAGER` creates a channel and a campaign; each appears at the end of its category; the read includes them. The first origin in an empty category is the first one.
- [ ] Create into Amigo is refused and writes nothing.
- [ ] A name that normalizes to fewer than 2 or more than 100 characters is refused. A name that collides inside the category, ignoring case, is refused, including when the other origin is ended. The same name in the other category is allowed.
- [ ] Correcting a name keeps the id and the category. The previous name becomes free. Correcting onto another origin’s name in the same category is refused.
- [ ] End keeps the origin in the read, inactive, still holding its name. A second end succeeds without a further change. Reopen makes it active again. A second reopen succeeds without a further change.
- [ ] End, reopen, and correct of an unknown id are refused.
- [ ] `EMPLOYEE` is refused on read and on every write. No session is refused.
