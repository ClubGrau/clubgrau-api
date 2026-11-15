import { StartLivenessKeepAlivePort } from '../ports/inbound/start-liveness-keep-alive.port';
import { PingUrlPort } from '../ports/outbound/ping-url.port';
import {
  ScheduleCronPort,
  ScheduledJobPort,
} from '../ports/outbound/schedule-cron.port';

export type LivenessKeepAliveConfig = {
  enabled: boolean;
  livenessUrl: string;
  cronExpression: string;
};

export class StartLivenessKeepAliveUsecase implements StartLivenessKeepAlivePort {
  private job: ScheduledJobPort | null = null;

  constructor(
    private readonly scheduleCron: ScheduleCronPort,
    private readonly pingUrl: PingUrlPort,
    private readonly config: LivenessKeepAliveConfig,
  ) {}

  start(): void {
    if (!this.config.enabled) {
      return;
    }

    if (!this.config.livenessUrl.trim()) {
      console.warn(
        '[health] keep-alive enabled but APP_PUBLIC_URL is empty; scheduler not started',
      );
      return;
    }

    if (this.job) {
      return;
    }

    const { livenessUrl, cronExpression } = this.config;

    this.job = this.scheduleCron.schedule(cronExpression, async () => {
      try {
        await this.pingUrl.ping(livenessUrl);
      } catch (error) {
        console.error('[health] keep-alive ping failed', error);
      }
    });
  }

  stop(): void {
    this.job?.stop();
    this.job = null;
  }
}
