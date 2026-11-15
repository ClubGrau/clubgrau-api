# Health Module — Agent Guide

> Living **contract** of the health hexagon (liveness probe + keep-alive scheduler).
>
> Global rules: [`AGENTS.md`](../../../AGENTS.md).

## Purpose

Expose a public liveness endpoint and optionally schedule an HTTP self-ping every 14 minutes so free-tier hosts do not hibernate after idle timeout.

## Delivered

| Capability | Status | Entry point |
|------------|--------|-------------|
| Liveness probe (query) | Done | `GET /health/liveness` |
| Keep-alive cron (command) | Done | `StartLivenessKeepAlivePort.start()` from `main.ts` after listen |
| Module HTTP ownership | Done | `infrastructure/inbound/http/health.routes.ts` |
| Composition root wiring | Done | `health.module.ts` + `app.ts` / `main.ts` |

### CQRS in this module

| Side | Location | Example |
|------|----------|---------|
| Query (read) | `application/queries/` | `CheckLivenessQuery` |
| Command (write / side-effect) | `application/usecases/` | `StartLivenessKeepAliveUsecase` |

No domain layer yet — liveness is a process pulse with no business invariants.

## HTTP

| Method | Path | Auth | Response |
|--------|------|------|----------|
| `GET` | `/health/liveness` | none | `200 { data: { status: "ok" } }` |

Mounted at the app root (not under `/api`).

## Keep-alive

| Env | Role |
|-----|------|
| `KEEP_ALIVE_ENABLED=true` | Enables the scheduler |
| `APP_PUBLIC_URL` | Public base URL used to build `{APP_PUBLIC_URL}/health/liveness` |

- Cron expression: `*/14 * * * *` (`LIVENESS_KEEP_ALIVE_CRON`)
- Outbound ports: `ScheduleCronPort` ← `NodeCronSchedulerAdapter`; `PingUrlPort` ← `FetchPingUrlAdapter`
- Ping failures are logged; the cron continues
- `stop()` is called on process shutdown

## Directory map

```text
health/
├── AGENT.md
├── health.module.ts
├── application/
│   ├── dtos/liveness.dto.ts
│   ├── ports/inbound/check-liveness.port.ts
│   ├── ports/inbound/start-liveness-keep-alive.port.ts
│   ├── ports/outbound/ping-url.port.ts
│   ├── ports/outbound/schedule-cron.port.ts
│   ├── queries/check-liveness.query.ts
│   └── usecases/start-liveness-keep-alive.usecase.ts
├── presentation/controllers/check-liveness.controller.ts
└── infrastructure/
    ├── inbound/http/health.routes.ts
    └── outbound/
        ├── fetch-ping-url.adapter.ts
        └── node-cron-scheduler.adapter.ts
```

## Open decisions

- Readiness (`/health/readiness` checking Mongo) is out of scope for this slice
- External cron (UptimeRobot / cron-job.org) can still hit `GET /health/liveness` without enabling the in-process scheduler
