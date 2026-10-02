---
name: qa-own-data
description: >
  Gera ou executa o roteiro de QA caixa-preta do Profile Card
  (PATCH /api/employee/me) e da reemissão do Session Token quando o body inclui name.
  Otimizado para mínimo de tool calls e tokens: contrato HTTP no próprio skill,
  P0 por padrão, sem specs nem AGENT.md inteiro.
  Use quando o usuário escrever "/qa-own-data", pedir cenários de QA do próprio
  colaborador, checklist de PATCH /employee/me, reemissão de session token após
  mudar o nome, ou executar o P0 contra a API.
---

# qa-own-data

Roteiro de QA HTTP de `Update Own Employee Data` e da reemissão do Session Token. **Não** é suite Jest. **Não** implementa código.

## Modos (escolher 1; default = `p0`)

| Pedido do usuário | Modo | Tool calls |
|-------------------|------|------------|
| (omisso) / "checklist" / "P0" / "/qa-own-data" | `p0` | **0** |
| "completo" / "todos os cenários" | `full` | **1** — ler [scenarios.md](scenarios.md) |
| "executa" / "roda contra a API" | `exec` | **0–2** (ver passo Exec) |
| "cria no Jira" | `jira` | **1** — `createJiraIssue` |

Não combinar modos na mesma resposta. Se ambíguo → `p0`.

---

## Contrato HTTP (não reler o codebase)

Base: `http://localhost:3003`. Auth: `POST /auth` `{email,password}` → Bearer. Envelope: ok `{data}` ou, só quando o body tem `name`, `{data, token}`. Erro: `{error}`.

| Método | Path | Body |
|--------|------|------|
| POST | `/auth` | `{email,password}` |
| GET | `/api/employee/me` | — (leitura de confirmação; nunca traz `token`) |
| PATCH | `/api/employee/me` | `{ name?, phone?, username?, gender?, languages?, emergencyContact?, nif?, address? }` |

- Não há `:id`. O sujeito é o `actorId` gravado no JWT (`adaptRoute`). `id` / `actorId` forjados no body são ignorados.
- `authTokenMiddleware` apenas — **sem** `requireRoles`. `EMPLOYEE`, `MANAGER` e `ADMIN` login-capable gravam a si mesmos.
- Login-capable no domínio: `ACTIVE` ou `VACATION`. `INACTIVE` / `REMOVED` com JWT ainda aceite pelo middleware → `401` **depois** de haver chave gravável. Body vazio chega a `400` **antes** do domínio, inclusive com Actor `INACTIVE`.
- Não há `403` nem `409` nesta rota.
- Não existe rota pública de reissue. O único gatilho é este PATCH com `name` no body.
- Campos **esparsos**: só chaves graváveis presentes (`'field' in body`) são comando. Chave ausente = campo não tocado.
- Chaves ignoradas (`email`, `password`, `status`, `role`, `jobTitle`, `employmentId`, `id`, desconhecidas) não contam e não geram `400` sozinhas. Junto de uma chave gravável, o save segue só com a gravável.

### Quando o `200` traz `token`

| Body | HTTP | Corpo |
|------|------|-------|
| Sem chave `name` | 200 | `{ data }` — **sem** chave `token` |
| Com `name` (valor novo **ou** igual ao já gravado) | 200 | `{ data, token }` — `token` é irmão de `data`, não campo do read model |
| `name` inválido / em branco | 400 | `{ error }` — sem `token` e sem write |
| Reissue falha com autenticação | 401 | `{ error: "Authentication failed" }` — o `$set` **não** desfaz (não injetável por HTTP) |

O `token` é um Session Token novo com claims vivas `{ id, name, email, role, status, sessionVersion }`. `name` da claim = `data.name` já normalizado. `sessionVersion` **não** incrementa. O token anterior continua válido até expirar. Não é Refresh Token. Não comparar a string inteira do JWT (no mesmo segundo o `iat` pode coincidir).

Decodificar só o payload (2.º segmento, base64url). Na resposta, no máximo as claims `name` e `sessionVersion` (iguais / diferentes). Nunca colar o JWT.

### Comportamento por campo

| Campo | Válido | `null` / `""` / whitespace | Erro |
|-------|--------|----------------------------|------|
| `name` | trim + colapsa espaços; 2–100; dispara reissue | `400` `Invalid param name` (antes do domínio) | `"A"` / >100 → `400` `Name must be at least 2…` / `at most 100…`; sem token |
| `phone` | 7–15 dígitos; persiste **só dígitos** | `400` `Invalid param phone` | formato inválido → `400` |
| `username` | trim; persiste | → `null` (limpa) | — |
| `gender` | `male` \| `female` \| `other` | → `null` (limpa) | `"MALE"` / `"invalid"` → `400` `Invalid gender` |
| `languages` | string as-is (sem trim) | → `null` | — |
| `address` | string as-is (sem trim) | → `null` | — |
| `emergencyContact` | phone; persiste só dígitos | → `null` (limpa; **não** encaminha `""`) | não-phone → `400` |
| `nif` | 9 dígitos + check digit; JSON number → `String` | → `null` | `"ABC"` / `0` → `400` `NIF must have exactly 9 digits` |

NIF de fixture: `123456789` (check digit válido). Phone de fixture: `+351 912 345 678` → persiste `351912345678`.

Pelo menos uma das oito chaves. `{}`, só ignoradas, ou só `email` → `400` `Missing param no own-employee-data fields`.

