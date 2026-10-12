---
name: qa-indication-catalog
description: >
  Gera ou executa o roteiro de QA caixa-preta do Indication Catalog
  (GET catalog, create, correct name, end, reopen). Otimizado para mínimo de
  tool calls e tokens: contrato HTTP no próprio skill, P0 por padrão, sem specs
  nem AGENT.md inteiro. Use quando o usuário escrever "/qa-indication-catalog",
  pedir cenários de QA, checklist de teste do catálogo de indicações, ou
  executar o P0 contra a API.
---

# qa-indication-catalog

Roteiro de QA HTTP do hexágono `indications` (catálogo). **Não** é suite Jest. **Não** implementa código.

## Modos (escolher 1; default = `p0`)

| Pedido do usuário | Modo | Tool calls |
|-------------------|------|------------|
| (omisso) / "checklist" / "P0" / "/qa-indication-catalog" | `p0` | **0** |
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
| GET | `/api/indication-catalog` | — |
| POST | `/api/indication-origin` | `{categoryId,name}` |
| PATCH | `/api/indication-origin/:id` | `{name}` |
| POST | `/api/indication-origin/:id/end` | sem body |
| POST | `/api/indication-origin/:id/reopen` | sem body |

Toda rota: `authTokenMiddleware` → `requireRoles('ADMIN','MANAGER')`. `ADMIN` e `MANAGER` passam. `EMPLOYEE` → `403` inclusive no GET. Sem `actorId` no body; se vier, é ignorado. `:id` do path vence um `id` no body. Chaves desconhecidas são ignoradas.

`categoryId` é código: `canal` | `campanha` | `amigo`. Não é ObjectId. Origin `id` é 24-hex.

| HTTP | Quando |
|------|--------|
| 201 | create `{data:{id}}` |
| 200 | correct / end / reopen `{data:{id}}`, inclusive no-op; catalog `{data:{categories}}` |
| 400 | missing / nome inválido / categoria desconhecida / Amigo / origin inexistente |
| 401 | sem token / token inválido |
| 403 | `EMPLOYEE` — `"Forbidden"` |
| 409 | nome já reservado na mesma categoria (ativo ou ended) |

| `{error}` | Quando |
|-----------|--------|
| `Token not provided` | sem Bearer |
| `Invalid token` | Bearer inválido |
| `Forbidden` | role fora de ADMIN/MANAGER |
| `Missing param categoryId` / `name` / `id` | campo ausente ou falsy (`""`, `null`) |
| `Name must be at least 2 characters long` | após trim + colapso de espaços, inclusive só espaços |
| `Name must be at most 100 characters long` | após a mesma normalização |
| `Indication category is unknown` | `categoryId` fora dos três códigos |
| `Indication category does not hold origins` | `categoryId` = `amigo` |
| `Indication origin not found` | correct / end / reopen de id que não existe (hex inválido também) |
| `Indication origin name is already reserved` | mesmo `nameKey` na categoria |

**Catálogo `200`:** três categorias nesta ordem, mesmo com origens vazias:

| id | name | holdsOrigins |
|----|------|----------------|
| `canal` | Canal | true |
| `campanha` | Campanha | true |
| `amigo` | Amigo | false |

Cada origin no GET é só `{id, categoryId, name, active}`. Sem `position`, `intervals`, `nameKey`, contagem de dias. Ordem dentro da categoria: criação (o novo entra no fim). `active: false` continua na lista e continua reservando o nome.

**Nome:** trim, espaços repetidos viram um, 2–100, unicidade case-insensitive **dentro** da categoria. `"Google  Ads"` e `"Google Ads"` colidem. `"Verão"` e `"Verao"` não. O mesmo nome em Canal e Campanha é permitido. Ended reserva o nome. Corrigir para o mesmo nome (só case/espaço) é `200` sem write. Segundo end e segundo reopen são `200` sem mudança. Corrigir origin ended é permitido; o nome antigo fica livre.

**Fora de escopo (não testar / não falhar):** board, brief, período, busca, dias; campo no Customer, rank, linha de amigo; criar/renomear/apagar categoria; apagar ou mover origin; seed de Instagram/TikTok/Google; `404`.

---

## Fixtures (alias)

A1 ADMIN ACTIVE · M1 MANAGER ACTIVE · E1 EMPLOYEE ACTIVE · senha `P@ssword123`.

