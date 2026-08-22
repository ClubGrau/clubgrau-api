# Same email after Remove does not inherit the old identity

Remove frees the original email for a new Create. That Create is a new `employeeId` with no history from the previous person. Anything already stored against the `REMOVED` id stays there. A person who returns to the salon must be Reactivated; Remove+Create is a different identity.

Interview note: this was stress-tested with “same email, new hire vs the person coming back”. Downstream records keyed by `employeeId` (whatever module owns them — not decided in this PRD) would not move to the new id.
