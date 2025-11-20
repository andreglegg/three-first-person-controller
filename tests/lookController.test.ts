/// <reference types="vitest" />

import { beforeEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";

import { LookController } from "../src/LookController.js";

describe("LookController", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  const createLookController = (options?: Partial<ConstructorParameters<typeof LookController>[1]>) => {
    const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
    camera.position.set(3, 4, 5);
    const element = document.createElement("div");
    element.tabIndex = 0;
    document.body.appendChild(element);

    return {
      camera,
      element,
      controller: new LookController(camera, {
        element,
        enablePointerLock: false,
        ...options,
      }),
    };
  };

  it("updates yaw/pitch without altering camera position", () => {
    const onLookChange = vi.fn();
    const { controller, camera } = createLookController({ onLookChange });
    const initialPosition = camera.position.clone();

    controller.setLookAngles(1, 0.2);

    const newPosition = camera.position.clone();
    expect(newPosition.equals(initialPosition)).toBe(true);
    expect(onLookChange).toHaveBeenCalled();

    controller.dispose();
  });

  it("applies orientation to other cameras", () => {
    const { controller, camera, element } = createLookController();
    const secondCamera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);

    element.dispatchEvent(new MouseEvent("mousemove", { movementX: 10, movementY: -5 }));

    controller.applyToCamera(secondCamera);

    expect(secondCamera.quaternion.equals(camera.quaternion)).toBe(true);
    expect(secondCamera.position.equals(camera.position)).toBe(false);

    controller.applyToCamera(secondCamera, { includePosition: true });
    expect(secondCamera.position.equals(camera.position)).toBe(true);

    controller.dispose();
  });

  it("clamps pitch when maxPitch is lowered", () => {
    const { controller, element } = createLookController();

    element.dispatchEvent(new MouseEvent("mousemove", { movementY: -1000 }));
    controller.setMaxPitch(Math.PI / 4);

    const { pitch } = controller.getAngles();
    expect(pitch).toBeLessThanOrEqual(Math.PI / 4);

    controller.dispose();
  });
});
