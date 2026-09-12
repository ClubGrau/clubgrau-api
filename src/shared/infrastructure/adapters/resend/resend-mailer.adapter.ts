import envs from '@configs/envs';
import { MailerInput, MailerPort } from '@shared/application/ports/mailer.port';
import { Resend } from 'resend';

export class ResendMailerAdapter implements MailerPort {
  async send(input: MailerInput): Promise<void> {
    this.assertKnownTemplate(input.template);

    const apiKey = this.getApiKey();
    const from = this.getFrom();
    const resetUrl = input.vars.resetUrl ?? '';

    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from,
      to: input.to,
      subject: 'password-reset',
      text: resetUrl,
    });

    if (error) {
      throw new Error(error.message);
    }
  }

  private assertKnownTemplate(template: string): void {
    if (template !== 'password-reset') {
      throw new Error(`Unknown mail template: ${template}`);
    }
  }

  private getApiKey(): string {
    const apiKey = envs.resendApiKey;
    if (!apiKey) {
      throw new Error('RESEND_API_KEY is not set in environment variables');
    }
    return apiKey;
  }

  private getFrom(): string {
    const from = envs.resendFrom;
    if (!from) {
      throw new Error('RESEND_FROM is not set in environment variables');
    }
    return from;
  }
}
