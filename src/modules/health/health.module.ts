import { Router } from 'express';
import { CheckLivenessPort } from '@modules/health/application/ports/inbound/check-liveness.port';
import { StartLivenessKeepAlivePort } from '@modules/health/application/ports/inbound/start-liveness-keep-alive.port';
import { CheckLivenessQuery } from '@modules/health/application/queries/check-liveness.query';
import { StartLivenessKeepAliveUsecase } from '@modules/health/application/usecases/start-liveness-keep-alive.usecase';
import { makeHealthRoutes } from '@modules/health/infrastructure/inbound/http/health.routes';
import { FetchPingUrlAdapter } from '@modules/health/infrastructure/outbound/fetch-ping-url.adapter';
import { NodeCronSchedulerAdapter } from '@modules/health/infrastructure/outbound/node-cron-scheduler.adapter';
import { CheckLivenessController } from '@modules/health/presentation/controllers/check-liveness.controller';

/** Every 14 minutes — keeps free-tier hosts from hibernating after ~15 min idle. */
export const LIVENESS_KEEP_ALIVE_CRON = '*/14 * * * *';

export type HealthModule = {
  checkLivenessController: CheckLivenessController;
  checkLiveness: CheckLivenessPort;
  keepAlive: StartLivenessKeepAlivePort;
  router: Router;
};

export type HealthModuleDeps = {
  keepAliveEnabled: boolean;
  appPublicUrl?: string;
};

function buildLivenessUrl(appPublicUrl: string | undefined): string {
  const base = (appPublicUrl ?? '').replace(/\/+$/, '');
  if (!base) {
    return '';
  }
  return `${base}/health/liveness`;
}

export function makeHealthModule({
  keepAliveEnabled,
  appPublicUrl,
}: HealthModuleDeps): HealthModule {
  const checkLiveness = new CheckLivenessQuery();
  const checkLivenessController = new CheckLivenessController(checkLiveness);

  const keepAlive = new StartLivenessKeepAliveUsecase(
    new NodeCronSchedulerAdapter(),
    new FetchPingUrlAdapter(),
    {
      enabled: keepAliveEnabled,
      livenessUrl: buildLivenessUrl(appPublicUrl),
      cronExpression: LIVENESS_KEEP_ALIVE_CRON,
    },
  );

  const router = makeHealthRoutes({ checkLivenessController });

  return {
    checkLivenessController,
    checkLiveness,
    keepAlive,
    router,
  };
}
