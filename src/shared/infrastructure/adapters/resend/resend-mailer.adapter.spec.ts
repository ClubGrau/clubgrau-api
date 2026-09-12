import { MailTemplate } from '@shared/application/ports/mailer.port';
import { Resend } from 'resend';
import { ResendMailerAdapter } from './resend-mailer.adapter';

const sendMock = jest.fn();

jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: {
      send: (...args: unknown[]) => sendMock(...args),
    },
  })),
}));

jest.mock('@configs/envs', () => ({
  __esModule: true,
  default: {
    resendApiKey: 're_test_key',
    resendFrom: 'Grau <noreply@mail.test>',
  },
}));

type EnvsMock = {
  resendApiKey: string | undefined;
  resendFrom: string | undefined;
};

const envs = jest.requireMock('@configs/envs').default as EnvsMock;

const makeSut = (): ResendMailerAdapter => new ResendMailerAdapter();

const makePasswordResetInput = (
  overrides: {
    to?: string;
    template?: MailTemplate;
    vars?: Record<string, string>;
  } = {},
) => ({
  to: 'user@mail.test',
  template: 'password-reset' as const,
  vars: { resetUrl: 'https://app.example.test/reset?t=abc123' },
  ...overrides,
});

const getSentPayload = (): Record<string, unknown> => {
  const payload = sendMock.mock.calls[0]?.[0];
  return (payload ?? {}) as Record<string, unknown>;
};

const getSentBody = (): string => {
  const payload = getSentPayload();
  return `${String(payload['text'] ?? '')}${String(payload['html'] ?? '')}`;
};

describe('ResendMailerAdapter', () => {
  beforeEach(() => {
    sendMock.mockReset();
    sendMock.mockResolvedValue({ data: { id: 'any_id' }, error: null });
    envs.resendApiKey = 're_test_key';
    envs.resendFrom = 'Grau <noreply@mail.test>';
  });

  it('should be defined', () => {
    const sut = makeSut();
    expect(sut).toBeDefined();
    expect(sut).toBeInstanceOf(ResendMailerAdapter);
  });

  it('should send password-reset with resetUrl in the body', async () => {
    const sut = makeSut();
    const input = makePasswordResetInput();

    await sut.send(input);

    expect(Resend).toHaveBeenCalled();
    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(getSentBody()).toContain(input.vars.resetUrl);
  });

  it('should use RESEND_FROM as from', async () => {
    const sut = makeSut();

    await sut.send(makePasswordResetInput());

    expect(getSentPayload()['from']).toBe('Grau <noreply@mail.test>');
    expect(getSentPayload()['from']).not.toBe('onboarding@resend.dev');
  });

  it('should not put a password in the message', async () => {
    const sut = makeSut();
    const resetUrl = 'https://app.example.test/reset?t=abc123';

    await sut.send(
      makePasswordResetInput({
        vars: {
          resetUrl,
          password: 'smuggled-password',
          token: 'smuggled-token',
        },
      }),
    );

    const serialized = JSON.stringify(getSentPayload());
    expect(getSentBody()).toContain(resetUrl);
    expect(serialized).not.toContain('smuggled-password');
    expect(serialized).not.toContain('smuggled-token');
  });

  it('should throw on unknown template', async () => {
    const sut = makeSut();

    const promise = sut.send({
      to: 'user@mail.test',
      template: 'welcome' as unknown as MailTemplate,
      vars: { resetUrl: 'https://app.example.test/reset?t=abc123' },
    });

    await expect(promise).rejects.toThrow('Unknown mail template: welcome');
    expect(Resend).not.toHaveBeenCalled();
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('should throw if RESEND_API_KEY is missing', async () => {
    envs.resendApiKey = undefined;
    const sut = makeSut();

    await expect(sut.send(makePasswordResetInput())).rejects.toThrow(
      'RESEND_API_KEY is not set in environment variables',
    );
    expect(Resend).not.toHaveBeenCalled();
  });

  it('should throw if RESEND_FROM is missing', async () => {
    envs.resendFrom = undefined;
    const sut = makeSut();

    await expect(sut.send(makePasswordResetInput())).rejects.toThrow(
      'RESEND_FROM is not set in environment variables',
    );
    expect(Resend).not.toHaveBeenCalled();
  });
});
