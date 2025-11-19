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

  it("respects custom initial position", () => {
    const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
    const element = document.createElement("div");
    const customPosition = new THREE.Vector3(10, 5, 20);

    const controller = new FirstPersonController(camera, element, {
      enablePointerLock: false,
      initialPosition: customPosition,
    });

    const state = controller.getState();
    expect(state.position.x).toBe(10);
    expect(state.position.y).toBe(5);
    expect(state.position.z).toBe(20);

    controller.dispose();
  });

  it("handles zero delta without numerical instability", () => {
    const { controller, camera } = createController();
    const initialPos = camera.position.clone();

    controller.update(0);
    controller.update(0.0);
    controller.update(-0.1);

    // Position should not have changed with zero or negative delta
    expect(camera.position.equals(initialPos)).toBe(true);

    controller.dispose();
    document.body.innerHTML = "";
  });

  it("applies gravity and reaches ground", () => {
    const { controller } = createController();

    controller.setMovementConfig({ height: 1.6, gravity: 20 });

    // Start at elevated position
    const state = controller.getState();
    const initialY = state.position.y;

    // Run several physics updates
    for (let i = 0; i < 100; i++) {
      controller.update(0.016); // ~60fps
    }

    const finalState = controller.getState();
    expect(finalState.onGround).toBe(true);
    expect(finalState.position.y).toBe(1.6); // Should settle at height

    controller.dispose();
    document.body.innerHTML = "";
  });

  it("handles jumping physics correctly", () => {
    const { controller } = createController();
    const element = controller["domElement"];

    controller.setMovementConfig({ jumpSpeed: 10, gravity: 20 });

    // Wait for ground
    for (let i = 0; i < 20; i++) {
      controller.update(0.016);
    }

    let state = controller.getState();
    expect(state.onGround).toBe(true);

    // Jump
    document.dispatchEvent(new KeyboardEvent("keydown", { code: "Space" }));
    controller.update(0.016);

    state = controller.getState();
    expect(state.velocity.y).toBeGreaterThan(0);
    expect(state.onGround).toBe(false);

    document.dispatchEvent(new KeyboardEvent("keyup", { code: "Space" }));
    controller.dispose();
    document.body.innerHTML = "";
  });

  it("supports custom gravity functions", () => {
    const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
    const element = document.createElement("div");

    let gravityCallCount = 0;
    const controller = new FirstPersonController(camera, element, {
      enablePointerLock: false,
      gravityFn: (position) => {
        gravityCallCount++;
        return new THREE.Vector3(0, -15, 0); // Custom gravity
      },
    });

    controller.update(0.1);

    expect(gravityCallCount).toBeGreaterThan(0);

    controller.dispose();
  });

  it("supports custom ground check functions", () => {
    const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
    const element = document.createElement("div");

    let groundCheckCallCount = 0;
    const controller = new FirstPersonController(camera, element, {
      enablePointerLock: false,
      groundCheckFn: (state, delta) => {
        groundCheckCallCount++;
        return {
          onGround: state.position.y <= 2,
          groundNormal: new THREE.Vector3(0, 1, 0),
        };
      },
    });

    controller.update(0.1);

    expect(groundCheckCallCount).toBeGreaterThan(0);

    controller.dispose();
  });

  it("handles crouch state correctly", () => {
    const { controller } = createController();

    controller.updateOptions({
      enableCrouch: true,
      crouchHeight: 1.0,
      height: 1.8,
    });

    expect(controller.getHeight()).toBe(1.8);

    controller.setCrouch(true);

    // Update to allow height lerp
    for (let i = 0; i < 10; i++) {
      controller.update(0.016);
    }

    const state = controller.getState();
    expect(state.position.y).toBeLessThan(1.8);

    controller.dispose();
    document.body.innerHTML = "";
  });

  it("handles sprint multiplier correctly", () => {
    const { controller } = createController();

    controller.setMovementConfig({ moveSpeed: 5 });
    controller.setSprintMultiplier(2);

    document.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyW" }));
    document.dispatchEvent(new KeyboardEvent("keydown", { code: "ShiftLeft" }));

    controller.update(0.1);

    const state = controller.getState();
    const speed = Math.sqrt(state.velocity.x ** 2 + state.velocity.z ** 2);

    // Speed should be roughly moveSpeed * sprintMultiplier
    expect(speed).toBeGreaterThan(5);

    document.dispatchEvent(new KeyboardEvent("keyup", { code: "KeyW" }));
    document.dispatchEvent(new KeyboardEvent("keyup", { code: "ShiftLeft" }));
    controller.dispose();
    document.body.innerHTML = "";
  });

  it("clamps pitch to maxPitch", () => {
    const { controller, element } = createController();
    const maxPitch = Math.PI / 4; // 45 degrees

    controller.setMaxPitch(maxPitch);

    // Simulate extreme mouse movement
    element.dispatchEvent(new MouseEvent("mousemove", { movementY: -10000 }));

    const state = controller.getState();
    expect(Math.abs(state.pitch)).toBeLessThanOrEqual(maxPitch);

    controller.dispose();
    document.body.innerHTML = "";
  });

  it("provides immutable state snapshots", () => {
    const { controller } = createController();

    const state1 = controller.getState();
    const state2 = controller.getState();

    // Should be different objects
    expect(state1).not.toBe(state2);
    expect(state1.position).not.toBe(state2.position);
    expect(state1.velocity).not.toBe(state2.velocity);

    // But with same values initially
    expect(state1.position.equals(state2.position)).toBe(true);

    controller.dispose();
    document.body.innerHTML = "";
  });

  it("triggers jump callback when jumping", () => {
    const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
    const element = document.createElement("div");
    element.tabIndex = 0;
    document.body.appendChild(element);
    element.focus();
    const jumpCallback = vi.fn();

    const controller = new FirstPersonController(camera, element, {
      enablePointerLock: false,
      onJump: jumpCallback,
    });

    // Wait for ground
    for (let i = 0; i < 20; i++) {
      controller.update(0.016);
    }

    document.dispatchEvent(new KeyboardEvent("keydown", { code: "Space" }));
    controller.update(0.016);

    expect(jumpCallback).toHaveBeenCalled();

    document.dispatchEvent(new KeyboardEvent("keyup", { code: "Space" }));
    controller.dispose();
    document.body.removeChild(element);
  });

  it("applies state to any camera", () => {
    const { controller } = createController();
    const secondCamera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);

    document.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyW" }));
    controller.update(0.1);
    document.dispatchEvent(new KeyboardEvent("keyup", { code: "KeyW" }));

    const originalZ = controller.getState().position.z;

    controller.applyToCamera(secondCamera);

    expect(secondCamera.position.z).toBe(originalZ);

    controller.dispose();
    document.body.innerHTML = "";
  });

  it("handles disposal properly", () => {
    const { controller } = createController();

    controller.dispose();

    // Should not throw when updating after disposal
    expect(() => controller.update(0.1)).not.toThrow();

    // Should not allow operations after disposal
    controller.requestPointerLock(); // Should do nothing
    controller.exitPointerLock(); // Should do nothing

    document.body.innerHTML = "";
  });
});
