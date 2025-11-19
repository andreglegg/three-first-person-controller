import type { PointerLockCallbacks } from "../types.js";

interface PointerLockOptions extends PointerLockCallbacks {
  enabled: boolean;
  autoLock: boolean;
}

export class PointerLockManager {
  private readonly domElement: HTMLElement;
  private readonly supported: boolean;
  private enabled: boolean;
  private autoLock: boolean;
  private callbacks: PointerLockCallbacks = {};
  private attached = false;

  private readonly pointerLockChangeHandler = (): void => {
    this.notify(this.isLocked());
  };

  private readonly keydownHandler = (event: KeyboardEvent): void => {
    if (event.key === "Escape" && this.isLocked()) {
      this.exitLock();
    }
  };

  constructor(domElement: HTMLElement, options: PointerLockOptions) {
    this.domElement = domElement;
    this.supported =
      typeof this.domElement.requestPointerLock === "function" &&
      typeof document.exitPointerLock === "function";
    this.enabled = this.supported ? options.enabled : false;
    this.autoLock = options.autoLock;
    this.setCallbacks(options);
  }

  attach(): void {
    if (!this.supported || this.attached) {
      return;
    }

    document.addEventListener("pointerlockchange", this.pointerLockChangeHandler);
    document.addEventListener("keydown", this.keydownHandler, true);
    this.attached = true;
  }

  detach(): void {
    if (!this.attached) {
      return;
    }

    document.removeEventListener("pointerlockchange", this.pointerLockChangeHandler);
    document.removeEventListener("keydown", this.keydownHandler, true);
    this.attached = false;
  }

  dispose(): void {
    this.exitLock();
    this.detach();
  }

  isSupported(): boolean {
    return this.supported;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  isAutoLockEnabled(): boolean {
    return this.autoLock;
  }

  isLocked(): boolean {
    return this.supported && document.pointerLockElement === this.domElement;
  }

  setEnabled(enabled: boolean): void {
    if (!this.supported) {
      this.enabled = false;
      return;
    }

    this.enabled = enabled;

    if (!enabled) {
      this.exitLock();
    }
  }

  setAutoLock(autoLock: boolean): void {
    this.autoLock = autoLock;
  }

  setCallbacks(callbacks: PointerLockCallbacks): void {
    this.callbacks = {};
    if (callbacks.onPointerLockChange) {
      this.callbacks.onPointerLockChange = callbacks.onPointerLockChange;
    }
    if (callbacks.onPointerLockToggle) {
      this.callbacks.onPointerLockToggle = callbacks.onPointerLockToggle;
    }
  }

  requestLock(): void {
    if (!this.supported || !this.enabled) {
      return;
    }

    if (typeof this.domElement.requestPointerLock === "function") {
      void this.domElement.requestPointerLock();
    }
  }

  exitLock(): void {
    if (!this.supported || document.pointerLockElement !== this.domElement) {
      this.notify(false);
      return;
    }

    if (typeof document.exitPointerLock === "function") {
      void document.exitPointerLock();
    }
  }

  private notify(locked: boolean): void {
    this.callbacks.onPointerLockChange?.(locked);
    this.callbacks.onPointerLockToggle?.(locked);
  }
}
