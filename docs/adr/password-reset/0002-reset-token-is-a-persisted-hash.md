# Reset Token is a persisted hash, not a JWT in the link

A signed token in the query string needs no table, but it cannot be marked used or replaced. Password Reset needs one-time consume, a 30-minute TTL, and a cooldown that leaves the outstanding token alone. Persist a hash of a random secret plus owner and `expiresAt`. The email carries the raw value; the request HTTP response never does.

**Considered options:** JWT-in-link (no persistence, no revoke). Rejected.
