/// <reference types="vitest" />

import { describe, expect, it, vi, beforeEach } from "vitest";

import { PointerLockManager } from "../src/input/PointerLockManager.js";

describe("PointerLockManager", () => {
  const createElement = () => {
    const element = document.createElement("div");
    Object.assign(element, {
      requestPointerLock: vi.fn(async () => {
        document.pointerLockElement = element;
      }),
    });
    return element as HTMLElement & {
      requestPointerLock: () => Promise<void>;
    };
  };

  beforeEach(() => {
    document.pointerLockElement = null;
    document.exitPointerLock = vi.fn(async () => {
      document.pointerLockElement = null;
    });
  });

  it("requests and exits pointer lock when enabled", async () => {
    const element = createElement();
    const lockManager = new PointerLockManager(element, {
      enabled: true,
      autoLock: true,
      onPointerLockChange: vi.fn(),
    });

    lockManager.attach();
    lockManager.requestLock();

    await Promise.resolve();

    expect(element.requestPointerLock).toHaveBeenCalled();
    document.dispatchEvent(new Event("pointerlockchange"));
    expect(lockManager.isLocked()).toBe(true);

    lockManager.exitLock();
    await Promise.resolve();
    expect(document.exitPointerLock).toHaveBeenCalled();
    expect(lockManager.isLocked()).toBe(false);

    lockManager.dispose();
  });

  it("disables pointer lock when support is missing", () => {
    const element = document.createElement("div");
    const lockManager = new PointerLockManager(element, {
      enabled: true,
      autoLock: true,
      onPointerLockChange: vi.fn(),
    });

    lockManager.setEnabled(true);
    lockManager.requestLock();

    expect(lockManager.isSupported()).toBe(false);
    expect(lockManager.isLocked()).toBe(false);
  });
});
