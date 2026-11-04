import nodemailer from "nodemailer";

export type MaxEmailLoginVerificationEmail = {
  readonly to: string;
  readonly code: string;
  readonly messageId: string;
};

export type MaxEmailLoginEmailSender = (
  message: MaxEmailLoginVerificationEmail,
) => Promise<void>;

type MailEnvironment = {
  readonly MAIL_RU_EMAIL?: string;
  readonly MAIL_RU_APP_PASSWORD?: string;
};

const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character]!;
  });

export const createMaxEmailLoginEmailSender =
  (environment: MailEnvironment = process.env): MaxEmailLoginEmailSender =>
  async ({ to, code, messageId }) => {
    const email = environment.MAIL_RU_EMAIL?.trim();
    const password = environment.MAIL_RU_APP_PASSWORD;
    if (!email || !password) {
      throw new Error("MAX email login verification mail is not configured.");
    }

    const transporter = nodemailer.createTransport({
      host: "smtp.mail.ru",
      port: 465,
      secure: true,
      auth: { user: email, pass: password },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    });
    const safeCode = escapeHtml(code);

    try {
      await transporter.sendMail({
        from: email,
        to,
        subject: "Подтверждение почты для входа в UTP Servise",
        messageId,
        text: `Код для подтверждения почты: ${code}\n\nВведите его в профиле, затем задайте пароль для входа по электронной почте. Код действует 10 минут. Если вы не запрашивали код, проигнорируйте это письмо.`,
        html: `<p>Код для подтверждения почты: <strong>${safeCode}</strong></p><p>Введите его в профиле и задайте пароль для входа по электронной почте.</p><p>Код действует 10 минут. Если вы не запрашивали код, проигнорируйте это письмо.</p>`,
      });
    } finally {
      transporter.close();
    }
  };
