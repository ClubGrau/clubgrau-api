# Catálogo QA — remove customer

Ler **somente** se o modo for `full`. IDs estáveis. Esperado = HTTP + `{error}` quando houver.

Não há GET de customer por id. Efeitos confirmam-se na listagem, no create e (opcional) no documento Mongo. O remove bem-sucedido devolve o **mesmo** `id` no `200`.

Emails abaixo são o texto do caso. Na execução, prefixar com `qa-rm-<unix>-`. Id inexistente de exemplo: `507f1f77bcf86cd799439099`. Malformado: `not-an-id`.

Alinha-se ao [PRD remove-customer-v1](../../../docs/prd/remove-customer-v1.md) §5 (edge cases) e §7 (acceptance criteria), e ao done-check de `src/client/customer.http`.

---

## AUTH

| ID | Cenário | Esperado |
|----|---------|----------|
| QA-AUTH-01 | POST remove sem Bearer | 401 `Token not provided` |
| QA-AUTH-02 | Bearer inválido no remove | 401 `Invalid token` |
| QA-AUTH-03 | E1 POST remove (customer válido, senha ok) | 403 `Forbidden` |
| QA-AUTH-04 | E1 GET list após setup | 200 — list não usa `requireRoles` |
| QA-AUTH-05 | remove sem sessão no create de fixture | 401 no create; não prosseguir remove sem login ADMIN/MANAGER |

## Remove `POST /api/customer/remove`

| ID | Ação | Esperado |
|----|------|----------|
| QA-RM-01 | M1 remove R0 ativo + senha Actor correta | 200 `{data:{id}}` = id de R0 |
| QA-RM-02 | A1 remove walk-in ativo + senha Actor | 200 |
| QA-RM-03 | sem `id` / `id: ""` / `id: null` | 400 `Missing param id`; R0 inalterado |
| QA-RM-04 | sem `password` / `password: ""` / `password: null` | 400 `Missing param password`; R0 inalterado |
| QA-RM-05 | senha Actor errada | 401 `Authentication failed`; R0 inalterado |
| QA-RM-06 | id 24-hex sem customer | 400 `Customer was not found` |
| QA-RM-07 | id malformado (`not-an-id`) | 400 `Customer was not found` |
| QA-RM-08 | segundo POST remove no mesmo R0 | 409 `Customer is already removed` |
| QA-RM-09 | `actorId` forjado no body | Actor = JWT; senha do token define sucesso/falha |
| QA-RM-10 | remove com token de Actor que não loga (ex.: INACTIVE, se o ambiente tiver) | 401 no login ou 401 `Authentication failed` no remove — não alterar customer |

## List `GET /api/customers`

| ID | Cenário | Esperado |
|----|---------|----------|
| QA-LS-01 | list após remove de R0 | nenhum item com id de R0 |
| QA-LS-02 | `total` / `totalPages` | não contam R0 |
| QA-LS-03 | `search` pelo nome de R0 | R0 ausente |
| QA-LS-04 | `search` pelo email **original** de R0 (antes do remove) | R0 ausente |
| QA-LS-05 | `search` por phone ou nif antigos de R0 (se tinha) | R0 ausente |
| QA-LS-06 | item R2 (amigo de R1 ativo) | `indication.referrerRemoved: false`; `name` do referrer preenchido |
| QA-LS-07 | após remove de R1 (referrer) | R2 ainda listado; `referrerRemoved: true`; nome do referrer mantido |
| QA-LS-08 | indicação canal/campanha em customer ativo | shape sem `referrerRemoved` (só amigo) |
| QA-LS-09 | R1 removido | R1 ausente da list, mas R2 ainda referencia o id no snapshot embutido |
| QA-LS-10 | paginação `page`/`limit` | removidos nunca entram no conjunto filtrado |

## Create (efeitos pós-remove)

| ID | Ação | Esperado |
|----|------|----------|
| QA-CR-01 | `amigo` com `referrerCustomerId` = id de R0 **já removido** | 400 `Referrer customer was not found`; email livre |
| QA-CR-02 | walk-in com email **original** de R0 (libertado) | 201 `{data:{id}}`; id ≠ id de R0; Bronze |
| QA-CR-03 | segundo create com o mesmo email do novo customer | 409 `Customer already exists` |
| QA-CR-04 | `amigo` com referrer ativo (R1 antes do remove) | 201 — regressão de create |

