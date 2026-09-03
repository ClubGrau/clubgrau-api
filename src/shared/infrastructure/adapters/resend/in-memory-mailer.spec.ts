import { InMemoryMailer } from './in-memory-mailer';

const makeSut = (): InMemoryMailer => new InMemoryMailer();

const makeInput = () => ({
  to: 'user@mail.test',
  template: 'password-reset' as const,
  vars: { resetUrl: 'https://app.example.test/reset?t=abc123' },
});

describe('InMemoryMailer', () => {
  it('should record send calls', async () => {
    const sut = makeSut();
    const input = makeInput();

    await sut.send(input);

    expect(sut.calls).toHaveLength(1);
    expect(sut.calls[0]).toEqual(input);
  });

  it('should reject when configured to fail', async () => {
    const sut = makeSut();
    const input = makeInput();

    sut.failNextSend();

    await expect(sut.send(input)).rejects.toThrow('Mailer failed');
    expect(sut.calls).toHaveLength(0);

    await sut.send(input);

    expect(sut.calls).toHaveLength(1);
    expect(sut.calls[0]).toEqual(input);
  });
});
