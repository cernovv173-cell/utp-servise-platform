import nodemailer from "nodemailer";

export type PasswordResetEmail = {
  readonly to: string;
  readonly resetUrl: string;
  readonly messageId: string;
};

export type PasswordResetEmailSender = (
  message: PasswordResetEmail,
) => Promise<void>;

type MailEnvironment = {
  readonly MAIL_RU_EMAIL?: string;
  readonly MAIL_RU_APP_PASSWORD?: string;
};

const retryableCodes = new Set([
  "ECONNECTION",
  "ECONNRESET",
  "ETIMEDOUT",
  "ESOCKET",
  "EAI_AGAIN",
]);

const isTransientSmtpError = (error: unknown): boolean => {
  if (typeof error !== "object" || error === null) return false;
  const smtpError = error as { code?: unknown; responseCode?: unknown };
  return (
    (typeof smtpError.responseCode === "number" &&
      smtpError.responseCode >= 400 &&
      smtpError.responseCode < 500) ||
    (typeof smtpError.code === "string" && retryableCodes.has(smtpError.code))
  );
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

export const createPasswordResetEmailSender =
  (environment: MailEnvironment = process.env): PasswordResetEmailSender =>
  async ({ to, resetUrl, messageId }) => {
    const email = environment.MAIL_RU_EMAIL?.trim();
    const password = environment.MAIL_RU_APP_PASSWORD;
    if (!email || !password) {
      throw new Error("Password reset email is not configured.");
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
    const safeUrl = escapeHtml(resetUrl);
    const message = {
      from: email,
      to,
      subject: "Восстановление пароля UTP Servise",
      messageId,
      text: `Чтобы задать новый пароль, откройте ссылку: ${resetUrl}\n\nСсылка действует 30 минут и может быть использована один раз. Если вы не запрашивали восстановление, проигнорируйте это письмо.`,
      html: `<p>Мы получили запрос на восстановление пароля UTP Servise.</p><p><a href="${safeUrl}">Задать новый пароль</a></p><p>Ссылка действует 30 минут и может быть использована один раз. Если вы не запрашивали восстановление, проигнорируйте это письмо.</p>`,
    };

    try {
      await transporter.sendMail(message);
    } catch (error) {
      if (!isTransientSmtpError(error)) throw error;
      await new Promise((resolve) => setTimeout(resolve, 300));
      await transporter.sendMail(message);
    } finally {
      transporter.close();
    }
  };
