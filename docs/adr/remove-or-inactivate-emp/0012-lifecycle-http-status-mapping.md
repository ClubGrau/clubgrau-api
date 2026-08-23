# Lifecycle HTTP status codes distinguish authz from conflict

Validation and same-status transitions stay `400`. Step-up / Actor not usable is `401` with the same opacity as login. Matrix refusals are `403`. Last Admin leaving `ACTIVE`, Remove outside `INACTIVE`, and already-`REMOVED` are `409`. The frontend can tell “hide the action” (`403`) from “wrong state” (`409`) without treating every domain error as `400`.
