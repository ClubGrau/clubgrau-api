---
name: qa-professional-data
description: >
  Gera ou executa o roteiro de QA caixa-preta do comando Update Professional Employee Data
  (PATCH /api/employee/:id/professional-data). Otimizado para mínimo de tool calls e tokens:
  contrato HTTP no próprio skill, P0 por padrão, sem specs nem AGENT.md inteiro.
  Use quando o usuário escrever "/qa-professional-data", pedir cenários de QA,
  checklist de teste de professional-data ou dados profissionais de employees,
  ou executar o P0 contra a API.
---

# qa-professional-data

Roteiro de QA HTTP do comando `Update Professional Employee Data`. **Não** é suite Jest. **Não** implementa código.

## Modos (escolher 1; default = `p0`)

| Pedido do usuário | Modo | Tool calls |
|-------------------|------|------------|
| (omisso) / "checklist" / "P0" / "/qa-professional-data" | `p0` | **0** |
| "completo" / "todos os cenários" | `full` | **1** — ler [scenarios.md](scenarios.md) |
| "executa" / "roda contra a API" | `exec` | **0–2** (ver passo Exec) |
| "cria no Jira" | `jira` | **1** — `createJiraIssue` |

Não combinar modos na mesma resposta. Se ambíguo → `p0`.

---

## Contrato HTTP (não reler o codebase)

Base: `http://localhost:3003`. Auth: `POST /auth` `{email,password}` → Bearer. Envelope: ok `{data}`, erro `{error}`.

| Método | Path | Body |
|--------|------|------|
| POST | `/auth` | `{email,password}` |
| PATCH | `/api/employee/:id/professional-data` | `{ jobTitle?, role?, status? }` |
| GET | `/api/employees` | leitura de confirmação (`jobTitle`, `role`, `status`, `deactivateAt`, `employmentId`) |
| POST | `/api/employee/update-status` | só o regressão: mesmo status atual continua `400` |

- `:id` vem do **path param** — `adaptRoute` mescla `req.params` após body; path vence body forjado.
- `actorId` vem do **JWT** (`adaptRoute`) — nunca do body.
- Requer `Authorization: Bearer <token>` + role `ADMIN` ou `MANAGER` (gate: `requireRoles`).
- `EMPLOYEE` actor → `403` no middleware, antes de chegar ao domínio.
- Campos **esparsos**: só `jobTitle` / `role` / `status` presentes no body são comando. Chave ausente = campo não tocado.
- `employmentId` e chaves desconhecidas (`name`, `email`, `gender`, `foo`) são **ignoradas** e não contam como campo.
- `password` presente (qualquer valor, inclusive `null`) → `400` na hora; a porta não é chamada. Não é chave ignorada.
- Sucesso: `200` `{ data: { id } }`.

### Comportamento por campo

| Campo | Presente + válido | `null` / `""` / whitespace | Echo (igual ao atual) |
|-------|-------------------|----------------------------|------------------------|
| `jobTitle` | persiste a string **sem trim** | limpa para `null` | pode `$set` de novo (como `name` no Main) |
| `role` | `ADMIN` \| `MANAGER` \| `EMPLOYEE`; delta só ADMIN | `400` `Invalid param role` | **no-op** — MANAGER pode ecoar |
| `status` | `ACTIVE` \| `INACTIVE` \| `VACATION`; delta = lifecycle | `400` `Invalid param status` | **no-op** — não é already-in-status |

`REMOVED` e qualquer status fora do enum operacional → `400` `Invalid status: "…"`. Role fora do enum → `400` `Invalid role: "…"`.

Pelo menos um de `jobTitle` / `role` / `status`. `{}`, só unknown, ou só `employmentId` → `400` `Missing param no professional-data fields`.

Ordem no controller: `password` → ausência dos três campos → `role`/`status` blank → normalizar `jobTitle`.

### Matriz (Job Title e qualquer save)