## Papel no remove

| ID | Ação | Esperado |
|----|------|----------|
| QA-ROLE-01 | A1 remove customer ativo | 200 |
| QA-ROLE-02 | M1 remove customer ativo | 200 |
| QA-ROLE-03 | E1 remove customer ativo (senha E1 correta) | 403 `Forbidden` |
| QA-ROLE-04 | E1 POST create e GET list | 201 / 200 — fora do `requireRoles` do remove |

## Referrer e história de indicação

| ID | Ação | Esperado |
|----|------|----------|
| QA-REF-01 | remove referrer R1 com indicados R2 | R2 permanece na base com mesma `indication.referrerCustomerId` |
| QA-REF-02 | list após QA-REF-01 | R2 com `referrerRemoved: true` |
| QA-REF-03 | remove customer com indicação **canal** (R3) | 200; list sem o customer; Mongo: `indication` canal intacta |
| QA-REF-04 | remove customer com indicação **campanha** | 200; `indication` campanha intacta |
| QA-REF-05 | remove R0; create amigo apontando R0 | 400 referrer; remove R1 não restaura referrability de R0 |

## Documento `customers` (sem GET HTTP)

Model `Customer`, collection `customers`. Inspeção manual ou Compass; o exec HTTP padrão não abre Mongo.

| ID | Documento | Esperado |
|----|-----------|----------|
| QA-DOC-01 | R0 após remove ok | mesmo `_id`; `name` igual; `email` sentinela `removed.<id>@anonymized.invalid`; `phone`/`nif` null; `removedAt` set |
| QA-DOC-02 | R0 após remove ok | `rank`, `indication`, `createdAt` iguais ao pré-remove |
| QA-DOC-03 | R0 após QA-RM-08 (segundo remove falhou) | documento idêntico ao pós primeiro remove (nada extra) |
| QA-DOC-04 | após QA-CR-02 | novo documento: id novo, email reutilizado, `removedAt` null, Bronze |
| QA-DOC-05 | R0 e novo customer com mesmo email | dois documentos distintos; R0 permanece removido |

## Não-objetivos / regressão

| ID | Cenário | Esperado |
|----|---------|----------|
| QA-NS-01 | não existe `POST /api/customer/restore` (ou similar) | rota ausente / não implementada — não restaurar R0 |
| QA-NS-02 | remove não altera customers indicados nem origins do catálogo | customers e origins de outros módulos inalterados pelo remove |
| QA-NS-03 | login de customer | fora de escopo; não há customer auth |

## E2E P0

| ID | Fluxo |
|----|-------|
| QA-E2E-01 | Setup R0,R1,R2 → M1 remove R0 → list sem R0 → create email R0 → 201 id novo → amigo R0 → 400 |
| QA-E2E-02 | R1 ativo: list R2 `referrerRemoved:false` → remove R1 → list R2 `referrerRemoved:true` → E1 remove → 403 |
| QA-E2E-03 | A1 remove com senha errada → 401 → remove com senha ok → 200 → segundo remove → 409 |
| QA-E2E-04 | ADMIN e MANAGER removem walk-ins distintos → ambos 200; documentos com sentinela de email distinta |

## Critérios de aceite (PRD §7) — mapeamento

| Critério PRD | IDs que cobrem |
|--------------|----------------|
| ADMIN/MANAGER + senha correta remove com campos corretos | QA-RM-01/02, QA-DOC-01/02, QA-ROLE-01/02 |
| Email original cria customer novo | QA-CR-02, QA-DOC-04 |
| Segundo remove recusado | QA-RM-08 |
| Senha errada recusada | QA-RM-05 |
| EMPLOYEE recusado | QA-ROLE-03 |
| Sem sessão recusado | QA-AUTH-01/02 |
| Id desconhecido/malformado | QA-RM-06/07 |
| List ignora removidos e search | QA-LS-01–05, QA-LS-10 |
| Create amigo em removido recusado | QA-CR-01 |
| `referrerRemoved` na list | QA-LS-06/07, QA-REF-02 |
| Sem restore | QA-NS-01 |
