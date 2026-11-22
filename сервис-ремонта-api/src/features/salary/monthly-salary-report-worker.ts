import type { DatabaseClient } from "../../lib/database/database.js";
import { HttpError } from "../../lib/http/http-error.js";
import { createLogger } from "../../lib/logger.js";
import {
  deleteProjectFile,
  downloadProjectFile,
  uploadProjectFile,
} from "../../lib/storage/project-images.js";
import {
  MaxApiError,
  hasMaxBotToken,
  sendMaxFileMessage,
  uploadMaxFile,
} from "../max/max-bot.js";
import {
  MONTHLY_SALARY_REPORT_CONTENT_TYPE,
  buildMonthlySalaryWorkbook,
  loadMonthlySalaryReportData,
} from "./monthly-salary-report-workbook.js";
import {
  getCalendarDateParts,
  getSalaryMonthRangeForCalendarMonth,
} from "./salary-periods.js";

const logger = createLogger();
const REPORT_TIME_ZONE = "Europe/Moscow";
const REPORT_HOUR = 10;
const WORKER_INTERVAL_MILLISECONDS = 60_000;
const MAX_REPORTS_PER_TICK = 3;
const MAX_DELIVERIES_PER_TICK = 10;
const MAX_DELIVERY_ATTEMPTS = 8;
const DELIVERY_LOCK_MILLISECONDS = 90_000;
const CONTENT_TYPE = MONTHLY_SALARY_REPORT_CONTENT_TYPE;

export type SalaryReportMonth = {
  readonly year: number;
  readonly month: number;
};

const monthNumber = ({ year, month }: SalaryReportMonth): number =>
  year * 12 + month - 1;

const monthFromNumber = (value: number): SalaryReportMonth => ({
  year: Math.floor(value / 12),
  month: (value % 12) + 1,
});

const moscowHour = (date: Date): number => {
  const hour = new Intl.DateTimeFormat("en-US", {
    timeZone: REPORT_TIME_ZONE,
    hour: "2-digit",
    hourCycle: "h23",
  })
    .formatToParts(date)
    .find(({ type }) => type === "hour")?.value;
  return Number(hour);
};

const previousMonth = (date: Date): SalaryReportMonth => {
  const current = getCalendarDateParts(date, REPORT_TIME_ZONE);
  return monthFromNumber(current.year * 12 + current.month - 2);
};

export const getDueSalaryReportMonths = (
  now: Date,
  enabledAt: Date,
  limit = MAX_REPORTS_PER_TICK,
): SalaryReportMonth[] => {
  if (
    getCalendarDateParts(now, REPORT_TIME_ZONE).day === 1 &&
    moscowHour(now) < REPORT_HOUR
  ) {
    return [];
  }
  const firstMonth = getCalendarDateParts(enabledAt, REPORT_TIME_ZONE);
  const firstIndex = firstMonth.year * 12 + firstMonth.month - 1;
  const lastIndex = monthNumber(previousMonth(now));
  if (firstIndex > lastIndex || limit < 1) return [];

  const periods: SalaryReportMonth[] = [];
  for (
    let index = firstIndex;
    index <= lastIndex && periods.length < limit;
    index += 1
  ) {
    periods.push(monthFromNumber(index));
  }
  return periods;
};

const getReportEnabledAt = async (
  database: DatabaseClient,
): Promise<Date | null> => {
  const setting = await database.appSetting.findUnique({
    where: { key: "technician_monthly_salary_report" },
    select: { value: true },
  });
  const value = setting?.value;
  if (!value || typeof value !== "object" || !("enabledAt" in value)) {
    return null;
  }
  const enabledAtValue = value.enabledAt;
  if (typeof enabledAtValue !== "string") return null;
  const enabledAt = new Date(enabledAtValue);
  return Number.isNaN(enabledAt.getTime()) ? null : enabledAt;
};

const monthStartDate = (month: SalaryReportMonth): Date =>
  new Date(Date.UTC(month.year, month.month - 1, 1));