Nomes de origin do roteiro levam um sufixo único por execução (`QA-<timestamp>`), para um rerun não colidir com `409`. Origens já gravadas não falham o P0: o critério é ordem das categorias, flags, e o origin novo no **fim** da categoria dele.

---

## Saída — modo `p0`

Markdown curto. Sem preâmbulo, sem repetir este skill, sem colar JWT.

```markdown
## QA P0 — indication catalog

**API:** `http://localhost:3003` · **Auth:** `POST /auth`

### Fixtures
- A1 ADMIN · M1 MANAGER · E1 EMPLOYEE (todos ACTIVE)
- Sufixo único nos nomes (`QA-<timestamp>`)

### Roteiro
1. [ ] AUTH — sem Bearer → 401; token inválido → 401; E1 no GET e no POST → 403
2. [ ] CAT — A1 GET: `canal`, `campanha`, `amigo` nessa ordem; holdsOrigins true/true/false; Amigo `origins: []`; item de origin só `id`, `categoryId`, `name`, `active`
3. [ ] CREATE — A1 canal e M1 campanha → 201; cada um no fim da sua categoria; amigo e categoryId desconhecido → 400 e a lista não ganha origin
4. [ ] NAME — `""` → 400 missing; `"  "` e 1 char e 101 chars → 400; mesmo nameKey (outro case) → 409; `"Google  Ads"` depois `"Google Ads"` → 409; o mesmo nome na outra categoria → 201
5. [ ] CORRECT — novo nome: 200, mesmo id e categoryId, nome antigo livre (create de novo → 201); colisão com outro origin da categoria → 409 e o nome guardado não muda; só case/espaço → 200
6. [ ] END — continua no GET, `active: false`, mesmo nome; segundo end → 200; create com esse nome → 409; id inexistente → 400
7. [ ] REOPEN — `active: true`; segundo reopen → 200; id inexistente → 400; correct de id inexistente → 400
8. [ ] BODY — `actorId` e chaves desconhecidas ignorados; `id` no body do PATCH não troca o path
```

---

## Modo `full`

Ler **somente** [scenarios.md](scenarios.md). Devolver a tabela de IDs. Não reler AGENT.md.

## Modo `exec`

Só se o usuário pediu executar. API local; se `POST /auth` falhar → parar (1 frase). Não subir servidor.

1. Login A1, M1 e E1 — guardar token **em variável de shell**, nunca na resposta. Sufixo `QA-<unix>` nos nomes.
2. Rodar só os 8 passos P0 via `curl -s -o /tmp/qa-indication.json -w "%{http_code}"`.
3. Resposta: tabela `passo | HTTP | pass/fail`. Sem body completo (máx. `error` ou `data.id` / `categories[].id`).

Coleção `origins` vazia: o passo 2 exige `origins: []` nas três. Se já houver origens, não falhar por isso — conferir ordem, `holdsOrigins` e que o create novo é o último da categoria.

Proibido: `Read` em `*.spec.ts`, schema, use case, controller. Proibido `indication.http` (JWT). Máx. 1 `Read` extra: `src/modules/indications/AGENT.md` **só** se um status HTTP divergir do contrato acima — e nesse caso `offset` na seção `## Presentation & HTTP`.

## Modo `jira`

1 call: `createJiraIssue` · `cloudId: paulodevmais.atlassian.net` · `issueTypeName: Tarefa` · `contentFormat: markdown` · summary `[Indication Catalog] QA P0 — catalog / create / correct / end / reopen`. Description = bloco P0 acima. **Não** criar 1 issue por cenário. Não chamar `getAccessibleAtlassianResources`.

---

## Economia de tokens

1. Default `p0` = **zero** tools. Contrato está neste arquivo.
2. Nunca ler specs, schema, mapper, module, `AGENTS.md`, PRD, design doc.
3. Nunca dump de `curl`/JWT/`indication.http` na resposta.
4. `full` = 1 Read (`scenarios.md`). `jira` = 1 MCP. `exec` = shells + no máximo 1 Read de AGENT.md se divergir.
5. Não invocar `jira-feature-card` nem `plan-task`.
6. Não reexplicar categorias nem a reserva de nome na resposta se o modo for `p0` — o roteiro já os exercita.