| Actor | Target | Resultado |
|-------|--------|-----------|
| ADMIN | qualquer não-REMOVED (inclusive self) | 200 |
| MANAGER | EMPLOYEE (não self) | 200 |
| MANAGER | MANAGER / ADMIN / self | 403 `Action not allowed` |
| EMPLOYEE | qualquer | 403 (middleware) |
| Actor não login-capable (`INACTIVE` / `REMOVED`) | — | 401 `Authentication failed` |
| Actor `VACATION` + só Job Title / Role (sem delta de status) | matriz acima | 200 |

**Target REMOVED** → `409` `Employee is already removed`. Corrigir `INACTIVE` **não** reativa.

### Role — só o delta conta; mudança é ADMIN-only

| Body `role` vs Target | Quem |
|-----------------------|------|
| Igual | no-op. MANAGER pode ecoar junto com `jobTitle`. |
| Diferente | **ADMIN only**. MANAGER → `403`; **nada** é escrito (nem jobTitle, nem status). |

Sair de `ADMIN` → `409` `Last Admin must stay ACTIVE until another Admin exists` se `countLoginCapableAdmins` (`ACTIVE`\|`VACATION`) **ou** `countNonRemovedAdmins` for 1. Promover **para** `ADMIN`, ou `MANAGER`→`EMPLOYEE`, não dispara a contagem. `INACTIVE` promovido permanece `INACTIVE` se `status` não vier junto.

### Status — só o delta é lifecycle

| Body `status` vs Target | Efeito |
|-------------------------|--------|
| Igual | `200` no-op. Sem already-in-status. Sem write de `deactivateAt`. Sem `jobTitle` → sem write nenhum. |
| Diferente | `ACTIVE`→reativar, `INACTIVE`→desativar (`deactivateAt`), `VACATION`→férias. Mesma matriz de `POST /api/employee/update-status`. |
| `REMOVED` | `400`. Remove continua noutro comando. |

- MANAGER só altera status de `EMPLOYEE`. ADMIN em ADMIN/MANAGER → `403`.
- Último ADMIN `ACTIVE` → `INACTIVE` ou `VACATION` → `409`. A contagem do lifecycle continua **só ACTIVE** (`countActiveAdmins`).
- Actor `VACATION` + **delta** de status → `401`; sem write. Echo de status não chama o lifecycle.
- Recusa de role ou de lifecycle aborta o request inteiro: sem write parcial.
- `POST /api/employee/update-status` com o status **já atual** continua `400`. Este PATCH não muda esse endpoint.

### Mapeamento domínio → HTTP

| Erro | HTTP |
|------|------|
| `ActorAuthenticationFailedError` | 401 `Authentication failed` |
| `EmployeeProfessionalDataForbiddenError` | 403 `Action not allowed` |
| `EmployeeLifecycleForbiddenError` | 403 `Action not allowed` |
| `LastAdminProtectedError` | 409 `Last Admin must stay ACTIVE until another Admin exists` |
| `EmployeeAlreadyRemovedError` | 409 `Employee is already removed` |
| `EmployeeNotFoundError` | 400 `Employee not found` |
| `InvalidEmployeeRoleError` | 400 `Invalid role: "…"` |
| `InvalidEmployeeStatusError` | 400 `Invalid status: "…"` |
| `InvalidParamError` / `MissingParamError` | 400 `Invalid param …` / `Missing param …` |

**Fora de escopo (não testar / não falhar):** get-by-id; revogar JWT após role/status; persistir `employmentId`; alargar o Actor do lifecycle para `VACATION`; self-service; Main Data; Personal Data.

---

## Fixtures (alias)

A1,A2 ADMIN ACTIVE · M1 MANAGER ACTIVE · E1,E2 EMPLOYEE ACTIVE · E3 EMPLOYEE INACTIVE · senha `P@ssword123`.

---

## Saída — modo `p0`

Markdown curto. Sem preâmbulo, sem repetir este skill, sem colar JWT.

```markdown
## QA P0 — update professional employee data

**API:** `http://localhost:3003` · **Auth:** `POST /auth`

### Fixtures
- A1/A2 ADMIN · M1 MANAGER · E1/E2 EMPLOYEE (todos ACTIVE) · E3 EMPLOYEE INACTIVE
- Confirmar efeitos em `GET /api/employees` (não há get-by-id)