const monthEndDate = (month: SalaryReportMonth): Date =>
  new Date(Date.UTC(month.year, month.month, 0));

const periodLabel = (month: SalaryReportMonth): string =>
  new Intl.DateTimeFormat("ru-RU", {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  }).format(monthStartDate(month));

const isUniqueConstraintError = (error: unknown): boolean =>
  Boolean(
    error &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "P2002",
  );

export const generateMonthlySalaryReport = async (
  database: DatabaseClient,
  month: SalaryReportMonth,
  generatedAt = new Date(),
): Promise<{ readonly id: string; readonly created: boolean }> => {
  const periodStart = monthStartDate(month);
  const existing = await database.technicianMonthlySalaryReport.findUnique({
    where: { periodStart },
    select: { id: true },
  });
  if (existing) return { id: existing.id, created: false };

  const range = getSalaryMonthRangeForCalendarMonth(
    month.year,
    month.month,
    REPORT_TIME_ZONE,
  );
  const data = await loadMonthlySalaryReportData(database, range);
  const monthText = `${month.year}-${String(month.month).padStart(2, "0")}`;
  const fileName = `master-work-${monthText}.xlsx`;
  const bytes = await buildMonthlySalaryWorkbook({
    data,
    periodLabel: periodLabel(month),
    generatedAt,
  });
  const fileObjectId = await uploadProjectFile(bytes, CONTENT_TYPE, fileName);

  try {
    const report = await database.$transaction(async (transaction) => {
      const recipients = hasMaxBotToken()
        ? await transaction.user.findMany({
            where: { role: "ADMIN", active: true, maxUserId: { not: null } },
            select: { id: true },
          })
        : [];
      const createdReport =
        await transaction.technicianMonthlySalaryReport.create({
          data: {
            periodStart,
            periodEnd: monthEndDate(month),
            fileObjectId,
            fileName,
            workCount: data.workCount,
            technicianCount: data.technicianCount,
            totalSalaryRub: data.totalSalaryRub,
            generatedAt,
            updatedAt: generatedAt,
          },
          select: { id: true },
        });
      if (recipients.length > 0) {
        await transaction.technicianMonthlySalaryReportDelivery.createMany({
          data: recipients.map(({ id }) => ({
            reportId: createdReport.id,
            recipientUserId: id,
            nextAttemptAt: generatedAt,
            createdAt: generatedAt,
            updatedAt: generatedAt,
          })),
        });
      }
      return createdReport;
    });
    logger.info(
      {
        reportId: report.id,
        period: monthText,
        workCount: data.workCount,
        technicianCount: data.technicianCount,
      },
      "monthly_salary_report_created",
    );
    return { id: report.id, created: true };
  } catch (error) {
    await deleteProjectFile(fileObjectId).catch(() => {
      logger.warn(
        { period: monthText },
        "monthly_salary_report_orphan_cleanup_failed",
      );
    });
    if (isUniqueConstraintError(error)) {
      const concurrentReport =
        await database.technicianMonthlySalaryReport.findUnique({
          where: { periodStart },
          select: { id: true },
        });
      if (concurrentReport) return { id: concurrentReport.id, created: false };
    }
    throw error;
  }
};

type ClaimedDelivery = { readonly id: string; readonly attempt_count: number };

const recoverExpiredDeliveries = async (
  database: DatabaseClient,
  now: Date,
): Promise<void> => {
  await database.technicianMonthlySalaryReportDelivery.updateMany({
    where: { status: "PROCESSING", lockedUntil: { lt: now } },
    data: {
      status: "PENDING",
      lockedUntil: null,
      nextAttemptAt: now,
      lastError: "Delivery attempt was interrupted before sending.",
    },
  });
  await database.technicianMonthlySalaryReportDelivery.updateMany({
    where: { status: "SENDING", lockedUntil: { lt: now } },
    data: {
      status: "UNKNOWN",
      lockedUntil: null,
      lastError: "MAX delivery result could not be confirmed.",
    },
  });
};

