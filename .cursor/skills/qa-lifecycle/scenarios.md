# Catálogo QA — employee lifecycle

Ler **somente** se o modo for `full`. IDs estáveis. Esperado = HTTP + `{error}` quando houver.

## AUTH

| ID | Cenário | Esperado |
|----|---------|----------|
| QA-AUTH-01 | rota employee sem Bearer | 401 Token not provided |
| QA-AUTH-02 | token inválido | 401 Invalid token |
| QA-AUTH-03 | login INACTIVE/VACATION | 401 |

## Update-status `POST /api/employee/update-status`

| ID | Ação | Esperado |
|----|------|----------|
| QA-US-01 | A1: E1 ACTIVE→INACTIVE | 200 status INACTIVE, deactivateAt set |
| QA-US-02 | A1: E1 INACTIVE→ACTIVE | 200, deactivateAt null |
| QA-US-03 | A1: E1 ACTIVE→VACATION | 200, deactivateAt null |
| QA-US-04 | A1: E1 VACATION→ACTIVE | 200 |
| QA-US-05 | M1: E1 ACTIVE→INACTIVE | 200 |
| QA-US-06 | M1: E1 INACTIVE→ACTIVE | 200 |
| QA-US-07 | A1: M1→INACTIVE | 200 |
| QA-US-08 | A1: A2→INACTIVE (2 ADMINs) | 200 |
| QA-US-09 | sem id ou status | 400 missing |
| QA-US-10 | status REMOVED | 400 invalid status |
| QA-US-11 | status FOO | 400 invalid status |
| QA-US-12 | id inexistente | 400 Employee not found |
| QA-US-13 | mesmo status de novo | 400 already inactive/active/on vacation |
| QA-US-14 | actorId forjado no body | ignorado; Actor = JWT |
| QA-US-15 | E1 altera E2 | 403 Action not allowed |
| QA-US-16 | M1 INACTIVE em ADMIN/MANAGER | 403 |
| QA-US-17 | último ADMIN INACTIVE/VACATION | 409 Last Admin… |
| QA-US-18 | Actor INACTIVE (JWT vivo) faz update | 401 Authentication failed |

## Remove `POST /api/employee/remove`

| ID | Ação | Esperado |
|----|------|----------|
| QA-RM-01 | A1: E1 INACTIVE + senha Actor | 200 `{data:{id}}` |
| QA-RM-02 | list após remove | E1 ausente |
| QA-RM-03 | Mongo E1 | id igual, REMOVED, sentinels, removedAt, role ok |
| QA-RM-04 | create com email original | 201, id novo |
| QA-RM-05 | create email original enquanto INACTIVE | erro email ocupado |
| QA-RM-06 | sem id/password | 400 |
| QA-RM-07 | senha Actor errada | 401 Authentication failed |
| QA-RM-08 | senha do Target | 401 |
| QA-RM-09 | id inexistente, senha Actor ok | 400 Employee not found |
| QA-RM-10 | actorId forjado | Actor = JWT |
| QA-RM-11 | remove ACTIVE/VACATION | 409 Employee is not inactive |
| QA-RM-12 | já REMOVED | 409 already removed |
| QA-RM-13 | M1 remove E1 INACTIVE | 403 |
| QA-RM-14 | E1 remove E2 | 403 |
| QA-RM-15 | self-remove | 403 |
| QA-RM-16 | último ADMIN (não REMOVED) remove | 409 Last Admin |
| QA-RM-17 | 2 ADMINs; A1 remove A2 INACTIVE | 200 |

## List `GET /api/employees`

| ID | Query | Esperado |
|----|-------|----------|
| QA-LS-01 | sem filtro | sem REMOVED, sem password |
| QA-LS-02 | status operacional | só aquele status |
| QA-LS-03 | status=REMOVED | 400 |
| QA-LS-04 | status=INVALID | 400 |
| QA-LS-05 | page/limit | total não conta REMOVED |
| QA-LS-06 | role+search | filtro aplica |

## E2E P0

| ID | Fluxo |
|----|-------|
| QA-E2E-01 | ADMIN: INACTIVE → Reactivate → INACTIVE → Remove → email livre |
| QA-E2E-02 | MANAGER: E1 ok; Remove 403; ADMIN 403 |
| QA-E2E-03 | 1 ADMIN → 409; criar A2 → INACTIVE ok |
| QA-E2E-04 | M1 + actorId=A1 no body → continua 403 |
