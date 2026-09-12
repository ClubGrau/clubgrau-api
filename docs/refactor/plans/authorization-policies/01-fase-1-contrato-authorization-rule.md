# Fase 1 — Contrato `AuthorizationRule`

> Parent: [`README.md`](./README.md). Anterior: [`00-fase-0-extrair-regras-transversais.md`](./00-fase-0-extrair-regras-transversais.md). Próximo: [`02-fase-2-policies-como-pipelines.md`](./02-fase-2-policies-como-pipelines.md).
> **Gatilho:** surgir a **próxima policy** de autorização no módulo (ex.: comissionamento, alteração de role). **Risco:** baixo.

## Objetivo

Formalizar o que na Fase 0 eram funções soltas em um **contrato mínimo e tipado**, criando a pasta `domain/authorization/rules/`. Ainda **não** transformamos as policies em pipelines completos — só padronizamos a forma de uma "regra".

## Decisão de design: `assert` com erro tipado (não boolean)

Specification clássica retorna `boolean` (`isSatisfiedBy`). Aqui **não** usamos boolean puro, porque cada falha precisa lançar **a classe de erro de domínio correta** (`ActorAuthenticationFailedError`, `EmployeeAlreadyRemovedError`, `EmployeeMainDataForbiddenError`, ...). O contrato é uma "authorization rule" que lança ou passa:

```typescript
// conceitual — domain/authorization/authorization-rule.ts
export interface AuthorizationRule<TContext> {
  assert(context: TContext): void;
}

export interface AsyncAuthorizationRule<TContext> {
  assert(context: TContext): Promise<void>;
}
```

`AsyncAuthorizationRule` existe **apenas** para regras que dependem de port — hoje só a proteção de last-admin em [`employee-lifecycle.policy.ts`](../../../../src/modules/employees/domain/services/employee-lifecycle.policy.ts), que usa `CountActiveAdminsPort & CountNonRemovedAdminsPort`. Regras puras permanecem sync.

## Contexts

```typescript
// conceitual
export type MainDataContext = {
  actor: Employee;
  target: Employee;
};

export type LifecycleContext = MainDataContext & {
  intent: LifecycleIntent;
};
```

## Regras extraídas (exemplos)

```typescript
// conceitual — actor-is-login-capable.rule.ts
export class ActorIsLoginCapableRule implements AuthorizationRule<MainDataContext> {
  assert({ actor }: MainDataContext): void {
    const ok =
      actor.status === EmployeeModel.Status.ACTIVE ||
      actor.status === EmployeeModel.Status.VACATION;
    if (!ok) throw new ActorAuthenticationFailedError();
  }
}

// conceitual — target-is-not-removed.rule.ts (compartilhada entre as duas policies)
export class TargetIsNotRemovedRule implements AuthorizationRule<MainDataContext> {
  assert({ target }: MainDataContext): void {
    if (target.status === EmployeeModel.Status.REMOVED) {
      throw new EmployeeAlreadyRemovedError();
    }
  }
}
```

## Regra de composição (nesta fase, ainda leve)

- A policy pode montar um **array ordenado** de rules e iterar, **preservando a ordem** que os specs garantem.
- O **early-return por role** (ex.: MANAGER encerra a avaliação) fica **dentro da própria rule de matriz** — não espalhado pela policy.
- Não introduzir `AndRule`/`OrRule` genéricos ainda; isso é Fase 2 (se necessário).

```typescript
// conceitual — a policy continua sendo a fachada; so muda o "miolo"
export class EmployeeMainDataPolicy {
  private readonly rules: AuthorizationRule<MainDataContext>[] = [
    new ActorIsLoginCapableRule(),
    new TargetIsNotRemovedRule(),
    new MainDataRoleMatrixRule(),
  ];

  assertCan(input: MainDataContext): void {
    for (const rule of this.rules) rule.assert(input);
  }
}
```

## Escopo

| Item | Nesta fase? |
|------|-------------|
| Interface `AuthorizationRule` + `AsyncAuthorizationRule` | Sim |
| Pasta `domain/authorization/rules/` | Sim |
| Migrar **uma** policy (a mais simples: main-data) para o array de rules | Sim |
| Migrar lifecycle + async pipeline | **Não** — Fase 2 |
| `AndRule`/`OrRule`/`WhenRole` composáveis | **Não** — Fase 2 |

## Checklist de done

- [ ] Interfaces criadas em `domain/authorization/`.
- [ ] Regras atômicas com nome de negócio, uma por arquivo.
- [ ] `EmployeeMainDataPolicy.assertCan` inalterado na assinatura; miolo = iteração ordenada.
- [ ] Cada rule com seu `*.rule.spec.ts` isolado.
- [ ] Specs de policy e de use case existentes continuam passando **sem edição**.
- [ ] Ordem de erros preservada (Rule 1 antes de Rule 2...).
