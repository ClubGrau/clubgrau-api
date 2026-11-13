---
name: qa-remove-customer
description: >
  Gera ou executa o roteiro de QA caixa-preta da remoção de customer
  (POST /api/customer/remove), efeitos em GET /api/customers e create.
  Otimizado para mínimo de tool calls e tokens: contrato HTTP no próprio skill,
  P0 por padrão, sem specs nem AGENT.md inteiro. Use quando o usuário escrever
  "/qa-remove-customer", pedir cenários de QA de remove customer, checklist de
  POST /api/customer/remove, referrerRemoved, ou executar o P0 contra a API.
---

# qa-remove-customer

Roteiro de QA HTTP do comando **Remove Customer** (anonymização com `removedAt`) e dos reads/writes que o PRD toca. **Não** é suite Jest. **Não** implementa código. Fixtures de criação seguem o contrato de `qa-create-customer` (walk-in, canal, amigo).

## Modos (escolher 1; default = `p0`)

| Pedido do usuário | Modo | Tool calls |
|-------------------|------|------------|
| (omisso) / "checklist" / "P0" / "/qa-remove-customer" | `p0` | **0** |
| "completo" / "todos os cenários" | `full` | **1** — ler [scenarios.md](scenarios.md) |
| "executa" / "roda contra a API" | `exec` | **0–2** (ver passo Exec) |
| "cria no Jira" | `jira` | **1** — `createJiraIssue` |

Não combinar modos na mesma resposta. Se ambíguo → `p0`.

---

## Contrato HTTP (não reler o codebase)

Base: `http://localhost:3003`. Auth: `POST /auth` `{email,password}` → Bearer. Envelope: ok `{data}`, erro `{error}`. Não há `404` nas regras de negócio deste módulo (id desconhecido no remove → `400`).

| Método | Path | Quem | Body |
|--------|------|------|------|
| POST | `/auth` | — | `{email,password}` |
| POST | `/api/customer/remove` | só `ADMIN` e `MANAGER` (`requireRoles`) | `{id,password}` — senha do **Actor** (step-up) |
| POST | `/api/customer` | qualquer employee autenticado | create (ver `qa-create-customer`) |
| GET | `/api/customers` | qualquer employee autenticado | query `page`, `limit`, `rank`, `search` |

`POST /api/customer/remove`: `authTokenMiddleware` + `requireRoles('ADMIN','MANAGER')`. O Actor é o JWT (`actorId` no adaptRoute), não o body. `actorId` forjado no body é ignorado.

```json
{ "id": "<24-hex customer id>", "password": "<actor password>" }
```

Sucesso: `200` `{ "data": { "id": "<same customer id>" } }`. O mesmo `id` e o **nome** permanecem; email vira sentinela `removed.<id>@anonymized.invalid` (minúsculas no domínio conforme persistência); `phone` e `nif` apagados; `removedAt` preenchido; `rank`, `indication` e `createdAt` inalterados. Não há rota de restore.

| HTTP | Quando |
|------|--------|
| 200 | remove ok `{data:{id}}` · list paginado |
| 201 | create com email libertado após remove |
| 400 | missing `id`/`password` · customer desconhecido/malformado · amigo apontando para referrer removido |
| 401 | sem token · token inválido · senha Actor errada / Actor não login-capable |
| 403 | `EMPLOYEE` no remove — `"Forbidden"` |
| 409 | customer já removido — `"Customer is already removed"` |
| 409 | email já usado por customer **ativo** (create) |

| `{error}` | Quando |
|-----------|--------|
| `Token not provided` | sem Bearer |
| `Invalid token` | Bearer inválido |
| `Forbidden` | `EMPLOYEE` no remove |
| `Missing param id` / `Missing param password` | ausente, `""` ou `null` |
| `Customer was not found` | id 24-hex sem linha ou id malformado no remove |
| `Authentication failed` | senha Actor errada ou Actor que não autentica |
| `Customer is already removed` | segundo remove no mesmo id |
| `Referrer customer was not found` | create `amigo` com `referrerCustomerId` de customer removido |
| `Customer already exists` | create com email de customer ainda ativo |

Ordem no remove: required `id`/`password` → verify password → find customer → domain remove → persist. Falha em `400`/`401`/`409` **não** altera o documento.

**List após remove:** o customer removido **não** entra em `customers`, nem em `total`, nem em `search` por nome/email/phone/nif antigos. Indicação **amigo** na página ganha `referrerRemoved: boolean` (`true` se o referrer está removido, `false` se ativo). Canal e campanha **não** ganham flag nova.

**Create após remove:** o email original do removido pode criar customer novo (`201`, id novo, Bronze, sem herdar indicação). `amigo` com id do removido → `400` como referrer inexistente.

**Fora de escopo (não testar / não falhar):** restore; update de customer; inatividade; transição de rank; vendas; quem gravou o remove; `GET` customer by id; picker de amigo no frontend; matriz completa do create (reservado a `qa-create-customer`); catálogo de origins (`qa-indication-catalog`).

---

## Fixtures (alias)

A1 ADMIN ACTIVE · M1 MANAGER ACTIVE · E1 EMPLOYEE ACTIVE · senha `P@ssword123`.

