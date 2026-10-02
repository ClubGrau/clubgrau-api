# Catálogo QA — update own employee data + session token

Ler **somente** se o modo for `full`. IDs estáveis. Esperado = HTTP + `{error}` quando houver.

Gatilho do `token`: o body **inclui** a chave `name` e o save responde `200`. Sem `name`, o `200` é `{ data }` e não existe chave `token`. `GET /api/employee/me` nunca traz `token`.

Claims do `token`: `id`, `name`, `email`, `role`, `status`, `sessionVersion`. `name` = `data.name` normalizado. `sessionVersion` igual ao do login. O Bearer anterior continua a autorizar até expirar.

---

## AUTH

| ID | Cenário | Esperado |
|----|---------|----------|
| QA-OD-AUTH-01 | PATCH `/employee/me` sem Bearer | 401 `Token not provided` |
| QA-OD-AUTH-02 | token inválido / malformado | 401 `Invalid token` |
| QA-OD-AUTH-03 | Actor INACTIVE (JWT ainda vivo) + `{ "phone": "+351912345678" }` | 401 `Authentication failed` |
| QA-OD-AUTH-04 | Actor INACTIVE + `{}` | 400 `Missing param no own-employee-data fields` (antes do domínio) |
| QA-OD-AUTH-05 | Actor REMOVED (JWT ainda vivo) + campo gravável | 401 `Authentication failed` |
| QA-OD-AUTH-06 | Actor VACATION + `{ "phone": "+351912345678" }` | 200 `{ data }` sem `token` |
| QA-OD-AUTH-07 | Actor VACATION + `{ "name": "Nome Férias" }` | 200 `{ data, token }`; claim `status` = `VACATION` |

---

## Quem grava (sem `requireRoles`)

| ID | Actor | Esperado |
|----|-------|----------|
| QA-OD-SELF-01 | E1 EMPLOYEE ACTIVE, próprio `phone` | 200 |
| QA-OD-SELF-02 | M1 MANAGER ACTIVE, próprio `phone` | 200 |
| QA-OD-SELF-03 | A1 ADMIN ACTIVE, próprio `phone` | 200 |
| QA-OD-SELF-04 | qualquer papel nesta rota | nunca 403 e nunca 409 |

---

## Session Token

| ID | Cenário | Esperado |
|----|---------|----------|
| QA-OD-TK-01 | PATCH só `phone` | 200 `{ data }`; corpo **sem** chave `token` |
| QA-OD-TK-02 | GET `/employee/me` depois de QA-OD-TK-01 | 200 `{ data }` sem `token`; `phone` novo; `name` intacto |
| QA-OD-TK-03 | PATCH `name` diferente do gravado | 200 `{ data, token }`; `token` irmão de `data` |
| QA-OD-TK-04 | decode do token de QA-OD-TK-03 | claim `name` = `data.name`; `id`, `email`, `role`, `status`, `sessionVersion` iguais ao token de login |
| QA-OD-TK-05 | payload do token novo | sem `passwordHash` e sem `loginCapable` |
| QA-OD-TK-06 | GET `/me` com o Bearer **anterior** | 200; `data.name` é o nome novo |
| QA-OD-TK-07 | GET `/me` com o Bearer **novo** | 200; o mesmo `data.name` |
| QA-OD-TK-08 | PATCH ecoando o `name` já gravado | 200 ainda com `token`; `sessionVersion` não sobe |
| QA-OD-TK-09 | `name` inválido (`"A"`, `null`, `""`) | 400; sem chave `token`; GET mostra o nome anterior |
| QA-OD-TK-10 | não há `POST`/`PATCH` público de reissue | o único gatilho é PATCH `/employee/me` com `name` |

Não falhar se a string do JWT novo for idêntica à anterior (o `iat` pode coincidir). Falhar se faltar a chave `token`, se `name` da claim divergir de `data.name`, ou se `sessionVersion` mudar.

---

## Body / chaves

| ID | Cenário | Esperado |
|----|---------|----------|
| QA-OD-BODY-01 | `{}` | 400 `Missing param no own-employee-data fields` |
| QA-OD-BODY-02 | só ignoradas (`email`, `password`, `status`, `role`, `jobTitle`, `employmentId`) | 400 `Missing param no own-employee-data fields` |
| QA-OD-BODY-03 | só `email` | 400; email do Actor intacto no GET |
| QA-OD-BODY-04 | chave gravável + `email`/`status`/`role` | 200; só a gravável muda |
| QA-OD-BODY-05 | E1 envia `actorId` e `id` de A1 + `name` | 200 no sujeito do JWT (E1); GET de A1 com o nome antigo |
| QA-OD-BODY-06 | `name` `null` | 400 `Invalid param name` |
| QA-OD-BODY-07 | `name` `""` ou `"   "` | 400 `Invalid param name`; sem write |
| QA-OD-BODY-08 | `phone` `null` / `""` / `"   "` | 400 `Invalid param phone` |

