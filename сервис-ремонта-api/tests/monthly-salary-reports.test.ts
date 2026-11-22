import ExcelJS from "exceljs";
import express from "express";
import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";

import { hashSessionToken } from "../src/features/auth/auth.middleware.js";
import { summarizeMonthlySalarySettlements } from "../src/features/salary/monthly-salary-report-adjustments.js";
import {
  buildMonthlySalaryWorkbook,
  loadMonthlySalaryReportData,
} from "../src/features/salary/monthly-salary-report-workbook.js";
import { getDueSalaryReportMonths } from "../src/features/salary/monthly-salary-report-worker.js";
import { createMonthlySalaryReportRouter } from "../src/features/salary/monthly-salary-report.routes.js";
import type { DatabaseClient } from "../src/lib/database/database.js";
import { errorHandler } from "../src/lib/http/error-handler.js";

test("monthly report schedule uses Moscow time and waits until 10:00 on day one", () => {
  const enabledAt = new Date("2026-11-22T14:00:00.000Z");
  assert.deepEqual(
    getDueSalaryReportMonths(new Date("2026-12-01T06:59:00.000Z"), enabledAt),
    [],
  );
  assert.deepEqual(
    getDueSalaryReportMonths(new Date("2026-12-01T07:00:00.000Z"), enabledAt),
    [{ year: 2026, month: 11 }],
  );
});

test("monthly report schedule does not generate months before the feature was enabled", () => {
  const enabledAt = new Date("2026-11-22T14:00:00.000Z");
  assert.deepEqual(
    getDueSalaryReportMonths(new Date("2026-11-30T21:00:00.000Z"), enabledAt),
    [],
  );
  assert.deepEqual(
    getDueSalaryReportMonths(
      new Date("2027-03-01T07:00:00.000Z"),
      enabledAt,
      3,
    ),
    [
      { year: 2026, month: 11 },
      { year: 2026, month: 12 },
      { year: 2027, month: 1 },
    ],
  );
});

test("workbook data combines saved repair and craft accruals and retains zero-work technicians", async () => {
  const earnedAt = new Date("2026-11-12T12:00:00.000Z");
  const technicianA = { id: "tech-a", displayName: "Мастер А" };
  const technicianB = { id: "tech-b", displayName: "Мастер Б" };
  const database = {
    user: {
      findMany: async () => [technicianA, technicianB],
    },
    technicianSalaryEntry: {
      findMany: async () => [
        {
          technicianId: technicianA.id,
          technician: { displayName: technicianA.displayName },
          earnedAt,
          serviceTotalRub: 1_000,
          visitFeesRub: 850,
          ratePercent: 75,
          salaryRub: 1_600,
          order: { serviceNumber: "SRV-100" },
        },
        {
          technicianId: null,
          technician: null,
          earnedAt,
          serviceTotalRub: 100,
          visitFeesRub: 0,
          ratePercent: 75,
          salaryRub: 75,
          order: { serviceNumber: null },
        },
      ],
    },
    craftOrderSalaryEntry: {
      findMany: async () => [
        {
          technicianId: technicianA.id,
          technician: { displayName: technicianA.displayName },
          earnedAt,
          serviceTotalRub: 400,
          ratePercent: 75,
          salaryRub: 300,
          craftOrder: { serviceNumber: "SRV-200" },
        },
      ],
    },
  } as unknown as DatabaseClient;

  const data = await loadMonthlySalaryReportData(database, {
    startsAt: new Date("2026-11-01T00:00:00.000Z"),
    endsAt: new Date("2026-12-01T00:00:00.000Z"),
  });

  assert.equal(data.workCount, 3);
  assert.equal(data.technicianCount, 3);
  assert.equal(data.totalSalaryRub, 1_975);
  assert.deepEqual(
    data.summaries.map((row) => [
      row.technicianName,
      row.workCount,
      row.salaryRub,
    ]),
    [
      ["Мастер А", 2, 1_900],
      ["Мастер Б", 0, 0],
      ["Мастер не указан", 1, 75],
    ],
  );
});

