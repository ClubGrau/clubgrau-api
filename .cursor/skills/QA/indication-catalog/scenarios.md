# Catálogo QA — indication catalog

Ler **somente** se o modo for `full`. IDs estáveis. Esperado = HTTP + `{error}` quando houver.

Nomes abaixo são o texto do caso. Na execução, prefixar com `QA-<unix>` salvo quando o caso é comprimento, espaços ou colisão explícita (`Google  Ads`).

## AUTH

| ID | Cenário | Esperado |
|----|---------|----------|
| QA-AUTH-01 | GET catalog sem Bearer | 401 `Token not provided` |
| QA-AUTH-02 | POST origin sem Bearer | 401 `Token not provided` |
| QA-AUTH-03 | token inválido em qualquer uma das 5 rotas | 401 `Invalid token` |
| QA-AUTH-04 | E1 GET catalog | 403 `Forbidden` |
| QA-AUTH-05 | E1 POST origin | 403 `Forbidden`, sem write |
| QA-AUTH-06 | E1 PATCH nome | 403 `Forbidden` |
| QA-AUTH-07 | E1 POST end | 403 `Forbidden` |
| QA-AUTH-08 | E1 POST reopen | 403 `Forbidden` |

## Catalog `GET /api/indication-catalog`

| ID | Cenário | Esperado |
|----|---------|----------|
| QA-CAT-01 | collection `origins` vazia (processo sem seed) | 200; Canal, Campanha, Amigo nessa ordem; cada `origins: []` |
| QA-CAT-02 | ids e flags | `canal` Canal `holdsOrigins: true`; `campanha` Campanha `true`; `amigo` Amigo `false` |
| QA-CAT-03 | Amigo nunca lista origin | `origins: []` mesmo depois de creates em Canal e Campanha |
| QA-CAT-04 | shape do origin | só `id`, `categoryId`, `name`, `active` |
| QA-CAT-05 | ordem | origins da categoria na ordem de criação; o novo é o último |
| QA-CAT-06 | ended permanece | `active: false` ainda no array, mesmo nome |
| QA-CAT-07 | A1 e M1 | ambos 200 |

## Create `POST /api/indication-origin`

| ID | Ação | Esperado |
|----|------|----------|
| QA-CR-01 | A1 `{categoryId:"canal", name}` | 201 `{data:{id}}`; último de Canal; `active: true` |
| QA-CR-02 | M1 `{categoryId:"campanha", name}` | 201; último de Campanha |
| QA-CR-03 | segundo canal | 201; depois do primeiro, não antes |
| QA-CR-04 | primeiro origin de uma categoria vazia | é o primeiro dessa categoria |
| QA-CR-05 | `categoryId:"amigo"` | 400 `Indication category does not hold origins`; GET sem origin novo |
| QA-CR-06 | `categoryId` desconhecido (`foo`, `Canal`, `""`) | 400; `""` é `Missing param categoryId`; outro texto é `Indication category is unknown` |
| QA-CR-07 | sem `categoryId` ou sem `name` | 400 `Missing param …` |
| QA-CR-08 | `name: ""` ou `null` | 400 `Missing param name` |
| QA-CR-09 | `name` só espaços ou 1 caractere após normalizar | 400 `Name must be at least 2 characters long` |
| QA-CR-10 | nome normalizado com 101 caracteres | 400 `Name must be at most 100 characters long` |
| QA-CR-11 | nome normalizado com 2 e com 100 | 201; valor guardado já sem espaços nas pontas e sem espaços duplos |
| QA-CR-12 | mesmo nome, outro case, mesma categoria, origin ativo | 409 `Indication origin name is already reserved` |
| QA-CR-13 | `"Google  Ads"` e depois `"Google Ads"` na mesma categoria | segundo 409 |
| QA-CR-14 | mesmo nome na outra categoria | 201 |
| QA-CR-15 | `"Verão"` em Canal e `"Verao"` em Canal | ambos 201 (acento distinto) |
| QA-CR-16 | nome de origin ended na mesma categoria | 409; sem write |
| QA-CR-17 | `actorId`, `position`, `active` no body | ignorados; 201 |
| QA-CR-18 | boot / restart não insere Instagram, TikTok, Google nem campanha | GET não ganha esses nomes sozinho |

## Correct `PATCH /api/indication-origin/:id`

| ID | Ação | Esperado |
|----|------|----------|
| QA-CO-01 | nome novo na categoria | 200 `{data:{id}}` igual ao path; `categoryId` igual; GET mostra o nome novo |
| QA-CO-02 | nome anterior fica livre | create com o nome antigo na mesma categoria → 201, id diferente |
| QA-CO-03 | só case ou só espaços (`"Facebook"` → `"  facebook  "`) | 200; nome normalizado igual; sem origin extra |
| QA-CO-04 | nome já de outro origin da categoria (ativo) | 409; nome deste origin intacto |
| QA-CO-05 | nome já de outro origin ended da categoria | 409; nome deste origin intacto |
| QA-CO-06 | corrigir origin ended | 200; continua `active: false`; nome antigo livre; nome novo reservado |
| QA-CO-07 | id inexistente (24-hex ausente ou não-hex) | 400 `Indication origin not found` |
| QA-CO-08 | sem `name` / `name` falsy | 400 `Missing param name` |
| QA-CO-09 | nome curto, só espaços, ou > 100 | 400 igual ao create |
| QA-CO-10 | `id` diferente no body | path vence; o body não aponta outro origin |
| QA-CO-11 | `categoryId` no body | ignorado; categoria não muda |
| QA-CO-12 | M1 corrige origin criado por A1 | 200 |

## End `POST /api/indication-origin/:id/end`

| ID | Ação | Esperado |
|----|------|----------|
| QA-EN-01 | end de origin ativo | 200 `{data:{id}}`; GET `active: false`; mesmo nome; ainda na categoria |
| QA-EN-02 | segundo end | 200; continua inativo; sem origin duplicado |
| QA-EN-03 | create com o nome ended | 409 |
| QA-EN-04 | id inexistente | 400 `Indication origin not found` |
| QA-EN-05 | body presente (`name`, `actorId`) | ignorado; 200 |
| QA-EN-06 | M1 encerra origin de A1 | 200 |

## Reopen `POST /api/indication-origin/:id/reopen`

| ID | Ação | Esperado |
|----|------|----------|
| QA-RE-01 | reopen de origin ended | 200; GET `active: true`; mesmo id e nome |
| QA-RE-02 | segundo reopen | 200; continua ativo |
| QA-RE-03 | reopen de origin já ativo (sem end) | 200; continua `active: true` |
| QA-RE-04 | id inexistente | 400 `Indication origin not found` |
| QA-RE-05 | após reopen o nome segue reservado | create duplicado → 409 |
| QA-RE-06 | M1 reabre origin de A1 | 200 |

## E2E P0

| ID | Fluxo |
|----|-------|
| QA-E2E-01 | A1 cria canal → M1 cria campanha → GET os dois no fim das categorias → E1 403 em todas as rotas |
| QA-E2E-02 | cria → corrige → nome antigo livre e nome novo reservado → end → create do nome ended 409 → reopen → `active: true` → segundo end e segundo reopen 200 |
| QA-E2E-03 | Amigo e categoria desconhecida 400; mesmo nome em Canal e Campanha 201; `"Google  Ads"` / `"Google Ads"` 409 |
| QA-E2E-04 | collection vazia antes de qualquer create deste módulo: três categorias, zero origins; restart não semeia nomes |
