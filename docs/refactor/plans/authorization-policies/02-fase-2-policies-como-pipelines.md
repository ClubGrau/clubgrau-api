# Fase 2 — Policies como pipelines

> Parent: [`README.md`](./README.md). Anterior: [`01-fase-1-contrato-authorization-rule.md`](./01-fase-1-contrato-authorization-rule.md).
> **Gatilho:** existir **3+ policies** de autorização no módulo, ou a matriz `role × intent × status` ficar difícil de ler, ou necessidade de **auditoria** ("qual regra negou?"). **Risco:** médio.

## Objetivo

Consolidar todas as policies como **pipelines finos** sobre listas de regras atômicas co-localizadas (`*.rule.ts` + `*.rule.spec.ts`), mapeando 1:1 os `describe('Rule N')` que já existem nos specs. A policy deixa de ser "um método com muitos `if`" e passa a ser "lista ordenada de regras".

## Pipeline sync + async

[`EmployeeLifecyclePolicy`](../../../../src/modules/employees/domain/services/employee-lifecycle.policy.ts) mistura regras sync com a regra async de last-admin. O pipeline trata as duas fases explicitamente:

```typescript
// conceitual
export class EmployeeLifecyclePolicy {
  constructor(
    private readonly countPort: CountActiveAdminsPort & CountNonRemovedAdminsPort,
  ) {}

  private readonly syncRules: AuthorizationRule<LifecycleContext>[] = [
    new ActorMustBeActiveRule(),
    new SelfRemoveForbiddenRule(),
    new TargetIsNotRemovedRule(),       // compartilhada com main-data
    new LifecycleRoleMatrixRule(),      // early-return de MANAGER vive aqui dentro
  ];

  async assertCan(context: LifecycleContext): Promise<void> {
    for (const rule of this.syncRules) rule.assert(context);

    // regras 5 e 6 sao do contexto ADMIN
    await new LastAdminProtectedRule(this.countPort).assert(context);
    new RemoveRequiresInactiveTargetRule().assert(context);
  }
}
```

```typescript
// conceitual — regra async isolada, com o port injetado
export class LastAdminProtectedRule implements AsyncAuthorizationRule<LifecycleContext> {
  constructor(private readonly countPort: CountActiveAdminsPort & CountNonRemovedAdminsPort) {}

  async assert({ target, intent }: LifecycleContext): Promise<void> {
    if (target.role !== EmployeeModel.Role.ADMIN) return;

    if (
      (intent === 'DEACTIVATE' || intent === 'VACATION') &&
      target.status === EmployeeModel.Status.ACTIVE
    ) {
      if ((await this.countPort.countActiveAdmins()) === 1) {
        throw new LastAdminProtectedError();
      }
    }

    if (intent === 'REMOVE') {
      if ((await this.countPort.countNonRemovedAdmins()) === 1) {
        throw new LastAdminProtectedError();
      }
    }
  }
}
```

## Composição por papel (alternativa ao early-return espalhado)

Para tornar explícito que as regras 5 e 6 só valem para ADMIN, sem `return` no meio da policy:

```typescript
// conceitual
export class WhenActorIsAdminRule implements AuthorizationRule<LifecycleContext> {
  constructor(private readonly adminOnly: AuthorizationRule<LifecycleContext>[]) {}

  assert(context: LifecycleContext): void {
    if (context.actor.role !== EmployeeModel.Role.ADMIN) return;
    for (const rule of this.adminOnly) rule.assert(context);
  }
}
```

## Auditoria (opcional, só se houver requisito)

Se surgir a necessidade de saber **qual regra negou** (logging/auditoria), adicionar um identificador de regra e traduzir no ponto de `throw` — sem transformar tudo em boolean:

```typescript
// conceitual
export interface NamedAuthorizationRule<TContext> extends AuthorizationRule<TContext> {
  readonly id: string; // ex.: 'actor.login-capable'
}
```

## Layout de arquivos (proposto)

```text
domain/authorization/
  authorization-rule.ts            # interfaces (Fase 1)
  contexts.ts                      # MainDataContext, LifecycleContext
  rules/
    actor-is-login-capable.rule.ts
    actor-is-login-capable.rule.spec.ts
    actor-must-be-active.rule.ts
    actor-must-be-active.rule.spec.ts
    target-is-not-removed.rule.ts
    target-is-not-removed.rule.spec.ts
    main-data-role-matrix.rule.ts
    main-data-role-matrix.rule.spec.ts
    lifecycle-role-matrix.rule.ts
    lifecycle-role-matrix.rule.spec.ts
    self-remove-forbidden.rule.ts
    self-remove-forbidden.rule.spec.ts
    last-admin-protected.rule.ts
    last-admin-protected.rule.spec.ts
    remove-requires-inactive-target.rule.ts
    remove-requires-inactive-target.rule.spec.ts
```

## Anti-patterns a evitar

| Evitar | Motivo |
|--------|--------|
| `AndRule`/`OrRule` genéricos com árvore de composição | Over-engineering para o tamanho do domínio |
| Boolean puro + camada `Result` em toda regra | Boilerplate; erro de domínio já é a API certa |
| "Rule Engine" configurável por dados | YAGNI |
| Mover regras para `@shared` | São bounded context de employees |

## Checklist de done

- [ ] `EmployeeMainDataPolicy` e `EmployeeLifecyclePolicy` são pipelines finos.
- [ ] Cada `describe('Rule N')` atual tem uma rule + spec correspondente.
- [ ] Pipeline sync/async funciona com last-admin injetando o port.
- [ ] Contrato `assertCan` inalterado para use cases e `employees.module.ts`.
- [ ] Ordem de erros preservada; specs de policy e use case passam sem regressão.
- [ ] Nenhuma dependência de framework adicionada.
