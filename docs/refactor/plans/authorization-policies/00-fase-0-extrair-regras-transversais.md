# Fase 0 — Extrair regras transversais

> Parent: [`README.md`](./README.md). Próximo: [`01-fase-1-contrato-authorization-rule.md`](./01-fase-1-contrato-authorization-rule.md).
> **Gatilho:** agora (opcional). **Risco:** muito baixo.

## Objetivo

Limpar a **duplicação de regras que já se repetem** entre as duas policies, **sem** introduzir contrato/interface e **sem** mudar o comportamento observável. Não é Specification ainda — são apenas funções puras de domínio.

## Motivação

A regra "Target não REMOVED" existe **idêntica** nas duas policies, lançando o mesmo `EmployeeAlreadyRemovedError`:

```20:22:src/modules/employees/domain/services/employee-main-data.policy.ts
    if (target.status === EmployeeModel.Status.REMOVED) {
      throw new EmployeeAlreadyRemovedError();
    }
```

```39:42:src/modules/employees/domain/services/employee-lifecycle.policy.ts
    // Rule 3: Target already removed
    if (target.status === EmployeeModel.Status.REMOVED) {
      throw new EmployeeAlreadyRemovedError();
    }
```

## Escopo

| Item | Nesta fase? |
|------|-------------|
| Extrair `assertTargetNotRemoved(target)` | Sim |
| Helper opcional "actor EMPLOYEE → forbidden" com factory de erro | Opcional |
| Interface `AuthorizationRule` / pasta `rules/` formal | **Não** — Fase 1 |
| Mudar assinatura de `assertCan` | **Não** |
| Alterar ordem/semântica de erros | **Não** |

## Proposta (conceitual — não existe no repo)

### 1. `assertTargetNotRemoved`

Local sugerido: `src/modules/employees/domain/authorization/rules/target-not-removed.ts`.

```typescript
// conceitual
export function assertTargetNotRemoved(target: Employee): void {
  if (target.status === EmployeeModel.Status.REMOVED) {
    throw new EmployeeAlreadyRemovedError();
  }
}
```

Uso nas policies (substitui o bloco inline, mantendo a mesma posição):

```typescript
// EmployeeMainDataPolicy.assertCan
assertActorLoginCapable(actor); // continua inline ou vira funcao tambem, opcional
assertTargetNotRemoved(target);
// ...matriz de role
```

### 2. Helper opcional: actor EMPLOYEE → forbidden

O erro **difere** entre as policies (`EmployeeMainDataForbiddenError` vs `EmployeeLifecycleForbiddenError`), então o helper recebe uma **factory de erro** para não acoplar as duas:

```typescript
// conceitual
export function assertActorIsNotEmployee(
  actor: Employee,
  makeError: () => DomainError,
): void {
  if (actor.role === EmployeeModel.Role.EMPLOYEE) {
    throw makeError();
  }
}

// uso na main-data:
assertActorIsNotEmployee(actor, () => new EmployeeMainDataForbiddenError());
// uso na lifecycle:
assertActorIsNotEmployee(actor, () => new EmployeeLifecycleForbiddenError());
```

> Não unificar a checagem de status do actor (`ACTIVE`\|`VACATION` na main-data vs somente `ACTIVE` na lifecycle) — são regras de negócio distintas.

## Checklist de done

- [ ] `assertTargetNotRemoved` extraído e usado nas duas policies **na mesma posição** do fluxo.
- [ ] (Opcional) `assertActorIsNotEmployee` com factory de erro.
- [ ] Contrato `assertCan` inalterado (assinatura e retorno).
- [ ] Nenhuma dependência nova.
- [ ] Suites existentes passam sem edição:
  - `employee-main-data.policy.spec.ts`
  - `employee-lifecycle.policy.spec.ts`
  - `remove-employee.usecase.spec.ts` / `update-employee-status.usecase.spec.ts`

## Como validar

- Rodar os specs das policies e dos use cases que as consomem.
- Diff de comportamento = zero: a ordem de avaliação e as classes de erro permanecem idênticas.
