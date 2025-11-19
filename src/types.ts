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
}

export interface FirstPersonControllerOptions extends Partial<PlayerConfig>, PointerLockCallbacks {
  lookSensitivity?: number;
  maxPitch?: number;
  sprintMultiplier?: number;
  enablePointerLock?: boolean;
  autoPointerLock?: boolean;
  keyBindings?: KeyBindingsOverrides;
  fieldOfView?: number;
  onJump?: () => void;
}
