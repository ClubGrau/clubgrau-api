# adaptRoute stamps actorId from the JWT

`adaptRoute` spreads body/params/query/headers and then sets `actorId` from `req.decoded.id` so a client cannot forge the Actor. Lifecycle use cases trust that field; they never read `actorId` from the body as source of truth. Routes without a decoded token simply omit it. Create and list ignore the extra field.
