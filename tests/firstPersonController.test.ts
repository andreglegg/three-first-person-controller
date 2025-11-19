/// <reference types="vitest" />

import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";

import { FirstPersonController } from "../src/FirstPersonController.js";

describe("FirstPersonController", () => {
  const createController = () => {
    const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
    const element = document.createElement("div");
    element.tabIndex = 0;
    document.body.appendChild(element);
    element.focus();
    Object.assign(element, {
      requestPointerLock: vi.fn(),
    });

    return {
      camera,
      element,
      controller: new FirstPersonController(camera, element, {
        enablePointerLock: false,
      }),
    };
  };

  it("applies movement and gravity updates", () => {
    const { controller, camera } = createController();

    controller.setMovementConfig({ moveSpeed: 10 });

    document.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyW" }));
    controller.update(0.1);

    expect(camera.position.z).toBeLessThan(0);

    controller.update(0.5);
    expect(camera.position.y).toBeGreaterThan(0);

    document.dispatchEvent(new KeyboardEvent("keyup", { code: "KeyW" }));
    controller.dispose();
    document.body.innerHTML = "";
  });

  it("updates field of view when requested", () => {
    const { controller, camera } = createController();
    controller.setFieldOfView(90);

    expect(camera.fov).toBe(90);
    controller.dispose();
    document.body.innerHTML = "";
  });
});
