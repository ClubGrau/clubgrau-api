---
name: plan-spec
description: >
  Lê um arquivo de spec local (qualquer slice) e gera um plano de
  implementação estruturado alinhado à arquitetura hexagonal do grau-api.
  Leva em conta o playbook do AGENTS.md, o contrato atual do módulo
  (AGENT.md) e a tabela de arquivos da spec.
  Use quando o usuário escrever "/plan-spec <caminho/para/spec.md>"
  ou pedir "crie um plano para a spec ...".
---

# plan-spec

Gera um plano de implementação a partir de uma spec local do repositório.

## Inputs aceitos

| Forma | Exemplo |
|-------|---------|
| Caminho relativo | `/plan-spec docs/specs/minha-feature/03-http.md` |
| Caminho absoluto | `/plan-spec /Users/.../grau-api/docs/specs/minha-feature/03-http.md` |
| @-referência no chat | `@docs/specs/minha-feature/03-http.md` |
| Múltiplas specs (slice único) | `docs/specs/minha-feature/*.md` (lê todas em ordem) |

---

## Workflow (executar nesta ordem exata)

### Passo 1 — ler a spec (1 leitura)

Ler o arquivo de spec indicado pelo usuário.

Extrair:

- **Título / objetivo** — primeira linha `#` ou seção `## Responsibility`
- **Módulo** — campo `module:` no frontmatter **ou** inferir via: (a) `src/modules/<name>` no texto, (b) labels nas seções, (c) diretório da spec (`docs/specs/<feature>`)
- **Classificação** — campo `classification:` no frontmatter **ou** inferir:
  - New command (write) → palavras como "use case", "PATCH", "POST", "command"
  - New query (read) → palavras como "query", "GET", "read model"
  - Domain change → "entity", "VO", "policy", "error"
  - Infrastructure change → "schema", "mapper", "repository"
  - Cross-cutting → "shared", "BaseController", "pagination"
- **Tabela de arquivos** — seção `## Files` (Action: Create / Edit)
- **Checklist de spec** — seção `## Checklist` (itens `[ ]`)
- **Critérios de aceitação** — seção `## Acceptance criteria`
- **Out of scope** — seção `## Out of scope`
- **Dependências** — seção `## Depends on` ou `Parent:` ou `Jira:`

### Passo 2 — ler o contrato atual do módulo (0–1 leituras)

Com o módulo identificado, ler **apenas** `src/modules/<module>/AGENT.md`.

- Entender o estado atual: portas já abertas, repositório exposto, roteamento existente, wiring atual.
- Não explorar outros arquivos do módulo. O AGENT.md é suficiente.

Se o módulo não for identificável, ler `AGENTS.md` (seção "Quick references") para mapear.

### Passo 3 — classificar e decompor

Com base na classificação e na tabela de arquivos, mapear cada entrega a uma camada do hexágono:

| Camada | O que vai aqui |
|--------|---------------|
| Domain | Entidade, VO, erro, política, serviço de domínio |
| Application | DTO, porta inbound/outbound, use case, query |
| Presentation | Controller + spec, request type (raw HTTP) |
| Infrastructure | Rota (inbound HTTP), repository/mapper/schema (outbound) |
| Wiring | `*.module.ts` |
| Artefatos finais | `.http`, `AGENT.md` |

Respeitar o playbook:
- New command → domain → DTO → ports → use case + spec → controller + spec → rota → repo/mapper → module → .http → AGENT.md
- New query → filter DTO + read model → ports → query + spec → controller + spec → rota → module → .http → AGENT.md

### Passo 4 — gerar o plano

Produzir o plano no formato abaixo. **TODOs devem ser descritivos e granulares** — cada item deve ser implementável de forma independente sem contexto adicional.

---

## Formato de saída

