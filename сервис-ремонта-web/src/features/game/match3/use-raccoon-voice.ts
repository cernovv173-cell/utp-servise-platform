import { useCallback, useEffect, useRef, useState } from "react";

const preferenceKey = "match3:raccoon-voice-enabled:v1";

const isSpeechSupported = () =>
  typeof window !== "undefined" &&
  "speechSynthesis" in window &&
  typeof SpeechSynthesisUtterance !== "undefined";

const readPreference = () => {
  try {
    return typeof window !== "undefined" && window.localStorage.getItem(preferenceKey) === "true";
  } catch {
    return false;
  }
};

export const configureRaccoonUtterance = (
  utterance: SpeechSynthesisUtterance,
  voices: readonly SpeechSynthesisVoice[],
) => {
  utterance.lang = "ru-RU";
  utterance.rate = 0.94;
  utterance.pitch = 1.05;
  const russianVoice = voices.find((voice) => voice.lang.toLowerCase().startsWith("ru"));
  if (russianVoice) utterance.voice = russianVoice;
  return utterance;
};

export const useRaccoonVoice = (dialogue: string | null) => {
  const [enabled, setEnabled] = useState(readPreference);
  const supported = isSpeechSupported();
  const currentUtterance = useRef<SpeechSynthesisUtterance | null>(null);
  const lastSpoken = useRef<string | null>(null);

  const cancel = useCallback(() => {
    if (!supported) return;
    currentUtterance.current = null;
    window.speechSynthesis.cancel();
  }, [supported]);

  const speak = useCallback(
    (text: string) => {
      if (!supported) return;

      const utterance = configureRaccoonUtterance(
        new SpeechSynthesisUtterance(text),
        window.speechSynthesis.getVoices(),
      );

      currentUtterance.current = null;
      window.speechSynthesis.cancel();
      currentUtterance.current = utterance;
      lastSpoken.current = text;
      utterance.onend = () => {
        if (currentUtterance.current === utterance) currentUtterance.current = null;
      };
      utterance.onerror = utterance.onend;
      window.speechSynthesis.speak(utterance);
    },
    [supported],
  );

  useEffect(() => {
    if (!dialogue) {
      cancel();
      return;
    }

    if (!enabled || lastSpoken.current === dialogue) return;
    const timer = window.setTimeout(() => speak(dialogue), 0);
    return () => window.clearTimeout(timer);
  }, [cancel, dialogue, enabled, speak]);

  useEffect(() => cancel, [cancel]);

  const toggle = useCallback(() => {
    const nextEnabled = !enabled;
    setEnabled(nextEnabled);
    try {
      window.localStorage.setItem(preferenceKey, String(nextEnabled));
    } catch {
      // Keep the preference for this visit if browser storage is unavailable.
    }

    if (nextEnabled && dialogue) speak(dialogue);
    else {
      lastSpoken.current = null;
      cancel();
    }
  }, [cancel, dialogue, enabled, speak]);

  const replay = useCallback(() => {
    if (enabled && dialogue) speak(dialogue);
  }, [dialogue, enabled, speak]);

  return { enabled, supported, toggle, replay };
};
