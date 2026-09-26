# Catálogo QA — update professional employee data

Ler **somente** se o modo for `full`. IDs estáveis. Esperado = HTTP + `{error}` quando houver.

Confirmar persistência com `GET /api/employees` (`jobTitle`, `role`, `status`, `deactivateAt`, `employmentId`). Não há get-by-id.

---

## AUTH

| ID | Cenário | Esperado |
|----|---------|----------|
| QA-PR-AUTH-01 | rota professional-data sem Bearer | 401 Token not provided |
| QA-PR-AUTH-02 | token inválido / malformado | 401 Invalid token |
| QA-PR-AUTH-03 | Actor INACTIVE (JWT ainda vivo) tenta patch | 401 Authentication failed |
| QA-PR-AUTH-04 | Actor VACATION + só `{ jobTitle }` em E1 | 200 (VACATION é login-capable neste comando) |
| QA-PR-AUTH-05 | Actor VACATION + delta de `status` | 401 Authentication failed; sem write |

---

## Role Gate (middleware `requireRoles`)

| ID | Cenário | Esperado |
|----|---------|----------|
| QA-PR-RG-01 | Actor role EMPLOYEE → Bearer válido | 403 |
| QA-PR-RG-02 | Actor role MANAGER → Bearer válido | continua para domínio |
| QA-PR-RG-03 | Actor role ADMIN → Bearer válido | continua para domínio |

---

## Matriz de autorização (domínio)

| ID | Actor | Target | Body | Esperado |
|----|-------|--------|------|----------|
| QA-PR-MTX-01 | A1 (ADMIN) | E1 (EMPLOYEE) | jobTitle | 200 `{ data: { id } }` |
| QA-PR-MTX-02 | A1 (ADMIN) | M1 (MANAGER) | jobTitle | 200 |
| QA-PR-MTX-03 | A1 (ADMIN) | A2 (ADMIN outro) | jobTitle | 200 |
| QA-PR-MTX-04 | A1 (ADMIN) | A1 (self) | jobTitle | 200 |
| QA-PR-MTX-05 | M1 (MANAGER) | E1 (EMPLOYEE) | jobTitle | 200 |
| QA-PR-MTX-06 | M1 (MANAGER) | E2 (EMPLOYEE) | jobTitle | 200 |
| QA-PR-MTX-07 | M1 (MANAGER) | M1 (self) | jobTitle | 403 Action not allowed |
| QA-PR-MTX-08 | M1 (MANAGER) | A1 (ADMIN) | jobTitle | 403 Action not allowed |
| QA-PR-MTX-09 | M1 (MANAGER) | outro MANAGER | jobTitle | 403 Action not allowed |
| QA-PR-MTX-10 | actorId forjado no body, logado como M1 | E1 | jobTitle | Actor = JWT; regra do M1 |

---

## Target guards

| ID | Cenário | Esperado |
|----|---------|----------|
| QA-PR-TGT-01 | id inexistente no path | 400 Employee not found |
| QA-PR-TGT-02 | target REMOVED (após anonymize) | 409 Employee is already removed |
| QA-PR-TGT-03 | E3 INACTIVE + só jobTitle | 200; continua INACTIVE (não reativa) |
| QA-PR-TGT-04 | A1 promove E3 INACTIVE EMPLOYEE → MANAGER, sem `status` | 200; role MANAGER; status continua INACTIVE |

---

## Validação de body

| ID | Cenário | Esperado |
|----|---------|----------|
| QA-PR-BODY-01 | `{}` | 400 Missing param no professional-data fields |
| QA-PR-BODY-02 | só unknown (`name`, `email`, `gender`) | 400 Missing param no professional-data fields |
| QA-PR-BODY-03 | só `{ employmentId }` | 400 Missing param no professional-data fields |
| QA-PR-BODY-04 | `{ password: "secret" }` | 400 Invalid param password; porta não chamada |
| QA-PR-BODY-05 | `{ password: null }` | 400 Invalid param password |
| QA-PR-BODY-06 | `{ password, jobTitle }` juntos | 400 Invalid param password; jobTitle não persiste |
| QA-PR-BODY-07 | `id` forjado no body | ignorado — path param vence |
| QA-PR-BODY-08 | `actorId` forjado no body | ignorado — JWT vence |
| QA-PR-BODY-09 | jobTitle + `employmentId` + `name` | 200 — só jobTitle propagado; matrícula intacta |

