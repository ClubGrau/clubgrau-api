# Catálogo QA — create customer

Ler **somente** se o modo for `full`. IDs estáveis. Esperado = HTTP + `{error}` quando houver.

Não há GET de customer. O `201` é só `{data:{id}}`. Rank `BRONZE` e o link confirmam-se no documento (seção DOC), não no HTTP. “Nada escrito” no HTTP = o mesmo email, num walk-in seguinte, responde `201`.

Emails abaixo são o texto do caso. Na execução, prefixar com `qa-<unix>-`. Nomes de origin: `QA-<unix> <texto>`.

Hex de exemplo (inexistente, salvo se o run o tiver criado): `507f1f77bcf86cd799439099`. Id malformado: `not-an-id`.

---

## AUTH

| ID | Cenário | Esperado |
|----|---------|----------|
| QA-AUTH-01 | POST customer sem Bearer | 401 `Token not provided` |
| QA-AUTH-02 | GET linkable sem Bearer | 401 `Token not provided` |
| QA-AUTH-03 | Bearer inválido no POST customer | 401 `Invalid token` |
| QA-AUTH-04 | Bearer inválido no GET linkable | 401 `Invalid token` |
| QA-AUTH-05 | E1 POST walk-in | 201 `{data:{id}}` — não é 403 |
| QA-AUTH-06 | M1 POST walk-in | 201 |
| QA-AUTH-07 | A1 POST walk-in | 201 |

## Walk-in e rank `POST /api/customer`

| ID | Ação | Esperado |
|----|------|----------|
| QA-WALK-01 | body só `name` + `email` | 201; sem link |
| QA-WALK-02 | `indication: null` | 201; sem link |
| QA-WALK-03 | `rank: "GOLD"` junto de name e email, sem indication | 201; documento `rank: "BRONZE"` |
| QA-WALK-04 | `rank: "SILVER"` com indicação de canal válida | 201; documento `BRONZE` e o link do canal |
| QA-WALK-05 | `rank: "BRONZE"` ou `rank: "foo"` | 201; documento `BRONZE` |
| QA-WALK-06 | `wasReferred: true` e `referral: "João"` sem objeto `indication` | 201; sem link (chaves ignoradas) |
| QA-WALK-07 | sem `name` / `name: ""` / `name: null` | 400 `Missing param name`; email livre |
| QA-WALK-08 | sem `email` / `email: ""` / `email: null` | 400 `Missing param email` |

## Linkable `GET /api/indication-linkable-origins`

| ID | Cenário | Esperado |
|----|---------|----------|
| QA-LINK-01 | E1 com canal ativo e campanha ativa criados neste run | 200; todos os `canal` antes de todos os `campanha` |
| QA-LINK-02 | ordem dentro da categoria | o origin deste run é o último da categoria dele |
| QA-LINK-03 | shape | cada item só `id`, `categoryId`, `name` |
| QA-LINK-04 | origin ended | não entra, mesmo que tenha entrado num GET anterior |
| QA-LINK-05 | categoria amigo | nenhum item `amigo`; a lista não tem categorias |
| QA-LINK-06 | nenhuma origin ativa | `origins: []` (só quando o processo não tem ativa; se já houver, não falhar — ver QA-LINK-01) |
| QA-LINK-07 | A1 e M1 | ambos 200, o mesmo recorte que E1 |
| QA-LINK-08 | `actorId` na query ou no body | ignorado; 200 |

## Create com indicação válida

| ID | Ação | Esperado |
|----|------|----------|
| QA-CR-01 | A1 `{categoryId:"canal", originId}` de canal ativo; sem chave `referrerCustomerId` | 201; documento `canal` + esse `originId`, sem `referrerCustomerId`, `rank: "BRONZE"` |
| QA-CR-02 | o mesmo com `referrerCustomerId: null` | 201 |
| QA-CR-03 | M1 `{categoryId:"campanha", originId}` de campanha ativa | 201; documento `campanha` + `originId` |
| QA-CR-04 | E1 `{categoryId:"amigo", referrerCustomerId}` de um walk-in deste run; sem chave `originId` | 201; documento `amigo` + esse id, sem `originId` |
| QA-CR-05 | segundo customer com o mesmo `referrerCustomerId` | 201; id novo |
| QA-CR-06 | `originId` em hex maiúsculo de uma origin ativa | 201; documento guarda o id em minúsculas |
| QA-CR-07 | phone `+351 912 345 678` e nif `123456789` junto de um canal válido | 201 |

