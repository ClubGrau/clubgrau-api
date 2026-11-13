# Customers

The people the salon serves, registered by staff. This context owns the customer record, its rank, and the indication that says where the customer came from. It does not own the catalog of origins, nor how a customer climbs the ladder.

## Language

**Customer**:
A person the salon serves, registered by an authenticated collaborator. A customer never signs in and has no password.
_Avoid_: client, user, account, member

**Rank**:
The customer's position on a ladder of three, from lowest to highest: Bronze, Silver, Gold. Every customer has one from birth. It is held on the customer, not computed.
_Avoid_: level, tier, status, score, Bronx

**Born Bronze**:
A new customer always starts at Bronze. The registration does not choose the rank, and no customer is created as Silver or Gold.
_Avoid_: initial rank as an input, default rank sent by the client

**Indication**:
The one optional link from a customer to where they came from: a Channel, a Campaign, or a Friend. It is complete and valid, or it does not exist. It is fixed when the customer is created.
_Avoid_: referral, wasReferred, "came by indication" as a separate flag, half link

**Walk-in**:
A customer registered with no indication. Absence of the link is the honest state; it is not a fourth category.
_Avoid_: "no origin" category, an indication with a blank origin

**Referrer**:
The existing customer who referred another. A Friend indication points at the Referrer by identity, never by a typed name. One customer may be the Referrer of many.
_Avoid_: friend name, referral text, free-text friend

**Remove**:
Taking a customer out of the customer base when they ask for their data to be erased. The customer keeps its identity and name; its contact data and NIF are erased. Remove is terminal: there is no restore.
_Avoid_: delete, hard delete, purge, deactivate

**Removed customer**:
A customer that has been removed, known by the moment of removal (`removedAt`). It is out of the customer base (not listed, cannot be chosen as a Referrer) but stays in the history: indications that point at it still show its name, flagged as removed. A person who returns is registered as a new customer and inherits nothing.
_Avoid_: deleted customer, anonymous customer, inactive customer

**Inactive** (reserved):
Not a stored state. Inactivity will be computed from the date of the customer's last paid order, by rules the domain experts will define. It never means removed.
_Avoid_: using "inactive" for a removed customer, a manual inactive flag
