// Sends one email. Adapters: Resend, a local outbox folder, or off.
export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

export interface Mailer {
  send(message: EmailMessage): Promise<void>;
}
