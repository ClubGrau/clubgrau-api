# Catálogo QA — update personal employee data

Ler **somente** se o modo for `full`. IDs estáveis. Esperado = HTTP + `{error}` quando houver.

---

## AUTH

| ID | Cenário | Esperado |
|----|---------|----------|
| QA-PD-AUTH-01 | rota personal-data sem Bearer | 401 Token not provided |
| QA-PD-AUTH-02 | token inválido / malformado | 401 Invalid token |
| QA-PD-AUTH-03 | Actor INACTIVE (JWT ainda vivo) tenta patch | 401 Authentication failed |
| QA-PD-AUTH-04 | Actor VACATION tenta patch de E1 | 200 (VACATION é permitido) |

---

## Role Gate (middleware `requireRoles`)

| ID | Cenário | Esperado |
|----|---------|----------|
| QA-PD-RG-01 | Actor role EMPLOYEE → Bearer válido | 403 |
| QA-PD-RG-02 | Actor role MANAGER → Bearer válido | continua para domínio |
| QA-PD-RG-03 | Actor role ADMIN → Bearer válido | continua para domínio |

---

## Matriz de autorização (domínio)

| ID | Actor | Target | Esperado |
|----|-------|--------|----------|
| QA-PD-MTX-01 | A1 (ADMIN) | E1 (EMPLOYEE) | 200 `{ data: { id } }` |
| QA-PD-MTX-02 | A1 (ADMIN) | M1 (MANAGER) | 200 |
| QA-PD-MTX-03 | A1 (ADMIN) | A2 (ADMIN outro) | 200 |
| QA-PD-MTX-04 | A1 (ADMIN) | A1 (self-patch) | 200 |
| QA-PD-MTX-05 | M1 (MANAGER) | E1 (EMPLOYEE) | 200 |
| QA-PD-MTX-06 | M1 (MANAGER) | E2 (EMPLOYEE) | 200 |
| QA-PD-MTX-07 | M1 (MANAGER) | M1 (self-patch) | 403 Action not allowed |
| QA-PD-MTX-08 | M1 (MANAGER) | A1 (ADMIN) | 403 Action not allowed |
| QA-PD-MTX-09 | M1 (MANAGER) | outro MANAGER | 403 Action not allowed |
| QA-PD-MTX-10 | actorId forjado no body | A1 autenticado | Actor = JWT; regra do JWT aplicada |

---

## Target guards

| ID | Cenário | Esperado |
|----|---------|----------|
| QA-PD-TGT-01 | id inexistente no path | 400 Employee not found |
| QA-PD-TGT-02 | target REMOVED (após anonymize) | 409 (EmployeeAlreadyRemovedError) |
| QA-PD-TGT-03 | target INACTIVE (não REMOVED) | 200 (patch é permitido) |

---

## Validação de body / campos obrigatórios

| ID | Cenário | Esperado |
|----|---------|----------|
| QA-PD-BODY-01 | body vazio `{}` | 400 Missing param: no personal-data fields |
| QA-PD-BODY-02 | só unknown keys (`name`, `status`, `password`, `role`) | 400 Missing param: no personal-data fields |
| QA-PD-BODY-03 | `id` forjado no body | ignorado — path param vence |
| QA-PD-BODY-04 | `actorId` forjado no body | ignorado — JWT vence |
| QA-PD-BODY-05 | campo pessoal + unknown keys misturados | 200 — só campo pessoal propagado |

---

## Campo `gender`

| ID | Valor enviado | Esperado |
|----|---------------|----------|
| QA-PD-GEN-01 | `"male"` | 200 — gender persiste `male` |
| QA-PD-GEN-02 | `"female"` | 200 — gender persiste `female` |
| QA-PD-GEN-03 | `"other"` | 200 — gender persiste `other` |
| QA-PD-GEN-04 | `null` | 200 — gender limpo (null no banco) |
| QA-PD-GEN-05 | `""` (string vazia) | 400 Invalid param: gender |
| QA-PD-GEN-06 | `"MALE"` (uppercase) | 400 Invalid param: gender |
| QA-PD-GEN-07 | `"unknown"` | 400 Invalid param: gender |
| QA-PD-GEN-08 | `"Other"` (capitalizado) | 400 Invalid param: gender |

---

## Campo `languages`

