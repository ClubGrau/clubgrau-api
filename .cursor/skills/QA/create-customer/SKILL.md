---
name: qa-create-customer
description: >
  Gera ou executa o roteiro de QA caixa-preta da criação de customer
  (POST /api/customer com rank Bronze e indicação opcional, e
  GET /api/indication-linkable-origins). Otimizado para mínimo de tool calls
  e tokens: contrato HTTP no próprio skill, P0 por padrão, sem specs nem
  AGENT.md inteiro. Use quando o usuário escrever "/qa-create-customer",
  pedir cenários de QA da criação de customer, checklist de POST /api/customer,
  rank Bronze, indicação canal/campanha/amigo, ou executar o P0 contra a API.
---

# qa-create-customer

Roteiro de QA HTTP do `POST /api/customer` (rank de nascimento e indicação) e do read que alimenta o picker. **Não** é suite Jest. **Não** implementa código. Catálogo (nome, end, reopen) só entra como fixture; as regras do catálogo são o skill `qa-indication-catalog`.

## Modos (escolher 1; default = `p0`)

| Pedido do usuário | Modo | Tool calls |
|-------------------|------|------------|
| (omisso) / "checklist" / "P0" / "/qa-create-customer" | `p0` | **0** |
| "completo" / "todos os cenários" | `full` | **1** — ler [scenarios.md](scenarios.md) |
| "executa" / "roda contra a API" | `exec` | **0–2** (ver passo Exec) |
| "cria no Jira" | `jira` | **1** — `createJiraIssue` |

Não combinar modos na mesma resposta. Se ambíguo → `p0`.

---

## Contrato HTTP (não reler o codebase)

Base: `http://localhost:3003`. Auth: `POST /auth` `{email,password}` → Bearer. Envelope: ok `{data}`, erro `{error}`.

| Método | Path | Quem | Body |
|--------|------|------|------|
| POST | `/auth` | — | `{email,password}` |
| POST | `/api/customer` | qualquer employee autenticado (`ADMIN`, `MANAGER`, `EMPLOYEE`) | ver abaixo |
| GET | `/api/indication-linkable-origins` | qualquer employee autenticado | — |
| GET | `/api/indication-catalog` | só `ADMIN` e `MANAGER` | — (fixture / role) |
| POST | `/api/indication-origin` | só `ADMIN` e `MANAGER` | `{categoryId,name}` (fixture) |
| POST | `/api/indication-origin/:id/end` | só `ADMIN` e `MANAGER` | sem body (fixture) |
| POST | `/api/indication-origin/:id/reopen` | só `ADMIN` e `MANAGER` | sem body (fixture) |

`POST /api/customer` e o GET linkable: `authTokenMiddleware` apenas, **sem** `requireRoles`. Não há `403` nessas duas rotas. Não há `404` nesta API.

```json
{ "name": "Maria Silva", "email": "maria@example.com", "phone": "+351 912 345 678", "nif": 123456789,
  "indication": { "categoryId": "canal", "originId": "<24-hex>" } }
```

`indication` de amigo: `{ "categoryId": "amigo", "referrerCustomerId": "<24-hex>" }`. Walk-in: chave ausente ou `null`.

Sucesso: `201` `{ "data": { "id": "..." } }`. O body **não** devolve `rank` nem `indication`. Rank gravado é sempre `BRONZE`. Um `rank` no body (`BRONZE`, `SILVER`, `GOLD` ou outro) não é encaminhado. `wasReferred`, `referral` e qualquer chave desconhecida são ignorados: sem objeto `indication`, o customer nasce sem link.

Chave ausente ou `null` dentro de `indication` = não enviado. `""`, número ou os dois ids juntos = enviado. `canal` / `campanha` exigem `originId` e recusam `referrerCustomerId`. `amigo` exige `referrerCustomerId` e recusa `originId`. `categoryId` é código: `canal` | `campanha` | `amigo` (não ObjectId; `CANAL` é desconhecido).

| HTTP | Quando |
|------|--------|
| 201 | customer criado `{data:{id}}` |
| 200 | linkable `{data:{origins}}`, inclusive lista vazia |
| 400 | missing, VO, shape, id malformado, origin desconhecida / outra categoria / ended, referrer desconhecido |
| 401 | sem token / token inválido |
| 403 | `EMPLOYEE` no catálogo ou num comando do catálogo — `"Forbidden"`. Nunca no create nem no linkable |
| 409 | email já de um customer — `"Customer already exists"` |

