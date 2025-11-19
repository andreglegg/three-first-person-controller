/// <reference types="vitest" />

import { describe, expect, it, vi } from "vitest";

import { KeyboardControls } from "../src/input/KeyboardControls.js";
import type { KeyBindings } from "../src/types.js";

const mockBindings: KeyBindings = {
  forward: ["KeyW"],
  backward: ["KeyS"],
  left: ["KeyA"],
  right: ["KeyD"],
  jump: ["Space"],
  sprint: ["ShiftLeft"],
};

describe("KeyboardControls", () => {
  it("tracks keydown/keyup events and reports action state", () => {
    const target = document.createElement("div");
    target.tabIndex = 0;
    document.body.appendChild(target);
    target.focus();
    const keyboard = new KeyboardControls(mockBindings, target);
    keyboard.attach();

    const keydown = new KeyboardEvent("keydown", { code: "KeyW", target });
    const preventDefaultSpy = vi.spyOn(keydown, "preventDefault");
    document.dispatchEvent(keydown);

    expect(preventDefaultSpy).toHaveBeenCalledOnce();
    expect(keyboard.isActionPressed("forward")).toBe(true);

    document.dispatchEvent(new KeyboardEvent("keyup", { code: "KeyW", target }));
    expect(keyboard.isActionPressed("forward")).toBe(false);

    document.body.removeChild(target);
    keyboard.dispose();
  });

  it("updates bindings at runtime", () => {
    const target = document.createElement("div");
    target.tabIndex = 0;
    document.body.appendChild(target);
    target.focus();
    const keyboard = new KeyboardControls(mockBindings, target);
    keyboard.attach();

    keyboard.updateBindings({ forward: ["ArrowUp"] });

    document.dispatchEvent(new KeyboardEvent("keydown", { code: "ArrowUp", target }));
    expect(keyboard.isActionPressed("forward")).toBe(true);

    document.dispatchEvent(new KeyboardEvent("keyup", { code: "ArrowUp", target }));
    expect(keyboard.isActionPressed("forward")).toBe(false);

    document.body.removeChild(target);
    keyboard.dispose();
  });
});
