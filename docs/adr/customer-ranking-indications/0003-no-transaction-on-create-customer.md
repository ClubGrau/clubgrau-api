# No transaction on create customer

Create reads the origin or the referrer, checks the email, then writes one customer document. Between the checks and the write there is a window of milliseconds. We accept it and use no Mongo transaction.

"All or nothing" still holds: the write is one `insert` of one document, so a half customer cannot exist. The window is harmless for the indication, because an origin is never deleted and ending one does not affect customers already linked to it (PRD rule 2.8): a link written a moment after the origin was ended is still a valid link. A referrer is a customer, and customers are never removed. For the email, the unique index already refuses the second of two concurrent creates, and the repository translates the Mongo duplicate-key error (`11000`) into `CustomerAlreadyExistsError`, which becomes `409`. This is the same backstop `indications` uses for the reserved name.

## Considered options

- **A transaction covering the reads and the write.** Rejected: it needs a replica set, crosses two modules, removes a window that does no harm, and no other use case in the project uses a transaction.
