---
name: plan-task
description: >
  Busca uma Jira issue (KAN-N) e gera um plano de implementação estruturado
  alinhado à arquitetura hexagonal do grau-api. Otimizado para mínimo de
  tool calls e tokens: cloudId fixo, resposta em markdown, exploração
  cirúrgica do codebase via labels + AGENTS.md.
  Use quando o usuário escrever "/plan-task KAN-N" ou pedir um plano
  de implementação para uma task do board KAN.
---

# plan-task

Gera um plano de implementação para uma Jira issue do board **KAN** (`paulodevmais.atlassian.net`).

## Defaults fixos (nunca chamar `getAccessibleAtlassianResources`)

| Campo | Valor |
|-------|-------|
| `cloudId` | `paulodevmais.atlassian.net` |
| Project | `KAN` |
| `responseContentFormat` | `"markdown"` ← **obrigatório** — evita ADF verboso |

---

## Workflow (executar nesta ordem exata)

### Passo 1 — buscar a issue (1 tool call)

```
getJiraIssue(
  cloudId: "paulodevmais.atlassian.net",
  issueIdOrKey: "<KAN-N>",
  responseContentFormat: "markdown"
)
```

Extrair apenas:
- `summary`
- `description` (markdown)
- `issueType.name` (Tarefa / História / Epic)
- `status.name`
- `labels` → usados para identificar o módulo
- `priority.name`
- Bloqueadores em `issuelinks` (se existirem)

Não chamar Confluence, issues relacionadas nem épicos, a menos que a descrição da issue referencie explicitamente uma URL de Confluence.

### Passo 2 — identificar o módulo impactado (0–1 leituras)

Usar os `labels` da issue para mapear o módulo:

| Label (prefixo) | Módulo (`src/modules/`) |
|-----------------|-------------------------|
| `employees` / `employee-*` | `employees` |
| `auth` | `auth` |
| `customers` / `customer-*` | `customers` |
| `commissions` / `commission-*` | `commissions` |

Se o label não mapear diretamente, ler `AGENTS.md` (seção "Quick references") para encontrar o módulo correto.

Com o módulo identificado, ler **apenas** `src/modules/<module>/AGENT.md` para entender o contrato atual (rotas expostas, ports abertos, decisões em aberto).

**Não** explorar todos os arquivos do módulo. O AGENT.md é suficiente para o plano.

### Passo 3 — classificar o trabalho

Com base no `issueType` e na descrição, classificar cada entrega em uma das categorias do playbook:

- **New command (write)** → use case + controller + rota + repo
- **New query (read)** → query + read port + DTO + rota
- **Domain change** → entidade / VO / política / erro
- **Infrastructure change** → schema / mapper / repositório
- **Cross-cutting** → shared VOs, BaseController, paginação

### Passo 4 — gerar o plano

Produzir o plano no formato abaixo. Não repetir a descrição da issue; focar no **o que fazer e em qual camada**.

---

## Formato de saída

```markdown
## Plano — <summary da issue>

**Issue:** [KAN-N](https://paulodevmais.atlassian.net/browse/KAN-N)
**Tipo:** <issueType> | **Status:** <status> | **Módulo:** `src/modules/<module>`

---

### Classificação
<New command / New query / Domain change / …>

---

### Passos

#### 1. Domain
- [ ] <entidade / VO / erro / política a criar ou ajustar>

#### 2. Application
- [ ] DTO: `application/dtos/<kebab>.dto.ts`
- [ ] Port inbound: `application/ports/inbound/<kebab>.port.ts`
- [ ] Port outbound: `application/ports/outbound/<kebab>.port.ts`
- [ ] Use case / Query: `application/usecases/<kebab>.usecase.ts` (+ spec)

#### 3. Presentation
- [ ] Controller: `presentation/controllers/<kebab>.controller.ts` (+ spec)

#### 4. Infrastructure
- [ ] Rota: `infrastructure/inbound/http/<module>.routes.ts`
- [ ] Repository / mapper / schema (se necessário)

#### 5. Wiring
- [ ] `<module>.module.ts` — injetar novo(s) adapter(s)

#### 6. Artefatos finais
- [ ] Atualizar `src/client/<module>.http`
- [ ] Atualizar `src/modules/<module>/AGENT.md` se o contrato mudou

---

### Decisões em aberto
- <questão que precisa ser resolvida antes de codar, se houver>

### Dependências
- <bloqueadores de outras issues, se houver — caso contrário omitir>
```

---

## Regras de economia de tokens

1. **Nunca** chamar `getAccessibleAtlassianResources` — `cloudId` é fixo.
2. **Sempre** usar `responseContentFormat: "markdown"` em toda chamada Atlassian.
3. **Nunca** ler arquivos de módulo além do `AGENT.md` identificado, a menos que a issue mencione explicitamente um arquivo.
4. **Nunca** buscar o épico pai ou issues filhas automaticamente.
5. **Nunca** chamar Confluence a menos que a descrição da issue contenha uma URL `confluence.atlassian.net`.
6. **Máximo de 3 tool calls** para produzir o plano:
   - `getJiraIssue` (obrigatório)
   - Leitura de `src/modules/<module>/AGENT.md` (se o módulo não for claro pelos labels)
   - Leitura de `AGENTS.md` (somente se o módulo ainda não for identificado)
