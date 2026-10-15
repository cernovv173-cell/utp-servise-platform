import { describe, expect, it } from "vitest";

import { configureRaccoonUtterance } from "./use-raccoon-voice";

describe("configureRaccoonUtterance", () => {
  it("requests Russian speech and selects an installed Russian voice", () => {
    const russianVoice = { lang: "ru-RU" } as SpeechSynthesisVoice;
    const utterance = {
      lang: "",
      pitch: 1,
      rate: 1,
      voice: null,
    } as unknown as SpeechSynthesisUtterance;

    configureRaccoonUtterance(utterance, [{ lang: "en-US" } as SpeechSynthesisVoice, russianVoice]);

    expect(utterance.lang).toBe("ru-RU");
    expect(utterance.rate).toBe(0.94);
    expect(utterance.pitch).toBe(1.05);
    expect(utterance.voice).toBe(russianVoice);
  });
});
