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