test("payroll adjustments remain separate and reduce the amount due", () => {
  const summary = {
    technicianId: "tech-a",
    technicianName: "Мастер А",
    workCount: 2,
    serviceTotalRub: 1_000,
    visitFeesRub: 850,
    salaryRub: 1_600,
  };
  const reportData = {
    lines: [],
    summaries: [summary],
    workCount: summary.workCount,
    technicianCount: 1,
    totalSalaryRub: summary.salaryRub,
  };
  const { settlements, totals } = summarizeMonthlySalarySettlements(
    reportData,
    [
      {
        id: "tax",
        technicianId: "tech-a",
        technicianName: "Мастер А",
        type: "TAX",
        amountRub: 100,
        description: "Налог за месяц",
        occurredAt: new Date("2026-12-01T00:00:00.000Z"),
        createdByName: "Администратор",
        voidedAt: null,
        voidedByName: null,
        voidReason: null,
      },
      {
        id: "advance",
        technicianId: "tech-a",
        technicianName: "Мастер А",
        type: "ADVANCE",
        amountRub: 200,
        description: "Аванс",
        occurredAt: new Date("2026-11-15T00:00:00.000Z"),
        createdByName: "Администратор",
        voidedAt: null,
        voidedByName: null,
        voidReason: null,
      },
      {
        id: "deduction",
        technicianId: "tech-a",
        technicianName: "Мастер А",
        type: "DEDUCTION",
        amountRub: 50,
        description: "Удержание",
        occurredAt: new Date("2026-11-20T00:00:00.000Z"),
        createdByName: "Администратор",
        voidedAt: new Date("2026-11-21T00:00:00.000Z"),
        voidedByName: "Администратор",
        voidReason: "Запись внесена ошибочно",
      },
    ],
  );

  assert.deepEqual(settlements[0], {
    ...summary,
    taxRub: 100,
    advanceRub: 200,
    deductionRub: 0,
    netPayRub: 1_300,
  });
  assert.deepEqual(totals, {
    taxRub: 100,
    advanceRub: 200,
    deductionRub: 0,
    netPayRub: 1_300,
  });
});

test("monthly XLSX contains work detail, manual adjustment ledger, and net pay", async () => {
  const date = new Date("2026-11-12T12:00:00.000Z");
  const buffer = await buildMonthlySalaryWorkbook({
    adjustments: [
      {
        id: "tax",
        technicianId: "tech-a",
        technicianName: "Мастер А",
        type: "TAX",
        amountRub: 200,
        description: "Налог введён вручную",
        occurredAt: new Date("2026-12-01T00:00:00.000Z"),
        createdByName: "Администратор",
        voidedAt: null,
        voidedByName: null,
        voidReason: null,
      },
    ],
    data: {
      lines: [
        {
          technicianId: "tech-a",
          technicianName: "Мастер А",
          earnedAt: date,
          workType: "Ремонт",
          serviceNumber: "SRV-100",
          serviceTotalRub: 1_000,
          visitFeesRub: 850,
          ratePercent: 75,
          salaryRub: 1_600,
        },
      ],
      summaries: [
        {
          technicianId: "tech-a",
          technicianName: "Мастер А",
          workCount: 1,
          serviceTotalRub: 1_000,
          visitFeesRub: 850,
          salaryRub: 1_600,
        },
      ],
      workCount: 1,
      technicianCount: 1,
      totalSalaryRub: 1_600,
    },
    periodLabel: "ноябрь 2026 г.",
    generatedAt: new Date("2026-12-01T07:00:00.000Z"),
  });

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const summary = workbook.getWorksheet("Сводка");
  const details = workbook.getWorksheet("Работы");
  const adjustmentSheet = workbook.getWorksheet("Налог и удержания");
  assert.ok(summary);
  assert.ok(details);
  assert.ok(adjustmentSheet);
  assert.equal(summary.getCell("A4").value, "Мастер");
  assert.equal(summary.getCell("A5").value, "Мастер А");
  assert.equal(summary.getCell("E5").value, 1_600);
  assert.equal(summary.getCell("F5").value, 200);
  assert.equal(summary.getCell("I5").value, 1_400);
  assert.equal(summary.getCell("A6").value, "ИТОГО");
  assert.equal(summary.getCell("E6").value, 1_600);
  assert.equal(summary.getCell("I6").value, 1_400);
  assert.equal(details.getCell("A4").value, "Дата начисления");
  assert.equal(details.getCell("B5").value, "Мастер А");
  assert.equal(details.getCell("D5").value, "SRV-100");
  assert.equal(details.getCell("H5").value, 1_600);
  assert.equal(adjustmentSheet.getCell("C5").value, "Налог");
  assert.equal(adjustmentSheet.getCell("D5").value, "Налог введён вручную");
  assert.equal(adjustmentSheet.getCell("E5").value, 200);
  assert.match(String(summary.getCell("A3").value), /Налог вводится вручную/u);
  assert.ok(buffer.byteLength > 1_000);
});

