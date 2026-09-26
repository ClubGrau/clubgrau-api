---
name: qa-personal-data
description: >
  Gera ou executa o roteiro de QA caixa-preta do comando Update Personal Employee Data
  (PATCH /api/employee/:id/personal-data). Otimizado para mínimo de tool calls e tokens:
  contrato HTTP no próprio skill, P0 por padrão, sem specs nem AGENT.md inteiro.
  Use quando o usuário escrever "/qa-personal-data", pedir cenários de QA,
  checklist de teste de personal-data de employees, ou executar o P0 contra a API.
---

# qa-personal-data

Roteiro de QA HTTP do comando `Update Personal Employee Data`. **Não** é suite Jest. **Não** implementa código.

## Modos (escolher 1; default = `p0`)

| Pedido do usuário | Modo | Tool calls |
|-------------------|------|------------|
| (omisso) / "checklist" / "P0" / "/qa-personal-data" | `p0` | **0** |
| "completo" / "todos os cenários" | `full` | **1** — ler [scenarios.md](scenarios.md) |
| "executa" / "roda contra a API" | `exec` | **0–2** (ver passo Exec) |

Não combinar modos na mesma resposta. Se ambíguo → `p0`.

---

## Contrato HTTP (não reler o codebase)

Base: `http://localhost:3003`. Auth: `POST /auth` `{email,password}` → Bearer. Envelope: ok `{data}`, erro `{error}`.

| Método | Path | Body |
|--------|------|------|
| POST | `/auth` | `{email,password}` |
| PATCH | `/api/employee/:id/personal-data` | `{ gender?, languages?, emergencyContact?, nif?, address? }` |

- `:id` vem do **path param** — `adaptRoute` mescla `req.params` após body; path vence body forjado.
- `actorId` vem do **JWT** (`adaptRoute`) — nunca do body.
- Requer `Authorization: Bearer <token>` + role `ADMIN` ou `MANAGER` (gate: `requireRoles`).
- `EMPLOYEE` actor → `403` no middleware, antes de chegar ao domínio.
- Campos pessoais **esparsos**: apenas chaves presentes no body são propagadas. Chave ausente = campo não tocado no banco.
- Chaves desconhecidas (`name`, `status`, `password`, `role`, `id`, `actorId`) → ignoradas pelo controller (não geram erro, não são propagadas).

### Comportamento por campo

| Campo | Quando null | Quando blank/whitespace | Validação | Erro |
|-------|-------------|------------------------|-----------|------|
| `gender` | Limpa | — (forward as-is → domínio rejeita) | `male \| female \| other` | 400 `Invalid param: gender` |
| `languages` | Limpa | → `null` (limpa) | livre | — |
| `address` | Limpa | → `null` (limpa) | livre | — |
| `emergencyContact` | Limpa | forward as-is → `Phone.create` falha | phone E.164 | 400 |
| `nif` | Limpa | — | número válido; JSON number → `String` | 400 |

### Matriz de autorização (domínio)

| Actor | Target | Resultado |
|-------|--------|-----------|
| ADMIN | qualquer não-REMOVED (inclusive self) | 200 |
| MANAGER | EMPLOYEE (não self) | 200 |
| MANAGER | MANAGER / ADMIN / self | 403 |
| EMPLOYEE | qualquer | 403 (middleware) |
| Actor não-ACTIVE | — | 401 (Actor VACATION é permitido) |

**Target REMOVED** → `409` (independente de quem é o Actor).

### Mapeamento domínio → HTTP

| Erro de domínio | HTTP |
|-----------------|------|
| `ActorAuthenticationFailedError` | 401 |
| `EmployeePersonalDataForbiddenError` | 403 |
| `EmployeeAlreadyRemovedError` | 409 |
| `EmployeeNotFoundError` | 400 |
| `EmptyPersonalEmployeeDataError` | 400 |
| `InvalidEmployeeGenderError` | 400 `Invalid param: gender` |
| `InvalidPhoneFormatError` | 400 |
| `InvalidNifError` | 400 |

