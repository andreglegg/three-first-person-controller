import * as THREE from "three";

import {
  DEFAULT_KEY_BINDINGS,
  DEFAULT_LOOK_SENSITIVITY,
  DEFAULT_MAX_PITCH,
  DEFAULT_PLAYER_CONFIG,
  DEFAULT_SPRINT_MULTIPLIER,
} from "./constants.js";
import type { FirstPersonControllerOptions, KeyBindingsOverrides, PlayerConfig } from "./types.js";
import { KeyboardControls } from "./input/KeyboardControls.js";
import { PointerLockManager } from "./input/PointerLockManager.js";

export class FirstPersonController {
  private readonly camera: THREE.PerspectiveCamera;
  private readonly domElement: HTMLElement;
  private readonly keyboard: KeyboardControls;
  private readonly pointerLock: PointerLockManager;

  private config: PlayerConfig;
  private lookSensitivity: number;
  private maxPitch: number;
  private sprintMultiplier: number;
  private fieldOfView: number;
  private pointerLockChangeCallback: ((locked: boolean) => void) | undefined;
  private jumpCallback: (() => void) | undefined;

  private yaw = 0;
  private pitch = 0;
  private velocityY = 0;
  private isOnGround = true;

  private readonly tempEuler = new THREE.Euler(0, 0, 0, "YXZ");
  private readonly yawQuaternion = new THREE.Quaternion();
  private readonly forwardVector = new THREE.Vector3();
  private readonly rightVector = new THREE.Vector3();
  private readonly moveDirection = new THREE.Vector3();
  private readonly upVector = new THREE.Vector3(0, 1, 0);

  private disposed = false;

  private readonly onClickHandler = (): void => {
    if (
      this.disposed ||
      !this.pointerLock.isSupported() ||
      !this.pointerLock.isEnabled() ||
      !this.pointerLock.isAutoLockEnabled()
    ) {
      return;
    }

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
    this.pitch -= event.movementY * this.lookSensitivity;
    this.pitch = Math.max(-this.maxPitch, Math.min(this.maxPitch, this.pitch));
    this.applyRotation();
  };

  constructor(
    camera: THREE.PerspectiveCamera,
    domElement: HTMLElement,
    options: FirstPersonControllerOptions = {},
  ) {
    this.camera = camera;
    this.domElement = domElement;
    if (this.domElement.tabIndex < 0) {
      this.domElement.tabIndex = 0;
    }
    this.keyboard = new KeyboardControls(DEFAULT_KEY_BINDINGS, domElement);
    this.pointerLockChangeCallback = options.onPointerLockChange;
    this.jumpCallback = options.onJump;

    this.pointerLock = new PointerLockManager(this.domElement, {
      enabled: options.enablePointerLock ?? true,
      autoLock: options.autoPointerLock ?? true,
      onPointerLockChange: (locked) => this.handlePointerLockChange(locked),
    });

    this.config = { ...DEFAULT_PLAYER_CONFIG };
    this.lookSensitivity = DEFAULT_LOOK_SENSITIVITY;
    this.maxPitch = DEFAULT_MAX_PITCH;
    this.sprintMultiplier = DEFAULT_SPRINT_MULTIPLIER;
    this.fieldOfView = this.camera.fov;

    this.applyOptions(options);
    this.initializeCamera();
    this.initializeListeners();
    this.keyboard.setPointerLockActive(this.pointerLock.isLocked());
  }

  update(deltaSeconds: number): void {
    if (this.disposed) {
      return;
    }

    this.updateMovement(deltaSeconds);
    this.applyGravity(deltaSeconds);
  }

  updateOptions(options: FirstPersonControllerOptions): void {
    this.applyOptions(options);
  }

  setMovementConfig(config: Partial<PlayerConfig>): void {
    this.config = { ...this.config, ...config };

    if (config.height !== undefined && this.camera.position.y < config.height) {
      this.camera.position.y = config.height;
    }
  }

  setLookSensitivity(value: number): void {
    if (value <= 0) {
      throw new Error("lookSensitivity must be greater than zero.");
    }

    this.lookSensitivity = value;
  }

  setMaxPitch(value: number): void {
    const clamped = Math.max(0.1, Math.min(Math.PI / 2, value));
    this.maxPitch = clamped;
    this.pitch = Math.max(-this.maxPitch, Math.min(this.maxPitch, this.pitch));
  }

  setSprintMultiplier(multiplier: number): void {
    if (multiplier < 1) {
      throw new Error("sprintMultiplier must be greater than or equal to 1.");
    }

    this.sprintMultiplier = multiplier;
  }

  setFieldOfView(fov: number): void {
    if (fov <= 1 || fov >= 179) {
      throw new Error("fieldOfView must be between 1 and 179 degrees.");
    }

    this.fieldOfView = fov;
    this.camera.fov = fov;
    this.camera.updateProjectionMatrix();
  }

  setPointerLockEnabled(enabled: boolean): void {
    this.pointerLock.setEnabled(enabled);
    this.keyboard.setPointerLockActive(enabled && this.pointerLock.isLocked());
  }

