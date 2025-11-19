import * as THREE from "three";

import {
  DEFAULT_KEY_BINDINGS,
  DEFAULT_LOOK_SENSITIVITY,
  DEFAULT_MAX_PITCH,
  DEFAULT_PLAYER_CONFIG,
  DEFAULT_SPRINT_MULTIPLIER,
  DEFAULT_CROUCH_HEIGHT_RATIO,
  DEFAULT_CROUCH_SPEED_MULTIPLIER,
} from "./constants.js";
import type {
  ControllerState,
  FirstPersonControllerOptions,
  GravityFn,
  GroundCheckFn,
  KeyBindingsOverrides,
  PlayerConfig,
} from "./types.js";
import { KeyboardControls } from "./input/KeyboardControls.js";
import { PointerLockManager } from "./input/PointerLockManager.js";

const MIN_CROUCH_HEIGHT = 0.3;

const hasOwn = <T extends object, K extends keyof T>(obj: T, key: K): boolean =>
  Object.prototype.hasOwnProperty.call(obj, key);

export class FirstPersonController {
  private readonly camera: THREE.PerspectiveCamera;
  private readonly domElement: HTMLElement;
  private readonly keyboard: KeyboardControls;
  private readonly pointerLock: PointerLockManager;

  private readonly state: ControllerState = {
    position: new THREE.Vector3(),
    velocity: new THREE.Vector3(),
    yaw: 0,
    pitch: 0,
    onGround: true,
  };

  private config: PlayerConfig;
  private lookSensitivity: number;
  private maxPitch: number;
  private sprintMultiplier: number;
  private fieldOfView: number;
  private pointerLockChangeCallback: ((locked: boolean) => void) | undefined;
  private pointerLockToggleCallback: ((locked: boolean) => void) | undefined;
  private jumpCallback: (() => void) | undefined;
  private gravityFn: GravityFn | undefined;
  private groundCheckFn: GroundCheckFn | undefined;
  private crouchEnabled: boolean;
  private isCrouching = false;
  private crouchHeight: number;
  private crouchSpeedMultiplier: number;
  private currentHeight: number;
  private maxStepHeight: number | undefined;
  private maxSlopeAngle: number | undefined;
  private initialPosition: THREE.Vector3;
  private readonly tempEuler = new THREE.Euler(0, 0, 0, "YXZ");
  private readonly yawQuaternion = new THREE.Quaternion();
  private readonly forwardVector = new THREE.Vector3();
  private readonly rightVector = new THREE.Vector3();
  private readonly moveDirection = new THREE.Vector3();
  private readonly upVector = new THREE.Vector3(0, 1, 0);
  private readonly tempDisplacement = new THREE.Vector3();
  private readonly gravityCache = new THREE.Vector3();
  private readonly heightLerpSpeed = 10;
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

    this.state.yaw -= event.movementX * this.lookSensitivity;
    this.state.pitch = THREE.MathUtils.clamp(
      this.state.pitch - event.movementY * this.lookSensitivity,
      -this.maxPitch,
      this.maxPitch,
    );
    this.applyToCamera(this.camera);
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

    this.config = { ...DEFAULT_PLAYER_CONFIG };
    this.lookSensitivity = DEFAULT_LOOK_SENSITIVITY;
    this.maxPitch = DEFAULT_MAX_PITCH;
    this.sprintMultiplier = DEFAULT_SPRINT_MULTIPLIER;
    this.fieldOfView = options.fieldOfView ?? camera.fov;
    this.pointerLockChangeCallback = options.onPointerLockChange ?? undefined;
    this.pointerLockToggleCallback = options.onPointerLockToggle ?? undefined;
    this.jumpCallback = options.onJump ?? undefined;
    this.gravityFn = options.gravityFn ?? undefined;
    this.groundCheckFn = options.groundCheckFn ?? undefined;
    this.crouchEnabled = options.enableCrouch ?? false;
    this.crouchSpeedMultiplier = options.crouchSpeedMultiplier ?? DEFAULT_CROUCH_SPEED_MULTIPLIER;
    this.crouchHeight = this.computeCrouchHeight(options.crouchHeight);
    this.currentHeight = this.config.height;
    this.maxStepHeight =
      options.maxStepHeight !== undefined ? Math.max(0, options.maxStepHeight) : undefined;
    this.maxSlopeAngle =
      options.maxSlopeAngle !== undefined
        ? THREE.MathUtils.degToRad(Math.max(0, Math.min(89.9, options.maxSlopeAngle)))
        : undefined;
    this.initialPosition =
      options.initialPosition?.clone() ?? new THREE.Vector3(0, this.config.height, -5);

    this.keyboard = new KeyboardControls(DEFAULT_KEY_BINDINGS, domElement);
    this.pointerLock = new PointerLockManager(this.domElement, {
      enabled: options.enablePointerLock ?? true,
      autoLock: options.autoPointerLock ?? true,
      onPointerLockChange: (locked) => this.handlePointerLockChange(locked),
    });

