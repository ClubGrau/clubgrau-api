import { PingUrlPort } from '../ports/outbound/ping-url.port';
import {
  ScheduleCronPort,
  ScheduledJobPort,
} from '../ports/outbound/schedule-cron.port';
import {
  LivenessKeepAliveConfig,
  StartLivenessKeepAliveUsecase,
} from './start-liveness-keep-alive.usecase';

const LIVENESS_URL = 'https://api.example.com/health/liveness';
const CRON = '*/14 * * * *';

const makeConfig = (
  overrides: Partial<LivenessKeepAliveConfig> = {},
): LivenessKeepAliveConfig => ({
  enabled: true,
  livenessUrl: LIVENESS_URL,
  cronExpression: CRON,
  ...overrides,
});

const makeStubs = () => {
  const scheduledJobStub: ScheduledJobPort = {
    stop: jest.fn(),
  };
  const scheduleCronStub: ScheduleCronPort = {
    schedule: jest.fn().mockReturnValue(scheduledJobStub),
  };
  const pingUrlStub: PingUrlPort = {
    ping: jest.fn().mockResolvedValue(undefined),
  };

  return { scheduleCronStub, pingUrlStub, scheduledJobStub };
};

const makeSut = (config: LivenessKeepAliveConfig = makeConfig()) => {
  const stubs = makeStubs();
  const sut = new StartLivenessKeepAliveUsecase(
    stubs.scheduleCronStub,
    stubs.pingUrlStub,
    config,
  );
  return { sut, ...stubs };
};

describe('StartLivenessKeepAliveUsecase', () => {
  it('should schedule a cron job that pings the liveness url when enabled', async () => {
    const { sut, scheduleCronStub, pingUrlStub } = makeSut();

    sut.start();

    expect(scheduleCronStub.schedule).toHaveBeenCalledTimes(1);
    expect(scheduleCronStub.schedule).toHaveBeenCalledWith(
      CRON,
      expect.any(Function),
    );

    const handler = (scheduleCronStub.schedule as jest.Mock).mock
      .calls[0][1] as () => Promise<void>;
    await handler();

    expect(pingUrlStub.ping).toHaveBeenCalledWith(LIVENESS_URL);
  });

  it('should not schedule when keep-alive is disabled', () => {
    const { sut, scheduleCronStub } = makeSut(makeConfig({ enabled: false }));

    sut.start();

    expect(scheduleCronStub.schedule).not.toHaveBeenCalled();
  });

  it('should not schedule when liveness url is empty', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const { sut, scheduleCronStub } = makeSut(
      makeConfig({ livenessUrl: '   ' }),
    );

    sut.start();

    expect(scheduleCronStub.schedule).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('should be idempotent on start', () => {
    const { sut, scheduleCronStub } = makeSut();

    sut.start();
    sut.start();

    expect(scheduleCronStub.schedule).toHaveBeenCalledTimes(1);
  });

  it('should stop the scheduled job', () => {
    const { sut, scheduledJobStub } = makeSut();

    sut.start();
    sut.stop();

    expect(scheduledJobStub.stop).toHaveBeenCalledTimes(1);
  });

  it('should swallow ping errors so the cron keeps running', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { sut, scheduleCronStub, pingUrlStub } = makeSut();
    (pingUrlStub.ping as jest.Mock).mockRejectedValue(new Error('network'));

    sut.start();
    const handler = (scheduleCronStub.schedule as jest.Mock).mock
      .calls[0][1] as () => Promise<void>;

    await expect(handler()).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
