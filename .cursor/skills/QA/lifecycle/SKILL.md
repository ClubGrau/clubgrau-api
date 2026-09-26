---
name: qa-lifecycle
description: >
  Gera ou executa o roteiro de QA caixa-preta do ciclo de vida de employees
  (update-status, remove, list). Otimizado para mínimo de tool calls e tokens:
  contrato HTTP no próprio skill, P0 por padrão, sem specs nem AGENT.md inteiro.
  Use quando o usuário escrever "/qa-lifecycle", pedir cenários de QA,
  checklist de teste da release de employees, ou executar o P0 contra a API.
---

# qa-lifecycle

Roteiro de QA HTTP do hexágono `employees`. **Não** é suite Jest. **Não** implementa código.

## Modos (escolher 1; default = `p0`)

| Pedido do usuário | Modo | Tool calls |
|-------------------|------|------------|
| (omisso) / "checklist" / "P0" / "/qa-lifecycle" | `p0` | **0** |
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
| POST | `/api/employee` | create |
| GET | `/api/employees` | query `status=ACTIVE\|INACTIVE\|VACATION` |
| POST | `/api/employee/update-status` | `{id,status}` — **sem** `actorId` |
| POST | `/api/employee/remove` | `{id,password}` — senha do **Actor** |

Login só com `ACTIVE`. `REMOVED` no update-status ou `?status=REMOVED` → `400`.

| HTTP | Quando |
|------|--------|
| 200 | update `{data:{id,status}}` · remove `{data:{id}}` · list paginado |
| 400 | missing/invalid/`not found`/already-in-status |
| 401 | sem token / senha Actor errada / Actor não ACTIVE — `"Authentication failed"` |
| 403 | matriz / self-remove — `"Action not allowed"` |
| 409 | Last Admin / remove não INACTIVE / já REMOVED |

**Matriz:** ADMIN → qualquer role (Last Admin não sai de ACTIVE). MANAGER → só EMPLOYEE; Remove **403**. EMPLOYEE → **403**. Remove só Target `INACTIVE`. Self-remove **403**.

**Fora de escopo (não testar / não falhar):** revogar JWT; `GET` by id; filtro `REMOVED`; create/list sem matriz de papéis.

---

## Fixtures (alias)

A1,A2 ADMIN ACTIVE · M1 MANAGER ACTIVE · E1,E2 EMPLOYEE ACTIVE · senha `P@ssword123`.

---

## Saída — modo `p0`

Markdown curto. Sem preâmbulo, sem repetir este skill, sem colar JWT.

```markdown
## QA P0 — employee lifecycle

**API:** `http://localhost:3003` · **Auth:** `POST /auth`

### Fixtures
- A1/A2 ADMIN · M1 MANAGER · E1/E2 EMPLOYEE (todos ACTIVE)

### Roteiro
1. [ ] AUTH — sem Bearer → 401; INACTIVE não loga
2. [ ] US — A1: E1 ACTIVE→INACTIVE→ACTIVE→VACATION (200)
3. [ ] US — M1→E1 INACTIVE 200; M1→A2 INACTIVE 403; E1→E2 403
4. [ ] US — `status=REMOVED` 400; `actorId` no body ignorado
5. [ ] LAST — 1 ADMIN: INACTIVE/VACATION → 409; com A2 → 200
6. [ ] RM — A1 remove E1 ACTIVE → 409; desativa + senha Actor → 200
7. [ ] RM — some da list; email original cria de novo (id novo); senha Target → 401
8. [ ] RM — M1 remove E1 INACTIVE → 403; A1 self-remove → 403
9. [ ] LIST — sem REMOVED; `?status=REMOVED` → 400; sem `password` no item
```

---

## Modo `full`

Ler **somente** [scenarios.md](scenarios.md). Devolver a tabela de IDs. Não reler AGENT.md.

## Modo `exec`

Só se o usuário pediu executar. API local; se `POST /auth` falhar → parar (1 frase). Não subir servidor.

1. Login A1 (e M1 se o passo precisar) — guardar token **em variável de shell**, nunca na resposta.
2. Rodar só os 9 passos P0 via `curl -s -o /tmp/qa.json -w "%{http_code}"`.
3. Resposta: tabela `passo | HTTP | pass/fail`. Sem body completo (máx. `error` ou `data.id/status`).

Proibido: `Read` em `*.spec.ts`, schema, use case, controller. Proibido `employee.http` (JWT). Máx. 1 `Read` extra: `src/modules/employees/AGENT.md` **só** se um status HTTP divergir do contrato acima — e nesse caso `offset` na seção `## Presentation & HTTP`.

## Modo `jira`

1 call: `createJiraIssue` · `cloudId: paulodevmais.atlassian.net` · `issueTypeName: Tarefa` · `contentFormat: markdown` · summary `[Employee Lifecycle] QA P0 — update-status / remove / list`. Description = bloco P0 acima. **Não** criar 1 issue por cenário. Não chamar `getAccessibleAtlassianResources`.

---

## Economia de tokens

1. Default `p0` = **zero** tools. Contrato está neste arquivo.
2. Nunca ler specs, schema, mapper, module, `AGENTS.md`, PRD, design doc.
3. Nunca dump de `curl`/JWT/`employee.http` na resposta.
4. `full` = 1 Read (`scenarios.md`). `jira` = 1 MCP. `exec` = shells + no máximo 1 Read de AGENT.md se divergir.
5. Não invocar `jira-feature-card` nem `plan-task`.
6. Não reexplicar a matriz na resposta se o modo for `p0` — o roteiro já a exercita.
