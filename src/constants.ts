import type { KeyBindings, PlayerConfig } from "./types.js";

export const DEFAULT_PLAYER_CONFIG: PlayerConfig = {
  height: 1.6,
  moveSpeed: 5,
  jumpSpeed: 8,
  gravity: 20,
};

export const DEFAULT_LOOK_SENSITIVITY = 0.0025;
export const DEFAULT_MAX_PITCH = Math.PI / 2 - 0.01;
export const DEFAULT_SPRINT_MULTIPLIER = 1.5;
export const DEFAULT_CROUCH_HEIGHT_RATIO = 0.6;
export const DEFAULT_CROUCH_SPEED_MULTIPLIER = 0.6;

export const DEFAULT_KEY_BINDINGS: KeyBindings = {
  forward: ["KeyW", "ArrowUp"],
  backward: ["KeyS", "ArrowDown"],
  left: ["KeyA", "ArrowLeft"],
  right: ["KeyD", "ArrowRight"],
  jump: ["Space"],
  sprint: ["ShiftLeft", "ShiftRight"],
};
