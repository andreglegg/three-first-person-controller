import { vi } from "vitest";

beforeEach(() => {
  Object.defineProperty(document, "pointerLockElement", {
    configurable: true,
    writable: true,
    value: null,
  });

  document.exitPointerLock = vi.fn(async () => {
    document.pointerLockElement = null;
  });
});