const claimPendingDeliveries = async (
  database: DatabaseClient,
): Promise<ClaimedDelivery[]> =>
  database.$transaction(
    (transaction) =>
      transaction.$queryRaw<ClaimedDelivery[]>`
      WITH due AS (
        SELECT "id"
        FROM "technician_monthly_salary_report_deliveries"
        WHERE "status" = 'PENDING'
          AND "next_attempt_at" <= CURRENT_TIMESTAMP
          AND ("locked_until" IS NULL OR "locked_until" < CURRENT_TIMESTAMP)
          AND "attempt_count" < ${MAX_DELIVERY_ATTEMPTS}
        ORDER BY "next_attempt_at" ASC, "created_at" ASC
        FOR UPDATE SKIP LOCKED
        LIMIT ${MAX_DELIVERIES_PER_TICK}
      )
      UPDATE "technician_monthly_salary_report_deliveries" AS delivery
      SET "status" = 'PROCESSING',
          "locked_until" = CURRENT_TIMESTAMP + (${DELIVERY_LOCK_MILLISECONDS} * INTERVAL '1 millisecond'),
          "attempt_count" = delivery."attempt_count" + 1,
          "updated_at" = CURRENT_TIMESTAMP
      FROM due
      WHERE delivery."id" = due."id"
      RETURNING delivery."id", delivery."attempt_count"
    `,
  );

const maxRetryDelayMilliseconds = (attempt: number): number =>
  Math.min(6 * 60 * 60 * 1_000, 10_000 * 2 ** Math.max(0, attempt - 1));

const isKnownMaxRejection = (error: unknown): boolean => {
  if (!(error instanceof MaxApiError)) return false;
  const code = error.apiErrorCode?.toLowerCase().replaceAll("_", ".");
  return (
    error.errorCode === 429 || code?.includes("attachment.not.ready") === true
  );
};

const isAttachmentNotReady = (error: unknown): boolean => {
  if (!(error instanceof MaxApiError)) return false;
  const code = error.apiErrorCode?.toLowerCase().replaceAll("_", ".");
  return code?.includes("attachment.not.ready") === true;
};

const delay = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const sendReportFileToMax = async (
  userId: string,
  text: string,
  token: string,
): Promise<void> => {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    if (attempt > 0) await delay(2_000 * 2 ** (attempt - 1));
    try {
      await sendMaxFileMessage(userId, text, token);
      return;
    } catch (error) {
      if (!isAttachmentNotReady(error) || attempt === 3) throw error;
    }
  }
};

const errorStatusCode = (error: unknown): number | undefined => {
  if (error instanceof MaxApiError) return error.errorCode;
  if (error instanceof HttpError) return error.status;
  return undefined;
};

