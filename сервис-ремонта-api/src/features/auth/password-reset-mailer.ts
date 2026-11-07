import nodemailer from "nodemailer";

export type PasswordResetEmail = {
  readonly to: string;
  readonly resetCode: string;
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
  async ({ to, resetCode, resetUrl, messageId }) => {
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
    const safeCode = escapeHtml(resetCode);
    const message = {
      from: email,
      to,
      subject: "Код для восстановления пароля ЕНОТ СЕРВИС",
      messageId,
      text: `Код для восстановления пароля: ${resetCode}\n\nОткройте страницу восстановления и введите код вместе с новым паролем: ${resetUrl}\n\nКод действует 30 минут и может быть использован один раз. Если вы не запрашивали восстановление, проигнорируйте это письмо.`,
      html: `<p>Мы получили запрос на восстановление пароля ЕНОТ СЕРВИС.</p><p>Код для восстановления: <strong>${safeCode}</strong></p><p><a href="${safeUrl}">Открыть страницу восстановления</a> и ввести код вместе с новым паролем.</p><p>Код действует 30 минут и может быть использован один раз. Если вы не запрашивали восстановление, проигнорируйте это письмо.</p>`,
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