  setAutoPointerLock(enabled: boolean): void {
    this.pointerLock.setAutoLock(enabled);
  }

  setKeyBindings(bindings: KeyBindingsOverrides): void {
    this.keyboard.updateBindings(bindings);
  }

  setPointerLockChangeCallback(callback: ((locked: boolean) => void) | undefined): void {
    this.pointerLockChangeCallback = callback;
  }

  setJumpCallback(callback: (() => void) | undefined): void {
    this.jumpCallback = callback;
  }

  isPointerLocked(): boolean {
    return this.pointerLock.isLocked();
  }

  getHeight(): number {
    return this.config.height;
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    this.keyboard.dispose();
    this.pointerLock.dispose();

    this.domElement.removeEventListener("click", this.onClickHandler);
    document.removeEventListener("mousemove", this.onMouseMoveHandler);
  }

  private handlePointerLockChange(locked: boolean): void {
    if (!locked) {
      this.keyboard.reset();
    }
    this.keyboard.setPointerLockActive(locked);
    this.pointerLockChangeCallback?.(locked);
  }

  private applyOptions(options: FirstPersonControllerOptions): void {
    const movementUpdates: Partial<PlayerConfig> = {};

    if (options.height !== undefined) movementUpdates.height = options.height;
    if (options.moveSpeed !== undefined) movementUpdates.moveSpeed = options.moveSpeed;
    if (options.jumpSpeed !== undefined) movementUpdates.jumpSpeed = options.jumpSpeed;
    if (options.gravity !== undefined) movementUpdates.gravity = options.gravity;

    if (Object.keys(movementUpdates).length > 0) {
      this.setMovementConfig(movementUpdates);
    }

    if (options.lookSensitivity !== undefined) {
      this.setLookSensitivity(options.lookSensitivity);
    }

    if (options.maxPitch !== undefined) {
      this.setMaxPitch(options.maxPitch);
    }

    if (options.sprintMultiplier !== undefined) {
      this.setSprintMultiplier(options.sprintMultiplier);
    }

    if (options.enablePointerLock !== undefined) {
      this.setPointerLockEnabled(options.enablePointerLock);
    }

    if (options.autoPointerLock !== undefined) {
      this.setAutoPointerLock(options.autoPointerLock);
    }

    if (options.keyBindings) {
      this.setKeyBindings(options.keyBindings);
    }

    if (options.fieldOfView !== undefined) {
      this.setFieldOfView(options.fieldOfView);
    }

    if (options.onPointerLockChange !== undefined) {
      this.setPointerLockChangeCallback(options.onPointerLockChange);
      this.keyboard.setPointerLockActive(this.pointerLock.isLocked());
    }

    if (options.onJump !== undefined) {
      this.setJumpCallback(options.onJump);
    }
  }

  private initializeCamera(): void {
    this.camera.position.set(0, this.config.height, -5);
    this.yaw = 0;
    this.pitch = 0;
    this.applyRotation();
  }

  private initializeListeners(): void {
    this.domElement.addEventListener("click", this.onClickHandler);
    document.addEventListener("mousemove", this.onMouseMoveHandler);
    this.keyboard.attach();
    this.pointerLock.attach();
  }

  private applyRotation(): void {
    this.tempEuler.set(this.pitch, this.yaw, 0);
    this.camera.quaternion.setFromEuler(this.tempEuler);
  }

  private updateMovement(deltaSeconds: number): void {
    this.yawQuaternion.setFromAxisAngle(this.upVector, this.yaw);

    this.forwardVector.set(0, 0, -1).applyQuaternion(this.yawQuaternion);
    this.rightVector.set(1, 0, 0).applyQuaternion(this.yawQuaternion);

    this.moveDirection.set(0, 0, 0);

    if (this.keyboard.isActionPressed("forward")) this.moveDirection.add(this.forwardVector);
    if (this.keyboard.isActionPressed("backward")) this.moveDirection.sub(this.forwardVector);
    if (this.keyboard.isActionPressed("left")) this.moveDirection.sub(this.rightVector);
    if (this.keyboard.isActionPressed("right")) this.moveDirection.add(this.rightVector);

    if (this.moveDirection.lengthSq() > 0) {
      this.moveDirection.normalize();
      const speed =
        this.config.moveSpeed *
        (this.keyboard.isActionPressed("sprint") ? this.sprintMultiplier : 1);
      const distance = speed * deltaSeconds;
      this.camera.position.addScaledVector(this.moveDirection, distance);
    }

    if (this.keyboard.isActionPressed("jump") && this.isOnGround) {
      this.velocityY = this.config.jumpSpeed;
      this.isOnGround = false;
      this.jumpCallback?.();
    }
  }

  private applyGravity(deltaSeconds: number): void {
    this.velocityY -= this.config.gravity * deltaSeconds;
    this.camera.position.y += this.velocityY * deltaSeconds;

    if (this.camera.position.y <= this.config.height) {
      this.camera.position.y = this.config.height;
      this.velocityY = 0;
      this.isOnGround = true;
    }
  }
}
