export type MailTemplate = 'password-reset';

export interface MailerInput {
  to: string;
  template: MailTemplate;
  vars: Record<string, string>;
}

export interface MailerPort {
  send(input: MailerInput): Promise<void>;
}
