import * as THREE from "three";

import { DEFAULT_LOOK_SENSITIVITY, DEFAULT_MAX_PITCH } from "./constants.js";
import type { LookChangeCallback, LookControllerOptions } from "./types.js";
import { PointerLockManager } from "./input/PointerLockManager.js";

export class LookController {
  private readonly camera: THREE.PerspectiveCamera;
  private readonly domElement: HTMLElement;
  private readonly pointerLock: PointerLockManager;
  private lookSensitivity: number;
  private maxPitch: number;
  private fieldOfView: number;
  private lookChangeCallback: LookChangeCallback | undefined;
  private pointerLockChangeCallback: ((locked: boolean) => void) | undefined;
  private pointerLockToggleCallback: ((locked: boolean) => void) | undefined;
  private yaw: number;
  private pitch: number;
  private disposed = false;
  private readonly tempEuler = new THREE.Euler(0, 0, 0, "YXZ");

  private readonly onClickHandler = (): void => {
    if (
      this.disposed ||
      !this.pointerLock.isSupported() ||
      !this.pointerLock.isEnabled() ||
      !this.pointerLock.isAutoLockEnabled()
    ) {
      return;
    }

    this.domElement.focus();
    this.pointerLock.requestLock();
  };

  private readonly onMouseMoveHandler = (event: MouseEvent): void => {
    if (this.disposed) {
      return;
    }

    if (this.pointerLock.isEnabled()) {
      if (this.pointerLock.isSupported() && !this.pointerLock.isLocked()) {
        return;
      }
    } else if (
      event.target !== this.domElement &&
      !this.domElement.contains(event.target as Node)
    ) {
      return;
    }

    this.yaw -= event.movementX * this.lookSensitivity;
    this.pitch = THREE.MathUtils.clamp(
      this.pitch - event.movementY * this.lookSensitivity,
      -this.maxPitch,
      this.maxPitch,
    );

    this.applyToCamera(this.camera);
    this.notifyLookChange();
  };

  constructor(camera: THREE.PerspectiveCamera, options: LookControllerOptions) {
    if (!options || !options.element) {
      throw new Error(
        "LookController requires options with an { element } property. Use new LookController(camera, { element, ...options }).",
      );
    }

    this.camera = camera;
    this.domElement = options.element;
    if (this.domElement.tabIndex < 0) {
      this.domElement.tabIndex = 0;
    }

    this.lookSensitivity = options.lookSensitivity ?? DEFAULT_LOOK_SENSITIVITY;
    this.maxPitch = options.maxPitch ?? DEFAULT_MAX_PITCH;
    this.fieldOfView = options.fieldOfView ?? camera.fov;
    this.lookChangeCallback = options.onLookChange ?? undefined;
    this.pointerLockChangeCallback = options.onPointerLockChange ?? undefined;
    this.pointerLockToggleCallback = options.onPointerLockToggle ?? undefined;

    this.pointerLock = new PointerLockManager(this.domElement, {
      enabled: options.enablePointerLock ?? true,
      autoLock: options.autoPointerLock ?? true,
      onPointerLockChange: (locked) => this.handlePointerLockChange(locked),
    });

    this.tempEuler.setFromQuaternion(this.camera.quaternion, "YXZ");
    this.yaw = this.tempEuler.y;
    this.pitch = THREE.MathUtils.clamp(this.tempEuler.x, -this.maxPitch, this.maxPitch);

    this.applyToCamera(this.camera);
    this.initializeListeners();
  }

  update(): void {
    if (this.disposed) {
      return;
    }

    this.applyToCamera(this.camera);
  }

  applyToCamera(camera: THREE.PerspectiveCamera, options?: { includePosition?: boolean }): void {
    const includePosition = options?.includePosition ?? false;

    if (includePosition) {
      camera.position.copy(this.camera.position);
    }

    this.tempEuler.set(this.pitch, this.yaw, 0);
    camera.quaternion.setFromEuler(this.tempEuler);
    camera.fov = this.fieldOfView;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
  }

  getAngles(): { yaw: number; pitch: number } {
    return { yaw: this.yaw, pitch: this.pitch };
  }

  setLookAngles(yaw: number, pitch: number = this.pitch): void {
    this.yaw = yaw;
    this.pitch = THREE.MathUtils.clamp(pitch, -this.maxPitch, this.maxPitch);
    this.applyToCamera(this.camera);
    this.notifyLookChange();
  }

  setLookSensitivity(value: number): void {
    this.lookSensitivity = Math.max(0.0001, value);
  }

  setMaxPitch(value: number): void {
    this.maxPitch = Math.max(0.1, Math.min(Math.PI / 2 - 0.01, value));
    const clamped = THREE.MathUtils.clamp(this.pitch, -this.maxPitch, this.maxPitch);
    const changed = clamped !== this.pitch;
    this.pitch = clamped;
    if (changed) {
      this.applyToCamera(this.camera);
      this.notifyLookChange();
    }
  }

  setFieldOfView(value: number): void {
    this.fieldOfView = Math.max(10, Math.min(150, value));
    this.applyToCamera(this.camera);
  }

  setPointerLockEnabled(enabled: boolean): void {
    this.pointerLock.setEnabled(enabled);
  }

  setAutoPointerLock(enabled: boolean): void {
    this.pointerLock.setAutoLock(enabled);
  }

  setPointerLockChangeCallback(callback: ((locked: boolean) => void) | undefined): void {
    this.pointerLockChangeCallback = callback;
  }

  setPointerLockToggleCallback(callback: ((locked: boolean) => void) | undefined): void {
    this.pointerLockToggleCallback = callback;
  }

  setLookChangeCallback(callback: LookChangeCallback | undefined): void {
    this.lookChangeCallback = callback;
  }

  lockPointer(): void {
    if (this.disposed) {
      return;
    }

    this.pointerLock.requestLock();
  }

  unlockPointer(): void {
    if (this.disposed) {
      return;
    }

    this.pointerLock.exitLock();
  }

  requestPointerLock(): void {
    this.lockPointer();
  }

  exitPointerLock(): void {
    this.unlockPointer();
  }

  isPointerLocked(): boolean {
    return this.pointerLock.isLocked();
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    this.pointerLock.dispose();
    this.domElement.removeEventListener("click", this.onClickHandler);
    document.removeEventListener("mousemove", this.onMouseMoveHandler);
  }

  private initializeListeners(): void {
    this.domElement.addEventListener("click", this.onClickHandler);
    document.addEventListener("mousemove", this.onMouseMoveHandler);
    this.pointerLock.attach();
  }

  private handlePointerLockChange(locked: boolean): void {
    this.pointerLockChangeCallback?.(locked);
    this.pointerLockToggleCallback?.(locked);
  }

  private notifyLookChange(): void {
    this.lookChangeCallback?.(this.yaw, this.pitch);
  }
}
