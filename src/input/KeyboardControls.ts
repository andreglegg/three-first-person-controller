import {
  type KeyBindings,
  type KeyBindingsOverrides,
  type KeyCode,
  type MovementAction,
} from "../types.js";

export class KeyboardControls {
  private readonly pressedKeys = new Set<KeyCode>();
  private keyBindings: KeyBindings;
  private attached = false;
  private readonly target: HTMLElement;
  private pointerLockActive = false;

  private readonly keyDownHandler = (event: KeyboardEvent): void => {
    if (!this.shouldHandleEvent()) {
      return;
    }

    this.pressedKeys.add(event.code);

    if (this.isMovementKey(event.code)) {
      event.preventDefault();
    }
  };

  private readonly keyUpHandler = (event: KeyboardEvent): void => {
    if (!this.shouldHandleEvent()) {
      return;
    }

    this.pressedKeys.delete(event.code);
  };

  constructor(initialBindings: KeyBindings, target: HTMLElement) {
    this.keyBindings = KeyboardControls.cloneBindings(initialBindings);
    this.target = target;
  }

  attach(): void {
    if (this.attached) {
      return;
    }

    document.addEventListener("keydown", this.keyDownHandler);
    document.addEventListener("keyup", this.keyUpHandler);
    this.attached = true;
  }

  detach(): void {
    if (!this.attached) {
      return;
    }

    document.removeEventListener("keydown", this.keyDownHandler);
    document.removeEventListener("keyup", this.keyUpHandler);
    this.attached = false;
  }

  dispose(): void {
    this.detach();
    this.reset();
  }

  reset(): void {
    this.pressedKeys.clear();
  }

  setPointerLockActive(active: boolean): void {
    this.pointerLockActive = active;
  }

  isActionPressed(action: MovementAction): boolean {
    return this.keyBindings[action]?.some((code) => this.pressedKeys.has(code)) ?? false;
  }

  updateBindings(overrides: KeyBindingsOverrides): void {
    const updated = KeyboardControls.cloneBindings(this.keyBindings);

    for (const key of Object.keys(overrides) as MovementAction[]) {
      const codes = overrides[key];
      if (codes) {
        updated[key] = [...codes];
      }
    }

    this.keyBindings = updated;
  }

  private isMovementKey(code: KeyCode): boolean {
    return Object.values(this.keyBindings).some((binding) => binding.includes(code));
  }

  private shouldHandleEvent(): boolean {
    if (this.pointerLockActive) {
      return true;
    }

    const activeElement = document.activeElement;
    if (!activeElement || !(activeElement instanceof Node)) {
      return false;
    }

    if (activeElement === this.target) {
      return true;
    }

    return this.target.contains(activeElement);
  }

  private static cloneBindings(bindings: KeyBindings): KeyBindings {
    return {
      forward: [...bindings.forward],
      backward: [...bindings.backward],
      left: [...bindings.left],
      right: [...bindings.right],
      jump: [...bindings.jump],
      sprint: [...bindings.sprint],
    };
  }
}
