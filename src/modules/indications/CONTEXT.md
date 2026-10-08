# Indications

The catalog of where a customer came from. This context owns the categories and the origins an operator can pick. It does not own the customer, the rank, or the reading of how an origin is performing.

## Language

**Category**:
One of three fixed groups born with the system: Canal, Campanha, and Amigo, in that order. An operator does not create, rename, or remove a category.
_Avoid_: Nova categoria, catalog as a synonym of category, a fourth group

**Origin**:
A named source inside Canal or Campanha. It has one name and it is either active or ended. The record stays; it is never deleted and never moves to the other category.
_Avoid_: option, indicação as the name of this record, channel when the origin sits in Campanha

**Channel**:
An origin in Canal. None are born with the system. The operator adds a channel the same way they add a campaign. The name can be corrected, and the record cannot disappear.
_Avoid_: Instagram, TikTok, and Google as product defaults; a separate type that cannot be ended

**Campaign**:
An origin in Campanha. None are born with the system.
_Avoid_: Campanha Cristianinho, Campanha Verão, as product defaults

**Friend**:
The category Amigo. It has no origins. A later context records that one customer referred another; this catalog only keeps the category.
_Avoid_: a typed name in Amigo, Nova indicação into Amigo, a friend row in this version

**End**:
The origin stops being offered and stays in the catalog, still holding its name. Ending an origin that is already ended changes nothing.
_Avoid_: delete, exclude, hide from the catalog

**Reopen**:
The ended origin is offered again, same record. Reopening an origin that is already active changes nothing.
_Avoid_: create again, undelete

**Correct the name**:
The origin keeps its id and its category and receives a new name. The previous name is no longer reserved. The new name must still be free inside that category, including names held by ended origins. Correcting to the name the origin already has changes nothing.
_Avoid_: move to another category, a new origin to fix a typo
