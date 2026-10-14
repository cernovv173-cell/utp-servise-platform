import { useSyncExternalStore } from "react";

const UPDATE_INTERVAL_MILLISECONDS = 30_000;
const listeners = new Set<() => void>();
let currentTime = Date.now();
let updateInterval: ReturnType<typeof setInterval> | null = null;

const getSnapshot = () => currentTime;

const updateCurrentTime = () => {
  currentTime = Date.now();
  listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void) => {
  if (listeners.size === 0) {
    currentTime = Date.now();
    updateInterval = setInterval(updateCurrentTime, UPDATE_INTERVAL_MILLISECONDS);
  }
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && updateInterval !== null) {
      clearInterval(updateInterval);
      updateInterval = null;
    }
  };
};

export const useCurrentTime = () => useSyncExternalStore(subscribe, getSnapshot);