| ID | Valor enviado | Esperado |
|----|---------------|----------|
| QA-PD-LANG-01 | `"Portuguese, English"` | 200 — languages persiste como enviado |
| QA-PD-LANG-02 | `null` | 200 — languages limpo (null) |
| QA-PD-LANG-03 | `""` (vazio) | 200 — normalizado para null (limpa) |
| QA-PD-LANG-04 | `"   "` (whitespace) | 200 — normalizado para null (limpa) |
| QA-PD-LANG-05 | string com espaços internos | 200 — preservado sem trim |

---

## Campo `address`

| ID | Valor enviado | Esperado |
|----|---------------|----------|
| QA-PD-ADDR-01 | `"Rua das Flores, 123, Lisboa"` | 200 — address persiste como enviado |
| QA-PD-ADDR-02 | `null` | 200 — address limpo (null) |
| QA-PD-ADDR-03 | `""` (vazio) | 200 — normalizado para null |
| QA-PD-ADDR-04 | `"  "` (whitespace) | 200 — normalizado para null |

---

## Campo `emergencyContact`

| ID | Valor enviado | Esperado |
|----|---------------|----------|
| QA-PD-EC-01 | número E.164 válido ex. `"+351912345678"` | 200 — persiste o valor |
| QA-PD-EC-02 | `null` | 200 — emergencyContact limpo |
| QA-PD-EC-03 | `""` (string vazia) | 400 (Phone.create falha — forward as-is) |
| QA-PD-EC-04 | `"nao-e-telefone"` | 400 (InvalidPhoneFormatError) |
| QA-PD-EC-05 | número sem código de país ex. `"912345678"` | 400 ou 200 — depende do Phone VO |

---

## Campo `nif`

| ID | Valor enviado | Esperado |
|----|---------------|----------|
| QA-PD-NIF-01 | `"123456789"` (string válida) | 200 — nif persiste |
| QA-PD-NIF-02 | `123456789` (JSON number) | 200 — convertido para string antes do DTO |
| QA-PD-NIF-03 | `null` | 200 — nif limpo (null no banco) |
| QA-PD-NIF-04 | `"ABC"` (inválido) | 400 (InvalidNifError) |
| QA-PD-NIF-05 | `0` (zero como number) | 200 — convertido para `"0"`; Nif VO determina validade |
| QA-PD-NIF-06 | `""` (string vazia) | 400 (InvalidNifError) |

---

## Patch esparso

| ID | Cenário | Esperado |
|----|---------|----------|
| QA-PD-SP-01 | Enviar só `{ gender: "male" }` | 200; somente gender muda; languages/address/nif/emergencyContact intocados |
| QA-PD-SP-02 | Enviar `{ languages: "PT", nif: "123456789" }` | 200; só esses 2 campos mudam |
| QA-PD-SP-03 | Enviar todos os campos pessoais | 200; todos os 5 campos atualizados |
| QA-PD-SP-04 | Dois patches sequenciais (gender, depois nif) | Cada um afeta só seu campo; outro permanece |
| QA-PD-SP-05 | Patch só `{ address: null }` após address preenchido | 200; address = null; demais campos intactos |

---

## Leitura pós-patch (`GET /api/employees`)

| ID | Cenário | Esperado |
|----|---------|----------|
| QA-PD-READ-01 | GET após patch gender="male" | item tem `gender: "male"` |
| QA-PD-READ-02 | GET após patch gender=null | item tem `gender: null` |
| QA-PD-READ-03 | GET após patch languages="" | item tem `languages: null` |
| QA-PD-READ-04 | GET após patch nif=123456789 (number) | item tem `nif: "123456789"` (mapper converte number→string) |
| QA-PD-READ-05 | GET após patch nif=null | item tem `nif: null` |
| QA-PD-READ-06 | Resposta 200 nunca expõe `password` | sem campo `password` nos items |

---

## E2E P0

| ID | Fluxo |
|----|-------|
| QA-PD-E2E-01 | A1 seta todos os 5 campos em E1 → GET confirma → A1 limpa tudo com null → GET confirma null |
| QA-PD-E2E-02 | M1 atualiza E1 gender ok; tenta M1 self-patch → 403; tenta A1 → 403 |
| QA-PD-E2E-03 | Body só com unknown keys (name, status) → 400 |
| QA-PD-E2E-04 | actorId=A1 forjado no body, logado como M1 → Matrix de M1 aplicada (não A1) |
| QA-PD-E2E-05 | E1 REMOVED (anonymize) → PATCH /personal-data → 409; PATCH do mesmo ID via A1 → 409 |