---

## Fixtures (alias)

A1,A2 ADMIN ACTIVE · M1 MANAGER ACTIVE · E1,E2 EMPLOYEE ACTIVE · E3 EMPLOYEE INACTIVE · senha `P@ssword123`.

---

## Saída — modo `p0`

Markdown curto. Sem preâmbulo, sem repetir este skill, sem colar JWT.

```markdown
## QA P0 — update personal employee data

**API:** `http://localhost:3003` · **Auth:** `POST /auth`

### Fixtures
- A1/A2 ADMIN · M1 MANAGER · E1/E2 EMPLOYEE (todos ACTIVE) · E3 EMPLOYEE INACTIVE

### Roteiro
1. [ ] AUTH — sem Bearer → 401; token inválido → 401; Actor INACTIVE (JWT vivo) → 401
2. [ ] ROLE — E1 (EMPLOYEE) como actor → 403 (middleware)
3. [ ] MATRIX — M1→E1 ok 200; M1→E2 (MANAGER) 403; M1→A1 403; M1 self-patch 403
4. [ ] MATRIX — A1→E1 200; A1→M1 200; A1→A2 200; A1 self-patch 200
5. [ ] TGT — id inexistente → 400; E3 REMOVED (após anonimizar) → 409
6. [ ] BODY — body vazio → 400; só unknown keys (name,status,password) → 400; actorId/id forjados no body → ignorados
7. [ ] GENDER — "male"/null→200; ""→400; "MALE"→400; "unknown"→400
8. [ ] LANG+ADDR — languages: null/""/"  "→null 200; address: valor→200; null→200; "  "→null 200
9. [ ] EC+NIF — emergencyContact: E.164 valid→200; null→200; "invalid"→400; nif: number 200; null→200; "ABC"→400
10. [ ] SPARSE — patch gender só → languages/nif/address/emergencyContact não mudam; patch 3 campos → apenas os 3 mudam
```

---

## Modo `full`

Ler **somente** [scenarios.md](scenarios.md). Devolver a tabela de IDs. Não reler AGENT.md.

## Modo `exec`

Só se o usuário pediu executar. API local; se `POST /auth` falhar → parar (1 frase). Não subir servidor.

1. Login A1 (e M1 se necessário) — guardar token **em variável de shell**, nunca na resposta.
2. Rodar só os 10 passos P0 via `curl -s -o /tmp/qa-pd.json -w "%{http_code}"`.
3. Resposta: tabela `passo | HTTP | pass/fail`. Sem body completo (máx. `error` ou `data.id`).

Proibido: `Read` em `*.spec.ts`, schema, use case, controller. Proibido `employee.http` (JWT). Máx. 1 `Read` extra: `src/modules/employees/AGENT.md` **só** se um status HTTP divergir do contrato acima — e nesse caso `offset` na seção `## Presentation & HTTP`.

## Modo `jira`

1 call: `createJiraIssue` · `cloudId: paulodevmais.atlassian.net` · `issueTypeName: Tarefa` · `contentFormat: markdown` · summary `[Employee Personal Data] QA P0 — update personal employee data`. Description = bloco P0 acima. **Não** criar 1 issue por cenário. Não chamar `getAccessibleAtlassianResources`.

---

## Economia de tokens

1. Default `p0` = **zero** tools. Contrato está neste arquivo.
2. Nunca ler specs, schema, mapper, module, `AGENTS.md`, PRD, design doc.
3. Nunca dump de `curl`/JWT/`employee.http` na resposta.
4. `full` = 1 Read (`scenarios.md`). `jira` = 1 MCP. `exec` = shells + no máximo 1 Read de AGENT.md se divergir.
5. Não invocar `jira-feature-card` nem `plan-task`.
6. Não reexplicar a matriz na resposta se o modo for `p0` — o roteiro já a exercita.
