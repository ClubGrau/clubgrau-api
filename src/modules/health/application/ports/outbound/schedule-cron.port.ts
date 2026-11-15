export interface ScheduledJobPort {
  stop(): void;
}

export interface ScheduleCronPort {
  schedule(
    expression: string,
    handler: () => void | Promise<void>,
  ): ScheduledJobPort;
}