const processDelivery = async (
  database: DatabaseClient,
  delivery: ClaimedDelivery,
): Promise<void> => {
  const row = await database.technicianMonthlySalaryReportDelivery.findUnique({
    where: { id: delivery.id },
    include: {
      recipient: { select: { role: true, maxUserId: true } },
      report: {
        select: { fileName: true, fileObjectId: true, periodStart: true },
      },
    },
  });
  if (!row || row.status !== "PROCESSING") return;
  if (row.recipient.role !== "ADMIN" || !row.recipient.maxUserId) {
    await database.technicianMonthlySalaryReportDelivery.updateMany({
      where: { id: row.id, status: "PROCESSING" },
      data: {
        status: "SKIPPED",
        lockedUntil: null,
        lastError: "MAX is not connected to an administrator account.",
      },
    });
    return;
  }

  let sendStarted = false;
  try {
    const file = await downloadProjectFile(row.report.fileObjectId);
    if (file.contentType !== CONTENT_TYPE) {
      throw new HttpError(
        502,
        "MONTHLY_SALARY_REPORT_INVALID_FILE",
        "Stored report does not have an Excel workbook content type.",
      );
    }
    const token = await uploadMaxFile({
      bytes: file.bytes,
      fileName: row.report.fileName,
      contentType: CONTENT_TYPE,
    });
    const sending =
      await database.technicianMonthlySalaryReportDelivery.updateMany({
        where: { id: row.id, status: "PROCESSING" },
        data: {
          status: "SENDING",
          lockedUntil: new Date(Date.now() + DELIVERY_LOCK_MILLISECONDS),
          lastError: null,
        },
      });
    if (sending.count !== 1) return;

    sendStarted = true;
    await delay(3_000);
    await sendReportFileToMax(
      row.recipient.maxUserId,
      `Ежемесячный отчёт по начислениям мастеров за ${periodLabel(
        getCalendarDateParts(row.report.periodStart, "UTC"),
      )}. Копия сохранена в архиве отчётов админ-панели.`,
      token,
    );
    await database.technicianMonthlySalaryReportDelivery.updateMany({
      where: { id: row.id, status: "SENDING" },
      data: {
        status: "SENT",
        sentAt: new Date(),
        lockedUntil: null,
        lastError: null,
      },
    });
  } catch (error) {
    const knownRejection = isKnownMaxRejection(error);
    const statusCode = errorStatusCode(error);
    const permanentClientError =
      statusCode !== undefined &&
      statusCode >= 400 &&
      statusCode < 500 &&
      statusCode !== 429 &&
      !knownRejection;
    const unknownDelivery =
      sendStarted && !knownRejection && !permanentClientError;
    const terminalFailure =
      permanentClientError || delivery.attempt_count >= MAX_DELIVERY_ATTEMPTS;
    const nextStatus = unknownDelivery
      ? "UNKNOWN"
      : terminalFailure
        ? "FAILED"
        : "PENDING";
    const retryAfterSeconds =
      error instanceof MaxApiError ? error.retryAfterSeconds : undefined;
    const status = sendStarted ? "SENDING" : "PROCESSING";
    await database.technicianMonthlySalaryReportDelivery.updateMany({
      where: { id: row.id, status },
      data: {
        status: nextStatus,
        nextAttemptAt: new Date(
          Date.now() +
            (retryAfterSeconds
              ? retryAfterSeconds * 1_000
              : maxRetryDelayMilliseconds(delivery.attempt_count)),
        ),
        lockedUntil: null,
        lastError: unknownDelivery
          ? "MAX delivery result could not be confirmed. The report remains available in the archive."
          : terminalFailure
            ? "MAX delivery failed. The report remains available in the archive."
            : "MAX delivery will be retried. The report remains available in the archive.",
      },
    });
    logger.warn(
      { reportDeliveryId: row.id, status: nextStatus },
      "monthly_salary_report_delivery_attempt_failed",
    );
  }
};

export const runMonthlySalaryReportWorkerTick = async (
  database: DatabaseClient,
  now = new Date(),
): Promise<void> => {
  const enabledAt = await getReportEnabledAt(database);
  if (enabledAt) {
    for (const month of getDueSalaryReportMonths(now, enabledAt)) {
      try {
        await generateMonthlySalaryReport(database, month, now);
      } catch {
        logger.warn(
          { year: month.year, month: month.month },
          "monthly_salary_report_generation_failed",
        );
        break;
      }
    }
  }

  await recoverExpiredDeliveries(database, now);
  const deliveries = await claimPendingDeliveries(database);
  for (const delivery of deliveries) {
    await processDelivery(database, delivery);
  }
};

export const startMonthlySalaryReportWorker = (
  database: DatabaseClient,
): (() => void) => {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await runMonthlySalaryReportWorkerTick(database);
    } catch {
      logger.warn("monthly_salary_report_worker_unavailable");
    } finally {
      running = false;
    }
  };
  const interval = setInterval(() => void tick(), WORKER_INTERVAL_MILLISECONDS);
  interval.unref();
  void tick();
  return () => clearInterval(interval);
};