## Origin recusada

Cada linha usa email novo. Depois da `400`, walk-in com esse email → `201`.

| ID | Ação | Esperado |
|----|------|----------|
| QA-OR-01 | canal com origin ended da categoria canal | 400 `Customer indication origin is ended` |
| QA-OR-02 | campanha com origin ended da categoria campanha | 400 `Customer indication origin is ended` |
| QA-OR-03 | canal com 24-hex que não existe | 400 `Customer indication origin was not found` |
| QA-OR-04 | canal com id de campanha ativa | 400 `Customer indication origin belongs to another category` |
| QA-OR-05 | campanha com id de canal ativo | 400 `Customer indication origin belongs to another category` |
| QA-OR-06 | canal com id de campanha ended | 400 mismatch (não é “ended”) |
| QA-OR-07 | `{categoryId:"canal"}` sem `originId`, ou `originId: null` | 400 `Customer indication is invalid` |
| QA-OR-08 | canal, `originId: ""`, referrer ausente | 400 `Invalid id: "". Expected a 24-character hex string.` |
| QA-OR-09 | canal, `originId: "not-an-id"` | 400 `Invalid id: "not-an-id". Expected a 24-character hex string.` |
| QA-OR-10 | canal com `originId` ativo **e** `referrerCustomerId` (id real ou `""`) | 400 `Customer indication is invalid` (shape antes do hex) |

## Amigo recusado

Cada linha usa email novo. Depois da `400`, walk-in com esse email → `201`.

| ID | Ação | Esperado |
|----|------|----------|
| QA-FR-01 | `referrerCustomerId` 24-hex sem customer | 400 `Referrer customer was not found` |
| QA-FR-02 | `{categoryId:"amigo"}` sem `referrerCustomerId`, ou `referrerCustomerId: null` | 400 `Customer indication is invalid` |
| QA-FR-03 | amigo com `originId` (ativo ou `""`) e referrer válido | 400 `Customer indication is invalid` |
| QA-FR-04 | amigo, `referrerCustomerId: "not-an-id"`, origin ausente | 400 `Invalid id: "not-an-id". Expected a 24-character hex string.` |
| QA-FR-05 | amigo, `referrerCustomerId: ""` | 400 `Invalid id: "". Expected a 24-character hex string.` |

## Shape da indication

| ID | Ação | Esperado |
|----|------|----------|
| QA-SH-01 | `categoryId: "foo"` ou `"CANAL"` | 400 `Customer indication is invalid`; email livre |
| QA-SH-02 | `indication: {}` ou `{originId}` sem `categoryId` | 400 `Missing param indication.categoryId`; email livre |
| QA-SH-03 | `categoryId: ""` ou `null` | 400 `Missing param indication.categoryId` |
| QA-SH-04 | `indication: "instagram"` | 400 `Customer indication is invalid` |
| QA-SH-05 | `indication: 1` | 400 `Customer indication is invalid` |
| QA-SH-06 | `indication: []` | 400 `Customer indication is invalid` |
| QA-SH-07 | `indication` objeto com `rank` dentro e canal válido | 201; a chave extra não é link |

## Email

| ID | Ação | Esperado |
|----|------|----------|
| QA-EM-01 | segundo POST com o mesmo email, sem indication | 409 `Customer already exists` |
| QA-EM-02 | segundo POST com o mesmo email e canal ativo válido | 409; a indicação não salva o duplicado |
| QA-EM-03 | mesmo email com outro case e espaços (`" Maria@X.com "`) | 409 |
| QA-EM-04 | email já usado **e** origin ended | 409 (email antes do catálogo); nada novo escrito |
| QA-EM-05 | origin ended com email **novo** | 400 ended; walk-in seguinte com esse email → 201 (não nasceu “sem link”) |
| QA-EM-06 | shape inválido com email novo | 400; walk-in seguinte → 201 |
| QA-EM-07 | email de employee, nunca usado em customer | 201 (coleções distintas) |