---

## Campo `name`

| ID | Valor | Esperado |
|----|-------|----------|
| QA-OD-NM-01 | `"Ana Silva"` | 200; `data.name` e claim `name` = `"Ana Silva"`; há `token` |
| QA-OD-NM-02 | `"  Ana   Silva  "` | 200; persiste e claim = `"Ana Silva"` |
| QA-OD-NM-03 | `"A"` | 400 `Name must be at least 2 characters long`; sem `token` |
| QA-OD-NM-04 | 101 caracteres | 400 `Name must be at most 100 characters long`; sem `token` |
| QA-OD-NM-05 | o mesmo nome já gravado | 200 com `token`; `sessionVersion` igual |

---

## Campo `phone`

| ID | Valor | Esperado |
|----|-------|----------|
| QA-OD-PH-01 | `"+351 912 345 678"` | 200 sem `token`; `data.phone` = `351912345678`; `name` intacto |
| QA-OD-PH-02 | `"123"` | 400 (menos de 7 dígitos) |
| QA-OD-PH-03 | 16 dígitos | 400 |
| QA-OD-PH-04 | `null` | 400 `Invalid param phone` |

---

## Campo `username`

| ID | Valor | Esperado |
|----|-------|----------|
| QA-OD-UN-01 | `"joao"` | 200 sem `token`; username persiste |
| QA-OD-UN-02 | `"  joao  "` | 200; persiste `"joao"` (trim) |
| QA-OD-UN-03 | `null` / `""` / `"   "` | 200; username `null` |
| QA-OD-UN-04 | qualquer um acima | sem chave `token`; `name` intacto |

---

## Campo `gender`

| ID | Valor | Esperado |
|----|-------|----------|
| QA-OD-GEN-01 | `"male"` / `"female"` / `"other"` | 200 sem `token`; gender persiste |
| QA-OD-GEN-02 | `null` / `""` / `"   "` | 200; gender `null` |
| QA-OD-GEN-03 | `"MALE"` / `"invalid"` | 400 `Invalid gender`; sem write |

---

## Campo `languages` e `address`

| ID | Valor | Esperado |
|----|-------|----------|
| QA-OD-LA-01 | `"Português, English"` / `"Rua do Grau, 10"` | 200 sem `token`; persiste as-is |
| QA-OD-LA-02 | `"  Lisboa  "` | 200; **sem** trim |
| QA-OD-LA-03 | `null` / `""` / `"   "` | 200; campo `null` |

---

## Campo `emergencyContact`

| ID | Valor | Esperado |
|----|-------|----------|
| QA-OD-EC-01 | `"+351 912 345 678"` | 200 sem `token`; persiste `351912345678` |
| QA-OD-EC-02 | `null` / `""` / `"   "` | 200; `null` (não encaminha string vazia) |
| QA-OD-EC-03 | `"nao-e-telefone"` | 400 |

---

## Campo `nif`

| ID | Valor | Esperado |
|----|-------|----------|
| QA-OD-NIF-01 | `"123456789"` | 200 sem `token`; nif persiste |
| QA-OD-NIF-02 | `123456789` (JSON number) | 200; tratado como string |
| QA-OD-NIF-03 | `null` / `""` / `"   "` | 200; nif `null` |
| QA-OD-NIF-04 | `"ABC"` | 400 `NIF must have exactly 9 digits` |
| QA-OD-NIF-05 | `0` | 400 `NIF must have exactly 9 digits` |

---

## Patch esparso

| ID | Cenário | Esperado |
|----|---------|----------|
| QA-OD-SP-01 | só `{ "gender": "male" }` | 200 sem `token`; só gender muda |
| QA-OD-SP-02 | `{ "name": "Ana Silva", "phone": "+351912345678" }` | 200 com `token`; os dois mudam; o resto intacto |
| QA-OD-SP-03 | dois PATCH seguidos: phone, depois username | nenhum devolve `token`; `name` permanece |
| QA-OD-SP-04 | PATCH `name` e a seguir PATCH só `address` | o segundo não traz `token`; `name` fica o do primeiro |
| QA-OD-SP-05 | `data` do 200 | sem campo `password` |

---

## E2E P0

| ID | Fluxo |
|----|-------|
| QA-OD-E2E-01 | E1 troca o nome → decode (`name` novo, `sessionVersion` igual) → GET com Bearer velho e novo → eco do mesmo nome ainda devolve `token` → repor o nome original |
| QA-OD-E2E-02 | E1 PATCH só phone → sem `token` → GET confirma phone e nome |
| QA-OD-E2E-03 | E1 forja `actorId` de A1 no body com `name` → só E1 muda |
| QA-OD-E2E-04 | `{}` e `name: ""` → 400; GET com o nome anterior |
