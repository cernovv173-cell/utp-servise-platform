import assert from "node:assert/strict";
import { test } from "node:test";

import {
  getNextTechnologyFact,
  technologyFactRotationIntervalMilliseconds,
} from "../src/features/news/technology-facts.js";

test("each refresh selects the next fact and never repeats the previous one", () => {
  const first = getNextTechnologyFact("line-mode-browser");
  const second = getNextTechnologyFact(first.id);
  const third = getNextTechnologyFact(second.id);
  const fourth = getNextTechnologyFact(third.id);

  assert.deepEqual(
    [first.id, second.id, third.id, fourth.id],
    [
      "battery-charge-cycle",
      "usb-c-is-a-connector",
      "water-resistance-wears",
      "backup-321",
    ],
  );
  assert.notEqual(first.id, second.id);
  assert.notEqual(second.id, third.id);
  assert.notEqual(third.id, fourth.id);
});

test("the next refresh wraps around the curated fact list", () => {
  const first = getNextTechnologyFact("backup-321");

  assert.equal(first.id, "first-website");
});

test("new facts link to their primary sources and keep the two-hour refresh time", () => {
  const primarySourceHosts = [
    "support.apple.com",
    "www.usb.org",
    "support.apple.com",
    "www.cisa.gov",
  ];
  let previousFactId = "line-mode-browser";

  for (const sourceHost of primarySourceHosts) {
    const fact = getNextTechnologyFact(
      previousFactId,
      new Date("2026-10-31T10:00:00.000Z"),
    );
    const source = new URL(fact.sourceUrl);

    assert.equal(source.protocol, "https:");
    assert.equal(source.hostname, sourceHost);
    assert.equal(fact.updatedAt, "2026-10-31T10:00:00.000Z");
    previousFactId = fact.id;
  }

  const fact = getNextTechnologyFact("line-mode-browser");
  assert.equal(
    Date.parse(fact.nextUpdateAt) - Date.parse(fact.updatedAt),
    technologyFactRotationIntervalMilliseconds,
  );
});

test("an unknown previous ID still returns a valid source-linked fact", () => {
  const fact = getNextTechnologyFact("not-a-known-fact");

  assert.ok(fact.id);
  assert.ok(fact.title);
  assert.ok(fact.sourceUrl.startsWith("https://"));
});
