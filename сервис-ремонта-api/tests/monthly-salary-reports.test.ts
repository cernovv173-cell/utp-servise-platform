import ExcelJS from "exceljs";
import express from "express";
import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";

import { hashSessionToken } from "../src/features/auth/auth.middleware.js";
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

test("monthly XLSX contains the summary, detailed rows, and accrual-only disclaimer", async () => {
  const date = new Date("2026-11-12T12:00:00.000Z");
  const buffer = await buildMonthlySalaryWorkbook({
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
  assert.ok(summary);
  assert.ok(details);
  assert.equal(summary.getCell("A4").value, "Мастер");
  assert.equal(summary.getCell("A5").value, "Мастер А");
  assert.equal(summary.getCell("E5").value, 1_600);
  assert.equal(summary.getCell("A6").value, "ИТОГО");
  assert.equal(summary.getCell("E6").value, 1_600);
  assert.equal(details.getCell("A4").value, "Дата начисления");
  assert.equal(details.getCell("B5").value, "Мастер А");
  assert.equal(details.getCell("D5").value, "SRV-100");
  assert.equal(details.getCell("H5").value, 1_600);
  assert.match(
    String(summary.getCell("A3").value),
    /налоги, удержания и авансы не вычтены/u,
  );
  assert.ok(buffer.byteLength > 1_000);
});

test("monthly salary report archive is restricted to administrators", async (t) => {
  const adminToken = "A".repeat(48);
  const technicianToken = "T".repeat(48);
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
      findUnique: async () => null,
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
  const adminResponse = await fetch(baseUrl, {
    headers: { authorization: `Bearer ${adminToken}` },
  });
  assert.equal(adminResponse.status, 200);
  assert.deepEqual(await adminResponse.json(), { reports: [] });
  assert.equal(reportLookupCount, 1);
});