`data` é o read model da listagem (sem `password`). Confirmar efeitos com `GET /api/employee/me` do mesmo Actor.

### Mapeamento domínio → HTTP

| Erro | HTTP |
|------|------|
| sem Bearer | 401 `Token not provided` |
| token inválido / `sessionVersion` divergente | 401 `Invalid token` |
| `ActorAuthenticationFailedError` | 401 `Authentication failed` |
| `MissingParamError` / `InvalidParamError` | 400 `Missing param …` / `Invalid param …` |
| `InvalidNameError` / `InvalidPhoneFormatError` / `InvalidNifError` | 400 |
| `InvalidEmployeeGenderError` | 400 `Invalid gender` |
| qualquer outro throw do reissue | 500 — `$set` permanece |

**Fora de escopo (não testar / não falhar):** `PATCH` de outro colaborador (main / personal / professional); get-by-id; Password Reset e incremento de `sessionVersion`; Refresh Token; exigir que o JWT anterior deixe de funcionar; injetar falha do reissue depois do write.

---

## Fixtures (alias)

A1 ADMIN ACTIVE · M1 MANAGER ACTIVE · E1 EMPLOYEE ACTIVE · senha `P@ssword123`. Um Actor `INACTIVE` com JWT emitido enquanto ainda era `ACTIVE`, se o passo de auth precisar.

---

## Saída — modo `p0`

Markdown curto. Sem preâmbulo, sem repetir este skill, sem colar JWT.

```markdown
## QA P0 — own employee data + session token

**API:** `http://localhost:3003` · **Auth:** `POST /auth`

### Fixtures
- A1 ADMIN · M1 MANAGER · E1 EMPLOYEE (ACTIVE)
- Confirmar efeitos em `GET /api/employee/me` (o próprio Actor)

### Roteiro
1. [ ] AUTH — sem Bearer → 401; token inválido → 401; Actor INACTIVE + `{ phone }` → 401; Actor INACTIVE + `{}` → 400
2. [ ] SELF — E1, M1 e A1 gravam o próprio `phone` → 200; nenhum 403
3. [ ] SEM NAME — PATCH só `phone` → 200 `{ data }` sem chave `token`; `GET /employee/me` também sem `token`; `name` intacto
4. [ ] COM NAME — PATCH `name` novo → 200 `{ data, token }`; claim `name` = `data.name`; `sessionVersion` igual ao do login; `id`/`email`/`role`/`status` iguais
5. [ ] VELHO — Bearer anterior ainda faz `GET /me` → 200 com o nome novo; Bearer novo também → 200
6. [ ] ECO — PATCH com o `name` já gravado → 200 ainda com `token`; `sessionVersion` não sobe
7. [ ] BODY — `{}` ou só `email`/`status`/`role` → 400 `Missing param no own-employee-data fields`; `name` null/`""`/`"  "` → 400 `Invalid param name`, nome intacto, sem `token`
8. [ ] FORJA — E1 manda `actorId`/`id` de A1 + `name` → muda E1; `GET /me` de A1 continua com o nome de A1
9. [ ] NORM — `"  Ana   Silva  "` persiste e vai na claim como `"Ana Silva"`; `"A"` → 400 sem write e sem `token`
10. [ ] SPARSE — `username`/`gender`/`nif` sem `name` → 200 sem `token` e sem mudar `name`; `name` + `phone` muda os dois e devolve `token`
```

---

## Modo `full`

Ler **somente** [scenarios.md](scenarios.md). Devolver a tabela de IDs. Não reler AGENT.md.

## Modo `exec`

Só se o usuário pediu executar. API local; se `POST /auth` falhar → parar (1 frase). Não subir servidor.

1. Login E1 (A1/M1 se o passo precisar) — guardar tokens **em variável de shell**, nunca na resposta.
2. Rodar só os 10 passos P0 via `curl -s -o /tmp/qa-own.json -w "%{http_code}"`.
3. No passo do `token`, decodificar o payload e comparar claims. Não imprimir o JWT.
4. No fim, repor o `name` original de quem foi alterado (Bearer novo ou anterior servem).
5. Resposta: tabela `passo | HTTP | pass/fail`. Sem body completo (máx. `error`, `data.name` ou `sessionVersion` igual/diferente).

Proibido: `Read` em `*.spec.ts`, schema, use case, controller. Proibido `employee.http` (JWT). Máx. 1 `Read` extra: `src/modules/employees/AGENT.md` **só** se um status HTTP divergir do contrato acima — e nesse caso `offset` na seção `UpdateOwnEmployeeDataController`.

## Modo `jira`

1 call: `createJiraIssue` · `cloudId: paulodevmais.atlassian.net` · `issueTypeName: Tarefa` · `contentFormat: markdown` · summary `[Own Employee Data] QA P0 — PATCH /employee/me + session token`. Description = bloco P0 acima. **Não** criar 1 issue por cenário. Não chamar `getAccessibleAtlassianResources`.

---

## Economia de tokens

1. Default `p0` = **zero** tools. Contrato está neste arquivo.
2. Nunca ler specs, schema, mapper, module, `AGENTS.md`, PRD, design doc, ADR.
3. Nunca dump de `curl`/JWT/`employee.http` na resposta.
4. `full` = 1 Read (`scenarios.md`). `jira` = 1 MCP. `exec` = shells + no máximo 1 Read de AGENT.md se divergir.
5. Não invocar `jira-feature-card` nem `plan-task`.
6. Não reexplicar a regra do `token` na resposta se o modo for `p0` — o roteiro já a exercita.
