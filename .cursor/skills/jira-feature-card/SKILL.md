---
name: jira-feature-card
description: Creates Jira feature-implementation cards via Atlassian MCP using the team markdown template (Contexto, Objetivo, Fora de escopo, Requisitos, Acceptance criteria, Dependências). Use when the user asks to create a Jira card, issue, ticket, Tarefa, História, or backlog item with MCP Atlassian, or to put work on Grau System Board / KAN.
---

# Jira feature card (impl)

Always use Atlassian MCP (`plugin-atlassian-atlassian`). Authenticate with `mcp_auth` if the server is missing or returns auth errors. Discover tool schemas with `GetMcpTools` before each call.

Do **not** invent a parallel card layout. The description body of every **feature impl** card is the template below.

## Defaults (this product)

| Field | Value |
|-------|--------|
| Site | `paulodevmais.atlassian.net` |
| Project | Grau System Board (`KAN`) unless the user names another |
| Column | **Prioritized** unless the user names another |
| Assignee | Current Atlassian user unless the user names another |

**Issue type**

- **Tarefa** — work técnico (seams, HTTP, persistência, wiring, specs de implementação)
- **História** — valor para operador/usuário (ex.: ADMIN Remove colaborador INACTIVE)
- **Epic** — só se o usuário pedir a feature inteira como guarda-chuva; slices viram cards filhos (`parent`)

## Description template (mandatory)

Pass `contentFormat: "markdown"`. Fill every section; omit **Dependências** only when there are none.

```markdown
## Contexto
[Por que agora. Links: PRD, design, spec, ADRs, AGENT.md.]

## Objetivo
[O que este card entrega, em 1–3 frases.]

## Fora de escopo
- [não-meta 1]
- [não-meta 2]

## Requisitos
- [contrato / regra / seam]

## Acceptance criteria
- [ ] [comportamento observável 1]
- [ ] [comportamento observável 2]

## Dependências
[Opcional. Só se outro card/hexagon bloquear.]
```

## Workflow

1. `getAccessibleAtlassianResources` → `cloudId`
2. `getVisibleJiraProjects` if the project is not `KAN`
3. `createJiraIssue` with `issueTypeName`, `summary`, markdown `description`, `assignee_account_id` when known
4. Confirm `fields.status.name` is the requested column (e.g. Prioritized). If not, `getTransitionsForJiraIssue` → `transitionJiraIssue`
5. Return the browse URL (`https://paulodevmais.atlassian.net/browse/KAN-n`)

## Summary

Action-oriented, specific. Prefix the feature when useful:

- `[Employee Lifecycle] Slice 0 — adaptRoute carimba actorId + helpers 403/409`

Do not put `actorId` or secrets in the summary. Do not use **Próximo** (playbook chatter); use **Dependências**.

## Labels (optional)

Use kebab-case when they help the board: feature slug + slice if any (`employee-lifecycle`, `slice-0`).