| `{error}` | Quando |
|-----------|--------|
| `Token not provided` | sem Bearer |
| `Invalid token` | Bearer inválido |
| `Forbidden` | `EMPLOYEE` no catalog / create / end / reopen de origin |
| `Missing param name` / `email` | ausente, `""` ou `null` |
| `Missing param indication.categoryId` | `indication` objeto sem `categoryId`, ou `categoryId` falsy (`""`, `null`) |
| `Customer indication is invalid` | não-objeto (`string`, número, array); `categoryId` desconhecido (`foo`, `CANAL`); `canal`/`campanha` sem `originId` ou com `referrerCustomerId` (incluindo `""`); `amigo` sem `referrerCustomerId` ou com `originId`; id do lado certo que não é string |
| `Invalid id: "<valor>". Expected a 24-character hex string.` | id presente, string, e não é 24-hex. `originId: ""` em canal (referrer ausente) cai aqui, não no shape |
| `Customer indication origin was not found` | 24-hex sem linha no catálogo |
| `Customer indication origin belongs to another category` | canal com id de campanha, ou o inverso. Ended da outra categoria também é mismatch |
| `Customer indication origin is ended` | origin da categoria certa com `active: false` |
| `Referrer customer was not found` | 24-hex de amigo sem customer |
| `Customer already exists` | email já gravado (comparação no valor normalizado) |
| `Name must be at least 2 characters long` / `at most 100 characters long` | depois de trim + colapso de espaços |
| `Email is required` | email só espaços |
| `Invalid email format: "<valor>"` | não casa `local@domain.tld` |
| `Invalid phone format: …` | phone não vazio com dígitos fora de 7–15 |
| `NIF must have exactly 9 digits` | nif presente que não tem 9 dígitos |

Ordem da recusa, parando na primeira: `name`/`email` obrigatórios → `indication` não-objeto ou sem `categoryId` → shape e VOs (nome, email, phone, nif, id) → email já usado → origin ou referrer → write. Indicação inválida com email novo **não** grava “sem link”. Email duplicado com indicação válida (origin ativa) é `409`, não `201`. Email duplicado com origin ended ainda é `409` (o email é checado antes do catálogo). Nada é escrito em `400` ou `409`: o mesmo email, num walk-in seguinte, responde `201`.

**Nome:** trim, espaços repetidos viram um, 2–100. **Email:** trim + minúsculas; unicidade é nesse valor (`Maria@X.com` e `maria@x.com` colidem). **Phone** omitido, `null` ou `""` grava `null`; valor presente persiste só dígitos. **Nif** omitido, `null` ou `0` grava `null`; presente é número JSON de 9 dígitos com check digit. Fixture válida: `123456789`. Phone de fixture: `+351 912 345 678`.

**Linkable `200`:** `{ "data": { "origins": [ { "id", "categoryId", "name" } ] } }`. Só origins **ativas** de `canal` e `campanha`. Sem `active`, `position`, `intervals`. Sem categorias. Amigo nunca é item. Ordem: todos os `canal`, depois todos os `campanha`; dentro da categoria, ordem de criação (o novo é o último dela). Lista vazia quando não há origin ativa. O create **não** confia nessa lista: origin encerrada depois do GET é `400` no POST.

**História:** end de uma origin **não** apaga nem altera o customer já ligado. Reopen também não. A origin ended sai do linkable e o create novo com ela é `400`; depois do reopen volta a poder ser escolhida. Um customer pode ser referrer de vários. Não há auto-indicação no nascimento (o id novo ainda não existe). Não há rota que mude `rank`.

**Fora de escopo (não testar / não falhar):** transição para Prata/Ouro; list, get, filtro por rank, "Indicou N"; corrigir ou apagar indicação depois do create; picker de amigo no frontend; regras de nome do catálogo (reservado, 2–100, Amigo não segura origin) — isso é `qa-indication-catalog`; `404`.

---

## Fixtures (alias)

A1 ADMIN ACTIVE · M1 MANAGER ACTIVE · E1 EMPLOYEE ACTIVE · senha `P@ssword123`.

Emails e nomes de origin levam `qa-<unix>` (email `qa-<unix>-<caso>@example.com`). Origens já gravadas não falham o linkable: o critério é canal antes de campanha, o origin **deste** run no fim da categoria dele, ended de fora, e amigo ausente. Lista vazia só quando não existe origin ativa.

---

## Saída — modo `p0`