    this.applyOptions(options);
    this.initializeCamera();
    this.initializeListeners();
  }

  update(deltaSeconds: number): void {
    if (this.disposed) {
      return;
    }

    const delta = Math.max(0, deltaSeconds);

    // Skip update if delta is too small to prevent numerical instability
    if (delta < 1e-6) {
      return;
    }

    this.updateHeight(delta);
    this.updateMovement(delta);
    this.applyGravity(delta);
    this.resolveGround(delta);
    this.applyToCamera(this.camera);
  }

  updateOptions(options: FirstPersonControllerOptions): void {
    this.applyOptions(options);
  }

  setMovementConfig(config: Partial<PlayerConfig>): void {
    this.config = { ...this.config, ...config };
    this.crouchHeight = this.computeCrouchHeight(this.crouchHeight);
    this.currentHeight =
      this.isCrouching && this.crouchEnabled ? this.crouchHeight : this.config.height;
    if (this.state.position.y < this.currentHeight) {
      this.state.position.y = this.currentHeight;
    }
  }

  setLookSensitivity(value: number): void {
    this.lookSensitivity = Math.max(0.0001, value);
  }

  setMaxPitch(value: number): void {
    this.maxPitch = Math.max(0.1, Math.min(Math.PI / 2 - 0.01, value));
    this.state.pitch = THREE.MathUtils.clamp(this.state.pitch, -this.maxPitch, this.maxPitch);
  }

  setSprintMultiplier(multiplier: number): void {
    this.sprintMultiplier = Math.max(1, multiplier);
  }

  setPointerLockEnabled(enabled: boolean): void {
    this.pointerLock.setEnabled(enabled);
    if (!enabled) {
      this.keyboard.setPointerLockActive(false);
    } else {
      this.keyboard.setPointerLockActive(this.pointerLock.isLocked());
    }
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

  getState(): Readonly<ControllerState> {
    return Object.freeze({
      position: this.state.position.clone(),
      velocity: this.state.velocity.clone(),
      yaw: this.state.yaw,
      pitch: this.state.pitch,
      onGround: this.state.onGround,
    });
  }

  applyToCamera(camera: THREE.PerspectiveCamera): void {
    camera.position.copy(this.state.position);
    this.tempEuler.set(this.state.pitch, this.state.yaw, 0);
    camera.quaternion.setFromEuler(this.tempEuler);
    camera.fov = this.fieldOfView;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
  }

  requestPointerLock(): void {
    if (this.disposed) {
      return;
    }

    this.pointerLock.requestLock();
  }

  exitPointerLock(): void {
    if (this.disposed) {
      return;
    }

    this.pointerLock.exitLock();
  }

  enableCrouch(enabled: boolean): void {
    this.crouchEnabled = enabled;
    if (!enabled) {
      this.isCrouching = false;
    }
  }

  setCrouch(enabled: boolean): void {
    if (!this.crouchEnabled) {
      return;
    }

    this.isCrouching = enabled;
  }

  getDebugInfo(): {
    speed: number;
    onGround: boolean;
    yaw: number;
    pitch: number;
    velocity: THREE.Vector3;
    pointerLocked: boolean;
  } {
    const horizontalSpeed = Math.hypot(this.state.velocity.x, this.state.velocity.z);
    return {
      speed: horizontalSpeed,
      onGround: this.state.onGround,
      yaw: this.state.yaw,
      pitch: this.state.pitch,
      velocity: this.state.velocity.clone(),
      pointerLocked: this.pointerLock.isLocked(),
    };
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

  private initializeCamera(): void {
    this.state.position.copy(this.initialPosition);
    this.state.velocity.set(0, 0, 0);
    this.state.yaw = 0;
    this.state.pitch = 0;
    this.state.onGround = true;
    this.currentHeight = this.config.height;
    this.applyToCamera(this.camera);
  }

  private initializeListeners(): void {
    this.domElement.addEventListener("click", this.onClickHandler);
    document.addEventListener("mousemove", this.onMouseMoveHandler);
    this.keyboard.attach();
    this.pointerLock.attach();
  }

  private updateMovement(delta: number): void {
    const state = this.state;
    this.yawQuaternion.setFromAxisAngle(this.upVector, state.yaw);

    this.forwardVector.set(0, 0, -1).applyQuaternion(this.yawQuaternion);
    this.rightVector.set(1, 0, 0).applyQuaternion(this.yawQuaternion);

    this.moveDirection.set(0, 0, 0);

    if (this.keyboard.isActionPressed("forward")) this.moveDirection.add(this.forwardVector);
    if (this.keyboard.isActionPressed("backward")) this.moveDirection.sub(this.forwardVector);
    if (this.keyboard.isActionPressed("left")) this.moveDirection.sub(this.rightVector);
    if (this.keyboard.isActionPressed("right")) this.moveDirection.add(this.rightVector);

    if (this.moveDirection.lengthSq() > 0) {
      this.moveDirection.normalize();
      const moveSpeed = this.getMoveSpeed();
      this.tempDisplacement.copy(this.moveDirection).multiplyScalar(moveSpeed * delta);
      state.position.add(this.tempDisplacement);
      state.velocity.x = this.tempDisplacement.x / delta;
      state.velocity.z = this.tempDisplacement.z / delta;
    } else {
      state.velocity.x = 0;
      state.velocity.z = 0;
    }

    if (this.keyboard.isActionPressed("jump") && state.onGround) {
      state.velocity.y = this.config.jumpSpeed;
      state.onGround = false;
      this.jumpCallback?.();
    }
  }

  private applyGravity(delta: number): void {
    if (delta <= 0) {
      return;
    }

    const gravity = this.gravityFn
      ? this.gravityFn(this.state.position.clone())
      : this.gravityCache.set(0, -this.config.gravity, 0);

    this.state.velocity.addScaledVector(gravity, delta);
    this.state.position.y += this.state.velocity.y * delta;
  }

  private resolveGround(delta: number): void {
    const result = this.runGroundCheck(delta);
    let onGround = result.onGround;
    const normal = result.groundNormal ? result.groundNormal.clone().normalize() : null;

    if (onGround && this.maxSlopeAngle !== undefined && normal) {
      const angle = this.upVector.angleTo(normal);
      if (angle > this.maxSlopeAngle) {
        onGround = false;
      }
    }

    if (onGround) {
      const desiredY = this.currentHeight;
      const diff = desiredY - this.state.position.y;

      if (this.maxStepHeight !== undefined && Math.abs(diff) > this.maxStepHeight) {
        onGround = false;
      } else {
        this.state.position.y = desiredY;
        if (this.state.velocity.y < 0) {
          this.state.velocity.y = 0;
        }
        this.state.onGround = true;
        return;
      }
    }

    this.state.onGround = false;
  }

  private runGroundCheck(delta: number): { onGround: boolean; groundNormal: THREE.Vector3 | null } {
    if (this.groundCheckFn) {
      return this.groundCheckFn(this.getState(), delta);
    }

    const grounded = this.state.position.y <= this.currentHeight;
    return {
      onGround: grounded,
      groundNormal: grounded ? this.upVector.clone() : null,
    };
  }

  private getMoveSpeed(): number {
    let speed = this.config.moveSpeed;

    if (this.keyboard.isActionPressed("sprint")) {
      speed *= this.sprintMultiplier;
    }

    if (this.crouchEnabled && this.isCrouching) {
      speed *= this.crouchSpeedMultiplier;
    }

    return speed;
  }

  private updateHeight(delta: number): void {
    const targetHeight =
      this.isCrouching && this.crouchEnabled ? this.crouchHeight : this.config.height;
    const alpha = Math.min(1, delta * this.heightLerpSpeed);
    this.currentHeight = THREE.MathUtils.lerp(this.currentHeight, targetHeight, alpha);
    if (Math.abs(this.currentHeight - targetHeight) < 0.001) {
      this.currentHeight = targetHeight;
    }

    if (this.state.onGround) {
      this.state.position.y = this.currentHeight;
    }
  }

  private handlePointerLockChange(locked: boolean): void {
    if (!locked) {
      this.keyboard.reset();
    }

    this.keyboard.setPointerLockActive(locked);
    this.pointerLockChangeCallback?.(locked);
    this.pointerLockToggleCallback?.(locked);
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

    if (hasOwn(options, "gravityFn")) {
      this.gravityFn = options.gravityFn ?? undefined;
    }

    if (hasOwn(options, "groundCheckFn")) {
      this.groundCheckFn = options.groundCheckFn ?? undefined;
    }

    if (hasOwn(options, "enableCrouch")) {
      this.enableCrouch(options.enableCrouch ?? false);
    }

    if (options.crouchHeight !== undefined) {
      this.crouchHeight = this.computeCrouchHeight(options.crouchHeight);
    } else {
      this.crouchHeight = this.computeCrouchHeight(this.crouchHeight);
    }

    if (options.crouchSpeedMultiplier !== undefined) {
      this.crouchSpeedMultiplier = Math.max(0.01, options.crouchSpeedMultiplier);
    }

    if (hasOwn(options, "maxStepHeight")) {
      this.maxStepHeight =
        options.maxStepHeight !== undefined ? Math.max(0, options.maxStepHeight) : undefined;
    }

    if (hasOwn(options, "maxSlopeAngle")) {
      this.maxSlopeAngle =
        options.maxSlopeAngle !== undefined
          ? THREE.MathUtils.degToRad(Math.max(0, Math.min(89.9, options.maxSlopeAngle)))
          : undefined;
    }

    if (hasOwn(options, "onPointerLockToggle")) {
      this.pointerLockToggleCallback = options.onPointerLockToggle;
    }

    if (hasOwn(options, "onPointerLockChange")) {
      this.pointerLockChangeCallback = options.onPointerLockChange;
    }

    if (hasOwn(options, "onJump")) {
      this.setJumpCallback(options.onJump);
    }
  }

  private computeCrouchHeight(value?: number): number {
    const base = value ?? this.config.height * DEFAULT_CROUCH_HEIGHT_RATIO;
    return THREE.MathUtils.clamp(base, MIN_CROUCH_HEIGHT, this.config.height);
  }

  setFieldOfView(value: number): void {
    this.fieldOfView = Math.max(10, Math.min(150, value));
    this.applyToCamera(this.camera);
  }
}