test("monthly salary report archive is restricted to administrators", async (t) => {
  const adminToken = "A".repeat(48);
  const technicianToken = "T".repeat(48);
  const reportId = "11111111-1111-4111-8111-111111111111";
  const adjustmentId = "33333333-3333-4333-8333-333333333333";
  const users = [
    {
      id: "11111111-1111-4111-8111-111111111111",
      displayName: "Администратор",
      role: "ADMIN" as const,
      token: adminToken,
    },
    {
      id: "22222222-2222-4222-8222-222222222222",
      displayName: "Мастер",
      role: "TECHNICIAN" as const,
      token: technicianToken,
    },
  ];
  const sessions = users.map((user) => ({
    expiresAt: new Date(Date.now() + 60_000),
    user: {
      id: user.id,
      email: `${user.role.toLowerCase()}@example.test`,
      displayName: user.displayName,
      phoneNumber: null,
      avatarObjectId: null,
      role: user.role,
      active: true,
      mustChangePassword: false,
    },
    token: user.token,
  }));
  let reportLookupCount = 0;
  const database = {
    session: {
      findUnique: async ({ where }: { where: { tokenHash: string } }) => {
        const session = sessions.find(
          (candidate) => hashSessionToken(candidate.token) === where.tokenHash,
        );
        return session
          ? { expiresAt: session.expiresAt, user: session.user }
          : null;
      },
    },
    technicianMonthlySalaryReport: {
      findMany: async () => {
        reportLookupCount += 1;
        return [];
      },
      findUnique: async ({ where }: { where: { id: string } }) =>
        where.id === reportId
          ? {
              id: reportId,
              periodStart: new Date("2026-11-01T00:00:00.000Z"),
              periodEnd: new Date("2026-11-30T00:00:00.000Z"),
            }
          : null,
    },
    user: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        where.id === users[1].id
          ? {
              id: users[1].id,
              displayName: users[1].displayName,
              role: users[1].role,
            }
          : null,
    },
    $transaction: async () => {
      throw new Error("An out-of-period entry must not open a transaction.");
    },
  } as unknown as DatabaseClient;

  const app = express();
  app.use("/api", createMonthlySalaryReportRouter(database));
  app.use(errorHandler);
  const server = app.listen(0);
  await once(server, "listening");
  t.after(() => server.close());
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const baseUrl = `http://127.0.0.1:${address.port}/api/admin/salary-reports`;

  assert.equal((await fetch(baseUrl)).status, 401);
  const technicianList = await fetch(baseUrl, {
    headers: { authorization: `Bearer ${technicianToken}` },
  });
  assert.equal(technicianList.status, 403);
  const technicianDownload = await fetch(
    `${baseUrl}/11111111-1111-4111-8111-111111111111/file`,
    { headers: { authorization: `Bearer ${technicianToken}` } },
  );
  assert.equal(technicianDownload.status, 403);
  const technicianAdjustments = await fetch(
    `${baseUrl}/${reportId}/adjustments`,
    { headers: { authorization: `Bearer ${technicianToken}` } },
  );
  assert.equal(technicianAdjustments.status, 403);
  const technicianCreateAdjustment = await fetch(
    `${baseUrl}/${reportId}/adjustments`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${technicianToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        technicianId: users[1].id,
        type: "TAX",
        amountRub: 100,
        description: "Тестовая запись",
        occurredAt: "2026-11-01",
      }),
    },
  );
  assert.equal(technicianCreateAdjustment.status, 403);
  const technicianVoidAdjustment = await fetch(
    `${baseUrl}/${reportId}/adjustments/${adjustmentId}/void`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${technicianToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ reason: "Тестовая отмена" }),
    },
  );
  assert.equal(technicianVoidAdjustment.status, 403);
  const adminOutOfPeriodAdjustment = await fetch(
    `${baseUrl}/${reportId}/adjustments`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${adminToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        technicianId: users[1].id,
        type: "TAX",
        amountRub: 100,
        description: "Налог за следующий месяц",
        occurredAt: "2026-12-01",
      }),
    },
  );
  assert.equal(adminOutOfPeriodAdjustment.status, 400);
  const adminResponse = await fetch(baseUrl, {
    headers: { authorization: `Bearer ${adminToken}` },
  });
  assert.equal(adminResponse.status, 200);
  assert.deepEqual(await adminResponse.json(), { reports: [] });
  assert.equal(reportLookupCount, 1);
});
