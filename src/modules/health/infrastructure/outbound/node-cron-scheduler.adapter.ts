import { schedule, validate, type ScheduledTask } from 'node-cron';
import {
  ScheduleCronPort,
  ScheduledJobPort,
} from '@modules/health/application/ports/outbound/schedule-cron.port';

class NodeCronScheduledJob implements ScheduledJobPort {
  constructor(private readonly task: ScheduledTask) {}

  stop(): void {
    void this.task.stop();
  }
}

export class NodeCronSchedulerAdapter implements ScheduleCronPort {
  schedule(
    expression: string,
    handler: () => void | Promise<void>,
  ): ScheduledJobPort {
    if (!validate(expression)) {
      throw new Error(`Invalid cron expression: ${expression}`);
    }

    const task = schedule(expression, () => {
      void Promise.resolve(handler()).catch((error: unknown) => {
        console.error('[health] scheduled job handler failed', error);
      });
    });

    return new NodeCronScheduledJob(task);
  }
}