### Roteiro
1. [ ] AUTH — sem Bearer → 401; token inválido → 401; Actor INACTIVE (JWT vivo) → 401
2. [ ] ROLE — E1 (EMPLOYEE) como actor → 403 (middleware)
3. [ ] MATRIX — M1→E1 jobTitle 200; M1→outro MANAGER 403; M1→A1 403; M1 self 403
4. [ ] MATRIX — A1→E1 200; A1→M1 200; A1→A2 200; A1 self jobTitle 200
5. [ ] CARGO — M1 ecoa `role` atual + jobTitle novo → 200 (só jobTitle muda); M1 `role` diferente + jobTitle → 403 e nada persiste
6. [ ] CARGO — A1 promove E1 a MANAGER 200 (continua o status); com 2 ADMIN rebaixa um → 200; único ADMIN login-capable saindo de ADMIN → 409 sem write
7. [ ] STATUS — A1 E1 ACTIVE→INACTIVE 200 (`deactivateAt`); eco do status atual → 200 sem already-in-status; `REMOVED` → 400
8. [ ] STATUS — M1→E1 INACTIVE 200; M1 status delta em A1 → 403 e jobTitle junto não persiste; Actor VACATION + só jobTitle 200; Actor VACATION + delta de status → 401 sem write
9. [ ] LAST — 1 ADMIN ACTIVE: INACTIVE ou VACATION neste PATCH → 409 (jobTitle junto intocado); `POST /update-status` com o mesmo status atual ainda → 400
10. [ ] TGT — id inexistente → 400; target REMOVED → 409; E3 INACTIVE + jobTitle ou role → 200 e continua INACTIVE
11. [ ] BODY — `{}` / só unknown / só `employmentId` → 400; `password` (inclusive null) → 400; `role`/`status` null ou blank → 400; `id`/`actorId` forjados ignorados
12. [ ] JT — `"Barbeiro"` 200 com role e status intactos; null/`""`/`"  "` → null; `" Barbeiro "` sem trim; eco role+status sem jobTitle → 200 sem write; `employmentId` no body não altera a matrícula
```

---

## Modo `full`

Ler **somente** [scenarios.md](scenarios.md). Devolver a tabela de IDs. Não reler AGENT.md.

## Modo `exec`

Só se o usuário pediu executar. API local; se `POST /auth` falhar → parar (1 frase). Não subir servidor.

1. Login A1 (e M1 se necessário) — guardar token **em variável de shell**, nunca na resposta.
2. Rodar só os 12 passos P0 via `curl -s -o /tmp/qa-prof.json -w "%{http_code}"`.
3. Resposta: tabela `passo | HTTP | pass/fail`. Sem body completo (máx. `error` ou `data.id`).

O passo do último ADMIN em `VACATION` saindo de `ADMIN` não é alcançável por `POST /update-status` (o último ACTIVE não sai de ACTIVE). Se a fixture não existir, marcar esse caso `blocked` numa frase — não falhar o produto por isso.

Proibido: `Read` em `*.spec.ts`, schema, use case, controller. Proibido `employee.http` (JWT). Máx. 1 `Read` extra: `src/modules/employees/AGENT.md` **só** se um status HTTP divergir do contrato acima — e nesse caso `offset` na seção `## Presentation & HTTP` do controller professional-data.

## Modo `jira`

1 call: `createJiraIssue` · `cloudId: paulodevmais.atlassian.net` · `issueTypeName: Tarefa` · `contentFormat: markdown` · summary `[Employee Professional Data] QA P0 — update professional employee data`. Description = bloco P0 acima. **Não** criar 1 issue por cenário. Não chamar `getAccessibleAtlassianResources`.

---

## Economia de tokens

1. Default `p0` = **zero** tools. Contrato está neste arquivo.
2. Nunca ler specs, schema, mapper, module, `AGENTS.md`, PRD, design doc.
3. Nunca dump de `curl`/JWT/`employee.http` na resposta.
4. `full` = 1 Read (`scenarios.md`). `jira` = 1 MCP. `exec` = shells + no máximo 1 Read de AGENT.md se divergir.
5. Não invocar `jira-feature-card` nem `plan-task`.
6. Não reexplicar a matriz na resposta se o modo for `p0` — o roteiro já a exercita.