---

## Campo `jobTitle`

| ID | Valor enviado | Esperado |
|----|---------------|----------|
| QA-PR-JT-01 | `"Barbeiro"` | 200; jobTitle persiste; role e status intactos |
| QA-PR-JT-02 | `null` | 200; jobTitle `null`; demais intactos |
| QA-PR-JT-03 | `""` | 200; normalizado para null |
| QA-PR-JT-04 | `"   "` | 200; normalizado para null |
| QA-PR-JT-05 | `" Barbeiro "` | 200; persiste **com** os espaços (sem trim) |
| QA-PR-JT-06 | a mesma string já gravada | 200; pode regravar jobTitle; role/status não mudam |

---

## Campo `role` (delta)

| ID | Cenário | Esperado |
|----|---------|----------|
| QA-PR-ROLE-01 | A1: E1 `EMPLOYEE` → `MANAGER` | 200; role persiste; status intacto |
| QA-PR-ROLE-02 | A1: M1 `MANAGER` → `EMPLOYEE` | 200; sem guarda de Last Admin |
| QA-PR-ROLE-03 | A1: E1 `EMPLOYEE` → `ADMIN` (já existe outro ADMIN) | 200; promover não dispara contagem |
| QA-PR-ROLE-04 | M1: ecoa o `role` atual de E1 + jobTitle novo | 200; só jobTitle muda |
| QA-PR-ROLE-05 | M1: `role` **diferente** + jobTitle + status | 403 Action not allowed; nada persiste |
| QA-PR-ROLE-06 | `role: null` / `""` / `"   "` | 400 Invalid param role |
| QA-PR-ROLE-07 | `"employee"` / `"OWNER"` | 400 Invalid role: "…" |
| QA-PR-ROLE-08 | só `{ role }` igual ao atual, sem jobTitle | 200; sem write |

---

## Last Admin — sair de `ADMIN`

Contagem login-capable = `ACTIVE` \| `VACATION`. Contagem non-removed inclui `INACTIVE`.

| ID | Cenário | Esperado |
|----|---------|----------|
| QA-PR-LA-01 | 2 ADMIN ACTIVE; A1 muda A2 para `MANAGER` | 200 |
| QA-PR-LA-02 | único ADMIN login-capable muda o próprio `role` para `MANAGER` | 409 Last Admin must stay ACTIVE…; sem write |
| QA-PR-LA-03 | A1 ACTIVE + A2 ADMIN INACTIVE; A1 tenta tirar A2 de `ADMIN` | 409 (login-capable count = 1); sem write |
| QA-PR-LA-04 | único ADMIN login-capable está em `VACATION` e sai de `ADMIN` | 409; sem write |

QA-PR-LA-04 não é montável via `POST /update-status`: o último ADMIN `ACTIVE` não vai para `VACATION` (`409`). Exige seed. Sem a fixture → `blocked`, não falha de produto.

---

## Campo `status` (delta = lifecycle)

| ID | Cenário | Esperado |
|----|---------|----------|
| QA-PR-ST-01 | A1: E1 `ACTIVE` → `INACTIVE` | 200; status INACTIVE; `deactivateAt` set |
| QA-PR-ST-02 | A1: E1 `INACTIVE` → `ACTIVE` | 200; `deactivateAt` null |
| QA-PR-ST-03 | A1: E1 `ACTIVE` → `VACATION` | 200; `deactivateAt` null |
| QA-PR-ST-04 | A1: E1 `VACATION` → `ACTIVE` | 200 |
| QA-PR-ST-05 | M1: E1 `ACTIVE` → `INACTIVE` | 200 |
| QA-PR-ST-06 | M1: status delta em ADMIN ou MANAGER | 403 Action not allowed |
| QA-PR-ST-07 | eco: `{ status }` igual ao atual | 200; sem already-in-status; sem write de `deactivateAt` |
| QA-PR-ST-08 | eco de status + jobTitle novo | 200; só jobTitle persiste; status/`deactivateAt` intocados |
| QA-PR-ST-09 | `{ status: "REMOVED" }` | 400 Invalid status: "REMOVED"; sem write |
| QA-PR-ST-10 | `status: null` / `""` / `"   "` | 400 Invalid param status |
| QA-PR-ST-11 | `"inactive"` / `"FOO"` | 400 Invalid status: "…" |
| QA-PR-ST-12 | M1: status delta recusado **e** jobTitle no mesmo body | 403; jobTitle não persiste |
| QA-PR-ST-13 | Actor VACATION + delta de status + jobTitle | 401; nada persiste |