Markdown curto. Sem preâmbulo, sem repetir este skill, sem colar JWT. O `201` não mostra rank nem link: não inventar essa asserção no HTTP. “Nada escrito” = o mesmo email ainda cria (`201`).

```markdown
## QA P0 — create customer

**API:** `http://localhost:3003` · **Auth:** `POST /auth`

### Fixtures
- A1 ADMIN · M1 MANAGER · E1 EMPLOYEE (todos ACTIVE)
- Emails e origins com sufixo `qa-<unix>`

### Roteiro
1. [ ] AUTH — sem Bearer no POST customer e no GET linkable → 401 `Token not provided`; Bearer inválido → 401 `Invalid token`; E1 walk-in → 201 (não 403)
2. [ ] WALK — sem `indication` e `indication: null` → 201 `{data:{id}}`; `rank: "GOLD"` e `wasReferred` ignorados → 201; sem `name` ou sem `email` → 400 `Missing param …`
3. [ ] LINK — A1 cria canal ativo e M1 campanha ativa; E1 GET linkable → 200; canal antes de campanha; cada novo é o último da categoria; item só `id`, `categoryId`, `name`; ended e amigo não entram
4. [ ] CREATE — canal ativo, campanha ativa e amigo (customer já criado) → 201; o outro id omitido ou `null`; o mesmo referrer num segundo customer → 201
5. [ ] ORIGIN — ended, 24-hex inexistente, id da outra categoria, sem `originId` → 400 (mensagem da tabela); cada email recusado ainda cria num walk-in → 201
6. [ ] SHAPE — `categoryId` desconhecido; sem `categoryId`; `indication` string; os dois ids; `referrerCustomerId` em canal; `originId` em amigo; amigo sem referrer; referrer inexistente; id não-hex → 400; email livre
7. [ ] EMAIL — email já usado, com indicação válida e sem indicação → 409 `Customer already exists`; indicação inválida com email novo não grava (walk-in seguinte com esse email → 201)
8. [ ] HISTORY — end da origin já ligada: sai do linkable; create novo → 400 ended; email do customer ligado → 409; reopen devolve ao linkable e um create novo → 201; E1 no GET catalog e no POST origin → 403 `Forbidden`
```

---

## Modo `full`

Ler **somente** [scenarios.md](scenarios.md). Devolver a tabela de IDs. Não reler AGENT.md.

## Modo `exec`

Só se o usuário pediu executar. API local; se `POST /auth` falhar → parar (1 frase). Não subir servidor.

1. Login A1, M1 e E1 — guardar token **em variável de shell**, nunca na resposta. Sufixo `qa-<unix>` nos emails e nos nomes de origin.
2. Rodar só os 8 passos P0 via `curl -s -o /tmp/qa-customer.json -w "%{http_code}"`. Setup de origin (create / end / reopen) não é passo de catálogo: falhou o setup → o passo que dependia dele é fail, sem debugar o hexágono `indications`.
3. Resposta: tabela `passo | HTTP | pass/fail`. Sem body completo (máx. `error` ou `data.id`). Não consultar Mongo. Rank e link não estão no `201`; “nada escrito” é o walk-in seguinte `201`.

Proibido: `Read` em `*.spec.ts`, schema, use case, controller. Proibido `customer.http` / `indication.http` (JWT). Máx. 1 `Read` extra: `src/modules/customers/AGENT.md` **só** se um status HTTP do create divergir do contrato acima — e nesse caso `offset` na seção `### Presentation and HTTP`. Divergência só do linkable: `src/modules/indications/AGENT.md`, seção da rota linkable.

## Modo `jira`

1 call: `createJiraIssue` · `cloudId: paulodevmais.atlassian.net` · `issueTypeName: Tarefa` · `contentFormat: markdown` · summary `[Create Customer] QA P0 — rank Bronze / indication / linkable origins`. Description = bloco P0 acima. **Não** criar 1 issue por cenário. Não chamar `getAccessibleAtlassianResources`.

---

## Economia de tokens

1. Default `p0` = **zero** tools. Contrato está neste arquivo.
2. Nunca ler specs, schema, mapper, module, `AGENTS.md`, PRD, design doc.
3. Nunca dump de `curl`/JWT/`customer.http` na resposta.
4. `full` = 1 Read (`scenarios.md`). `jira` = 1 MCP. `exec` = shells + no máximo 1 Read de AGENT.md se divergir.
5. Não invocar `jira-feature-card` nem `plan-task`.
6. Não reexplicar rank nem o all-or-nothing na resposta se o modo for `p0` — o roteiro já os exercita.