Emails com prefixo `qa-rm-<unix>-<caso>@example.com`. Customers de setup: M1 ou A1 cria via `POST /api/customer` (E1 pode criar se o teste não for de papel no remove). Guardar ids devolvidos em variáveis de shell no modo `exec`.

**Setup mínimo P0 (nesta ordem):**

1. **R0** — walk-in `qa-rm-<unix>-target@…` (vítima do remove).
2. **R1** — walk-in `qa-rm-<unix>-referrer@…` (referrer ativo).
3. **R2** — amigo com `referrerCustomerId` = id de **R1** (lista mostrará `referrerRemoved: false` enquanto R1 ativo).
4. Opcional **R3** — canal com `originId` ativo (só para DOC de indicação preservada).

---

## Saída — modo `p0`

Markdown curto. Sem preâmbulo, sem repetir este skill, sem colar JWT.

```markdown
## QA P0 — remove customer

**API:** `http://localhost:3003` · **Auth:** `POST /auth`

### Fixtures
- A1 ADMIN · M1 MANAGER · E1 EMPLOYEE (ACTIVE)
- Customers R0 (alvo), R1 (referrer), R2 (indicado por R1); emails `qa-rm-<unix>-…`

### Roteiro
1. [ ] AUTH — remove sem Bearer → 401 `Token not provided`; Bearer inválido → 401; E1 remove → 403 `Forbidden`; E1 GET list → 200 (list não exige ADMIN)
2. [ ] SETUP — criar R0, R1, R2; anotar ids
3. [ ] RM-OK — M1 remove R0 com senha Actor → 200 `{data:{id}}` igual ao id de R0
4. [ ] RM-GUARD — remove sem `password` ou sem `id` → 400 `Missing param …`; senha errada → 401 `Authentication failed`; id 24-hex inexistente → 400 `Customer was not found`; segundo remove em R0 → 409 `Customer is already removed`
5. [ ] LIST — GET list (E1 ok): `search` pelo email antigo de R0 não devolve R0; `search` pelo nome antigo de R0 não devolve R0; query separada pelo prefixo `qa-rm-<unix>` (ou email de R2): R0 ausente, `total` não conta R0 e item de R2 traz `referrerRemoved: false` (R1 ainda ativo)
6. [ ] REF — M1 remove R1; list: R2 mantém indicação amigo com nome do referrer e `referrerRemoved: true`; canal/campanha inalterados na shape se R3 existir
7. [ ] CREATE — POST amigo com `referrerCustomerId` = id de R0 removido → 400 `Referrer customer was not found`; POST walk-in com o **mesmo email** que R0 tinha antes do remove → 201 id ≠ R0
8. [ ] ROLE — A1 remove um walk-in novo com senha ok → 200; confirmar E1 remove → 403
```

Inspeção Mongo (opcional, fora do exec HTTP): após RM-OK, documento R0 com `removedAt`, email sentinela, `phone`/`nif` null, `name`/`rank`/`indication`/`createdAt` preservados.

---

## Modo `full`

Ler **somente** [scenarios.md](scenarios.md). Devolver a tabela de IDs. Não reler AGENT.md.

## Modo `exec`

Só se o usuário pediu executar. API local; se `POST /auth` falhar → parar (1 frase). Não subir servidor.

1. Login A1, M1 e E1 — tokens em variáveis de shell, nunca na resposta. Sufixo `qa-rm-<unix>`.
2. Setup R0/R1/R2 via `POST /api/customer` (origin ativo só se for testar R3).
3. Rodar os 8 passos P0 via `curl -s -o /tmp/qa-rm.json -w "%{http_code}"`. No passo 5 (LIST), **não** juntar `search=<email de R0>` com a asserção de R2 na mesma request: rodar chamadas separadas para `search` por email de R0, `search` por nome de R0, e `search=qa-rm-<unix>` (ou email de R2) para validar ausência de R0, `total` e `referrerRemoved: false` em R2.
4. Resposta: tabela `passo | HTTP | pass/fail`. Sem body completo (máx. `error` ou `data.id`). List: checar presença/ausência de id e `referrerRemoved` no item de R2, não dumpar a página inteira.

Proibido: `Read` em `*.spec.ts`, schema, use case, controller. Proibido `customer.http` (JWT). Máx. 1 `Read` extra: `src/modules/customers/AGENT.md` **só** se um status HTTP divergir do contrato acima — `offset` em `### Presentation and HTTP`.

## Modo `jira`

1 call: `createJiraIssue` · `cloudId: paulodevmais.atlassian.net` · `issueTypeName: Tarefa` · `contentFormat: markdown` · summary `[Remove Customer] QA P0 — POST /api/customer/remove / list / create`. Description = bloco P0 acima. **Não** criar 1 issue por cenário. Não chamar `getAccessibleAtlassianResources`.

---

## Economia de tokens

1. Default `p0` = **zero** tools. Contrato está neste arquivo.
2. Nunca ler specs, schema, mapper, module, `AGENTS.md`, PRD, design doc (salvo divergência no `exec`).
3. Nunca dump de `curl`/JWT/`customer.http` na resposta.
4. `full` = 1 Read (`scenarios.md`). `jira` = 1 MCP. `exec` = shells + no máximo 1 Read de AGENT.md se divergir.
5. Não invocar `jira-feature-card` nem `plan-task`.
6. Não reexplicar anonymização nem GDPR na resposta se o modo for `p0` — o roteiro já cobre o essencial.