---

## Last Admin — transição de status (lifecycle as-is)

| ID | Cenário | Esperado |
|----|---------|----------|
| QA-PR-LS-01 | 1 ADMIN ACTIVE: este PATCH `INACTIVE` ou `VACATION` | 409; sem write |
| QA-PR-LS-02 | QA-PR-LS-01 com `jobTitle` no mesmo body | 409; jobTitle intocado |
| QA-PR-LS-03 | 2 ADMIN ACTIVE: A1 põe A2 em `INACTIVE` | 200 |
| QA-PR-LS-04 | `POST /api/employee/update-status` com o status **já atual** | 400 (already-in-status). Este PATCH não altera esse endpoint |
| QA-PR-LS-05 | mesmo eco de status **neste** PATCH | 200 no-op (contraste com QA-PR-LS-04) |

Deactivate Last Admin continua `countActiveAdmins` (só `ACTIVE`). Não falhar se um ADMIN já em `VACATION` conseguir ir para `INACTIVE` por este PATCH.

---

## Patch esparso e atomicidade

| ID | Cenário | Esperado |
|----|---------|----------|
| QA-PR-SP-01 | só `{ jobTitle: "Barbeiro" }` | 200; role, status, employmentId, password intocados |
| QA-PR-SP-02 | só delta de `role` | 200; jobTitle e status intocados |
| QA-PR-SP-03 | jobTitle + role delta + status delta válidos (ADMIN → EMPLOYEE) | 200; os três persistem juntos (`deactivateAt` se o delta for desativar) |
| QA-PR-SP-04 | eco de `role` + eco de `status`, sem jobTitle | 200; sem write |
| QA-PR-SP-05 | recusa de role (MANAGER) ou de lifecycle | nenhum campo do body persiste |

---

## Leitura pós-patch (`GET /api/employees`)

| ID | Cenário | Esperado |
|----|---------|----------|
| QA-PR-READ-01 | GET após jobTitle `"Barbeiro"` | item tem `jobTitle: "Barbeiro"` |
| QA-PR-READ-02 | GET após jobTitle `null` / `""` | item tem `jobTitle: null` |
| QA-PR-READ-03 | GET após role `MANAGER` | item tem `role: "MANAGER"` |
| QA-PR-READ-04 | GET após status `INACTIVE` | item `INACTIVE` e `deactivateAt` preenchido |
| QA-PR-READ-05 | GET após eco de status | `deactivateAt` igual ao de antes do PATCH |
| QA-PR-READ-06 | body com `employmentId` diferente | matrícula do item não muda |
| QA-PR-READ-07 | resposta 200 da list | sem campo `password` |

---

## E2E P0

| ID | Fluxo |
|----|-------|
| QA-PR-E2E-01 | A1 seta jobTitle em E1 → GET confirma → A1 limpa com null → GET confirma null; role e status iguais ao início |
| QA-PR-E2E-02 | M1 atualiza jobTitle de E1 ecoando o role → 200; M1 muda o role → 403 e jobTitle da tentativa não grava; M1 self e M1→A1 → 403 |
| QA-PR-E2E-03 | A1 promove E1 a MANAGER → 200; com A2 presente rebaixa um ADMIN → 200; sem o segundo ADMIN login-capable, sair de ADMIN → 409 |
| QA-PR-E2E-04 | A1 desativa E1 por este PATCH → `deactivateAt` set; eco do status → 200; `POST /update-status` com o mesmo status → 400 |
| QA-PR-E2E-05 | `{}`, só `employmentId`, e `{ password: null }` → 400; id inexistente → 400; REMOVED → 409 |
| QA-PR-E2E-06 | actorId=A1 forjado no body, logado como M1, target A2 → 403 (matriz do M1) |
