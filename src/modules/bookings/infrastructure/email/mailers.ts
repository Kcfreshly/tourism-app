import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { EmailMessage, Mailer } from "../../application/ports/mailer";

// Resend's HTTP API (https://resend.com/docs/api-reference/emails/send-email),
// called directly so there's no SDK dependency.
export class ResendMailer implements Mailer {
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
  ) {}

  async send(message: EmailMessage) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: this.from, ...message }),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok)
      throw new Error(
        `Resend refused the email (${response.status}): ${(await response.text()).slice(0, 300)}`,
      );
  }
}

// Local development: each email is written to .local/outbox as an .html file
// to open in a browser, plus a .txt copy. Nothing leaves the machine.
export class OutboxMailer implements Mailer {
  constructor(private readonly folder = join(".local", "outbox")) {}

  async send(message: EmailMessage) {
    await mkdir(this.folder, { recursive: true });
    const name = `${new Date().toISOString().replace(/[:.]/g, "-")}-${message.subject.replace(/[^A-Za-z0-9-]+/g, "-").slice(0, 60)}`;
    const head = `To: ${message.to}\nSubject: ${message.subject}\n\n`;
    await writeFile(join(this.folder, `${name}.txt`), head + message.text);
    await writeFile(join(this.folder, `${name}.html`), message.html);
    console.info(
      JSON.stringify({
        event: "EMAIL_WRITTEN",
        file: join(this.folder, `${name}.html`),
      }),
    );
  }
}

export class DisabledMailer implements Mailer {
  async send(message: EmailMessage) {
    console.info(
      JSON.stringify({ event: "EMAIL_OFF", subject: message.subject }),
    );
  }
}