## História do link

| ID | Ação | Esperado |
|----|------|----------|
| QA-HI-01 | criar com canal ativo, depois end dessa origin | customer segue (email → 409); documento com o mesmo `originId` e `rank: "BRONZE"` |
| QA-HI-02 | GET linkable depois do end | essa origin ausente |
| QA-HI-03 | POST customer novo com a origin ended | 400 `Customer indication origin is ended` |
| QA-HI-04 | reopen da origin | linkable volta a tê-la; POST novo → 201; o customer de QA-HI-01 inalterado |
| QA-HI-05 | end de novo depois do reopen | o customer ligado no QA-HI-04 permanece; create seguinte → 400 ended |

## Papel

| ID | Ação | Esperado |
|----|------|----------|
| QA-ROLE-01 | E1 GET `/api/indication-catalog` | 403 `Forbidden` |
| QA-ROLE-02 | E1 POST `/api/indication-origin` | 403 `Forbidden`; sem origin nova |
| QA-ROLE-03 | E1 POST end e POST reopen | 403 `Forbidden` |
| QA-ROLE-04 | E1 GET linkable e E1 POST customer | 200 e 201 |
| QA-ROLE-05 | sem sessão no catalog, no linkable e no customer | 401 |

## Campos de base (name, email, phone, nif)

Não são o rank nem a indicação. Recusa aqui também não grava.

| ID | Ação | Esperado |
|----|------|----------|
| QA-BASE-01 | `name` só espaços, ou 1 caractere após normalizar | 400 `Name must be at least 2 characters long` |
| QA-BASE-02 | nome normalizado com 101 caracteres | 400 `Name must be at most 100 characters long` |
| QA-BASE-03 | nome com 2 e com 100, pontas e espaços duplos | 201; documento já normalizado |
| QA-BASE-04 | email só espaços | 400 `Email is required` |
| QA-BASE-05 | email sem domínio | 400 `Invalid email format: "…"` |
| QA-BASE-06 | phone omitido, `null` ou `""` | 201; documento `phone: null` |
| QA-BASE-07 | phone `"123"` | 400 `Invalid phone format: …` |
| QA-BASE-08 | nif omitido, `null` ou `0` | 201; sem nif |
| QA-BASE-09 | nif `123` | 400 `NIF must have exactly 9 digits` |
| QA-BASE-10 | phone inválido com canal ativo | 400; email livre (não grava sem o phone) |

## Documento `customers` (sem GET)

Model `Customer`, collection `customers`. Só para inspeção; o exec HTTP não abre Mongo.

| ID | Documento | Esperado |
|----|-----------|----------|
| QA-DOC-01 | walk-in | `rank: "BRONZE"`; `indication` null ou ausente |
| QA-DOC-02 | qualquer `rank` no body | `rank: "BRONZE"` |
| QA-DOC-03 | canal ou campanha | `indication.categoryId` + `indication.originId`; sem `referrerCustomerId` |
| QA-DOC-04 | amigo | `indication.categoryId: "amigo"` + `indication.referrerCustomerId`; sem `originId` |
| QA-DOC-05 | depois de end ou reopen da origin | o documento do customer ligado não muda (`originId`, `rank`) |
| QA-DOC-06 | email | minúsculas, sem espaços nas pontas |
| QA-DOC-07 | não existe outro rank | nenhum documento deste run com `SILVER` ou `GOLD` |

## E2E P0

| ID | Fluxo |
|----|-------|
| QA-E2E-01 | E1 walk-in 201; A1 canal e M1 campanha; E1 linkable vê os dois no fim das categorias e não vê amigo |
| QA-E2E-02 | create canal, campanha e dois amigos do mesmo referrer → quatro 201; `rank` no body não muda o nascimento |
| QA-E2E-03 | ended, id trocado de categoria, shape incoerente e referrer desconhecido → 400; cada email ainda cria |
| QA-E2E-04 | email duplicado com indicação válida → 409; indicação inválida com email novo não nasce sem link |
| QA-E2E-05 | end depois do link: customer antigo segue, linkable perde a origin, create novo 400; reopen libera create novo; E1 403 no catalog e 200 no linkable |
