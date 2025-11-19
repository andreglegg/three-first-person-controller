import type * as THREE from "three";

export type KeyCode = string;

export type MovementAction = "forward" | "backward" | "left" | "right" | "jump" | "sprint";

export interface PlayerConfig {
  height: number;
  moveSpeed: number;
  jumpSpeed: number;
  gravity: number;
}

export type KeyBindings = Record<MovementAction, KeyCode[]>;

export type KeyBindingsOverrides = Partial<Record<MovementAction, KeyCode[]>>;

export interface PointerLockCallbacks {
  onPointerLockChange?: (locked: boolean) => void;
  onPointerLockToggle?: (locked: boolean) => void;
}

export interface ControllerState {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  yaw: number;
  pitch: number;
  onGround: boolean;
}

export type GravityFn = (position: THREE.Vector3) => THREE.Vector3;

export type GroundCheckFn = (
  state: ControllerState,
  delta: number,
) => { onGround: boolean; groundNormal: THREE.Vector3 | null };

export interface FirstPersonControllerOptions extends Partial<PlayerConfig>, PointerLockCallbacks {
  lookSensitivity?: number;
  maxPitch?: number;
  sprintMultiplier?: number;
  enablePointerLock?: boolean;
  autoPointerLock?: boolean;
  keyBindings?: KeyBindingsOverrides;
  fieldOfView?: number;
  gravityFn?: GravityFn;
  groundCheckFn?: GroundCheckFn;
  enableCrouch?: boolean;
  crouchHeight?: number;
  crouchSpeedMultiplier?: number;
  maxStepHeight?: number;
  maxSlopeAngle?: number;
  onJump?: () => void;
  initialPosition?: THREE.Vector3;
}
