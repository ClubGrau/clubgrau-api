// OBS - This is a mock of the MailerPort interface for testing purposes. should be replaced with a real implementation in production.
import {
  MailerPort,
  MailTemplate,
} from '@shared/application/ports/mailer.port';

export type InMemoryMailerCall = {
  to: string;
  template: MailTemplate;
  vars: Record<string, string>;
};

export class InMemoryMailer implements MailerPort {
  readonly calls: InMemoryMailerCall[] = [];
  private failNext = false;

  failNextSend(): void {
    this.failNext = true;
  }

  async send(input: {
    to: string;
    template: MailTemplate;
    vars: Record<string, string>;
  }): Promise<void> {
    if (this.failNext) {
      this.failNext = false;
      throw new Error('Mailer failed');
    }

    this.calls.push({
      to: input.to,
      template: input.template,
      vars: { ...input.vars },
    });
  }
}
