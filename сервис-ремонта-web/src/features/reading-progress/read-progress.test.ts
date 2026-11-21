import { describe, expect, it } from "vitest";

import {
  READ_PROGRESS_VISIBILITY_THRESHOLD,
  calculateReadProgress,
  shouldShowReadProgressButton,
} from "./read-progress";

describe("page reading progress", () => {
  it("measures progress through the scrollable page", () => {
    expect(calculateReadProgress(0, 800, 2_400)).toBe(0);
    expect(calculateReadProgress(800, 800, 2_400)).toBe(50);
    expect(calculateReadProgress(1_600, 800, 2_400)).toBe(100);
  });

  it("clamps overscroll and returns zero for pages without scrolling", () => {
    expect(calculateReadProgress(-40, 800, 2_400)).toBe(0);
    expect(calculateReadProgress(2_000, 800, 2_400)).toBe(100);
    expect(calculateReadProgress(0, 800, 800)).toBe(0);
  });

  it("shows the return-to-top button starting at halfway", () => {
    expect(READ_PROGRESS_VISIBILITY_THRESHOLD).toBe(50);
    expect(shouldShowReadProgressButton(49)).toBe(false);
    expect(shouldShowReadProgressButton(50)).toBe(true);
  });
});