```markdown
## Plano — <título da spec>

**Spec:** [`<arquivo>`](<caminho relativo>)
**Módulo:** `src/modules/<module>`
**Classificação:** <New command / New query / Domain change / …>

---

### Contexto

> <1–3 frases descrevendo o que esta spec entrega, sem repetir a spec inteira.>

---

### Dependências / pré-requisitos

- <slice ou arquivo que deve existir antes de iniciar — ex: "Slice 02 (use case) deve estar merged">
- <se nenhuma, omitir esta seção>

---

### Out of scope (não implementar)

- <lista dos itens explicitamente fora de escopo nesta spec>

---

### Passos

#### 1. Presentation — Request type

- [ ] **Criar** `presentation/http/<kebab>.request.ts`
  - Descrever os campos exatos com seus tipos (`string | number | null`, etc.)
  - Anotar por que campos sensíveis (id, actorId) são opcionais neste tipo bruto

#### 2. Presentation — Controller

- [ ] **Criar** `presentation/controllers/<kebab>.controller.ts`
  - Injetar apenas a porta inbound (sem Express)
  - Detectar presença de campos via `'key' in request` (listar quais campos)
  - Normalizar cada campo presente (descrever as regras de normalização de cada um)
  - Montar o DTO de chamada com apenas os campos presentes + actorId + id
  - Mapear cada erro de domínio para o helper HTTP correto (copiar a tabela da spec)
  - Retornar `ok({ id })` no sucesso

#### 3. Presentation — Controller spec

- [ ] **Criar** `presentation/controllers/<kebab>.controller.spec.ts`
  - Stub da porta inbound
  - <listar cada caso de teste com comportamento esperado — copiar da seção "Spec expectations">

#### 4. Infrastructure — Route

- [ ] **Editar** `infrastructure/inbound/http/<module>.routes.ts`
  - Adicionar `router.<method>('<path>', middlewares..., adaptRoute(<controller>))`
  - Aceitar o novo controller no parâmetro de `make<Module>Routes`

#### 5. Module — Wiring

- [ ] **Editar** `<module>.module.ts`
  - Instanciar os novos serviços de domínio (se houver) — sem portas no construtor
  - Instanciar o use case injetando as dependências corretas (descrever a assinatura exata)
  - Instanciar o controller com o use case
  - Passar o controller para `make<Module>Routes`
  - Incluir o controller no objeto de retorno se o módulo já retorna controllers

#### 6. REST Client

- [ ] **Editar** `src/client/<module>.http`
  - Adicionar sample mínimo de sucesso
  - Adicionar sample de campo clearable (null)
  - Adicionar sample com corpo completo (todos os campos da spec)
  - Adicionar comentário sobre campos ignorados e casos de 400

#### 7. Living contract

- [ ] **Editar** `src/modules/<module>/AGENT.md`
  - Tabela Delivered: adicionar o novo comando/query com rota
  - Directory map: adicionar novos arquivos criados
  - Seção de domínio: novos erros, políticas, serviços
  - Seção da aplicação: portas e DTO
  - Seção de apresentação: controller e error map
  - Seção de rotas: nova linha de rota
  - Seção de wiring: novos passos de composição
  - Open decisions: decisões deixadas em aberto pela spec

---

### Critérios de aceitação (copiar da spec)

- [ ] <critério 1>
- [ ] <critério 2>
- ...

---

### Checklist de entrega (da spec)

- [ ] <item 1 do checklist da spec>
- [ ] <item 2>
- ...
```

---

## Regras de qualidade dos TODOs

1. **Cada TODO deve ser autossuficiente** — descrever o quê, não apenas "criar X". Incluir a assinatura esperada, a regra de negócio ou o comportamento a validar.
2. **Nenhum TODO de "implementar tudo"** — se um passo tem múltiplas regras (ex: normalização de campos), decompor em sub-items.
3. **Ordem respeitada** — respeitar a ordem do playbook (domain → application → presentation → infra → wiring → artefatos).
4. **Não especular sobre out-of-scope** — se a spec diz "não implementar X", não colocar X no plano.
5. **Reutilizar, não reimplementar** — se a spec diz "reutilizar `requireRoles`" ou "mesma instância de repositório", indicar isso no TODO.

## Regras de economia de tokens

1. **Nunca** ler mais de 2 arquivos adicionais além da spec + AGENT.md do módulo.
2. **Nunca** explorar todos os arquivos do módulo — o AGENT.md é suficiente para o contexto de wiring.
3. **Nunca** buscar specs relacionadas automaticamente — focar apenas na spec indicada.
4. **Sempre** reutilizar a tabela de arquivos e checklist da spec como base dos passos.
