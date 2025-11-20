# three-first-person-controller

Lightweight first-person movement controller for Three.js scenes. Handles pointer lock, WASD movement, jumping, gravity, crouching, custom gravity, and debugging helpers so you can focus on building the rest of your experience.

## Installation

```bash
npm install three-first-person-controller three
```

`three` is declared as a peer dependency, so ensure it is installed in your project.

## Demo & Docs

- Live demo (GitHub Pages): https://andreglegg.github.io/threejsFirstPersonController/
- API docs: https://andreglegg.github.io/threejsFirstPersonController/#api-reference

## Upgrade guide

The 0.2 line cleans up the public API:

- Constructor is now `new FirstPersonController(camera, { element, ...options })` (required `element`). The old positional `(camera, domElement, options?)` signature is removed.
- Pointer lock helpers: use `lockPointer`/`unlockPointer`/`isPointerLocked` (aliases `requestPointerLock`/`exitPointerLock` still exist).
- Look-only path: pass `lookOnly: true` or import `LookController` for just yaw/pitch plus pointer lock (`import { LookController } from "three-first-person-controller/look-only"`).
- Orientation callbacks/setters: `onLookChange(yaw, pitch)` and `setLookAngles(yaw, pitch?)`.

Typical migration:

```diff
- const controller = new FirstPersonController(camera, renderer.domElement, { enablePointerLock: false });
+ const controller = new FirstPersonController(camera, { element: renderer.domElement, enablePointerLock: false });

// Pointer lock helpers (if needed)
controller.lockPointer();
controller.unlockPointer();
```

Everything else is additive; defaults preserve previous behaviour.

## Usage

```ts
import * as THREE from "three";
import { FirstPersonController } from "three-first-person-controller";

const renderer = new THREE.WebGLRenderer({ canvas: document.querySelector("canvas")! });
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

const controller = new FirstPersonController(camera, { element: renderer.domElement });
const clock = new THREE.Clock();

function animate() {
  const delta = clock.getDelta();
  controller.update(delta);

  renderer.render(new THREE.Scene(), camera);
  requestAnimationFrame(animate);
}

animate();
```

- Click inside the rendering canvas to lock the pointer and enable mouse-look.
- Movement uses `WASD` keys, `Space` to jump, and the controller automatically applies gravity to keep the camera grounded.
- Call `controller.update(deltaSeconds)` every frame so velocities and gravity remain stable irrespective of frame rate.

Note: the constructor now takes an options object; pass the DOM element as `new FirstPersonController(camera, { element: renderer.domElement, ... })`.

## Configuration

Supply an options object to customize physics, pointer lock behavior, and key bindings. Every option is optional.

```ts
const controller = new FirstPersonController(camera, {
  element: renderer.domElement,
  height: 1.75,
  moveSpeed: 6,
  jumpSpeed: 9,
  gravity: 28,
  lookSensitivity: 0.00175,
  maxPitch: Math.PI / 2 - 0.05,
  sprintMultiplier: 2,
  keyBindings: {
    forward: ["KeyW", "ArrowUp"],
    sprint: ["ShiftLeft"],
    jump: ["Space", "KeyJ"],
  },
  fieldOfView: 80,
  enablePointerLock: true,
  autoPointerLock: false,
  onPointerLockToggle: (locked) => console.log("pointer lock?", locked),
  onJump: () => console.log("jump!"),
});
```

You can also tweak values at runtime:

```ts
controller.updateOptions({ moveSpeed: 8 });
controller.setLookSensitivity(0.001);
controller.setKeyBindings({ jump: ["KeyF"] });
controller.setFieldOfView(90);
controller.setPointerLockEnabled(false); // handle pointer lock yourself
controller.enableCrouch(true);
controller.setCrouch(true);
controller.dispose(); // remove all DOM listeners when tearing down the scene

// Need the current camera baseline height (e.g., for HUDs)?:
controller.getHeight();
```

### Advanced Options

All advanced features default to disabled/off so the controller behaves exactly like previous releases until you opt in.

- `gravityFn(position)` – custom gravity per-position. Return an acceleration vector (units/second²). Defaults to `new THREE.Vector3(0, -gravity, 0)`.
- `groundCheckFn(state, delta)` – custom ground detection. Return `{ onGround, groundNormal }` so you can plug in your own raycasts or physics engine.
- `enableCrouch`, `crouchHeight`, `crouchSpeedMultiplier` – enable crouching, set the crouch eye height, and (optionally) slow movement while crouched.
- `maxStepHeight` – maximum vertical distance (in world units) that can be auto-snapped when resolving ground.
- `maxSlopeAngle` – maximum walkable slope in degrees. Steeper normals are treated as walls.
- `onPointerLockToggle` – notified whenever pointer lock is toggled (includes Escape exits).

### Custom gravity examples

Spherical gravity:

```ts
const gravityValue = 30;

const controller = new FirstPersonController(camera, {
  element: domElement,
  gravityFn: (position) => {
    const center = new THREE.Vector3(0, 0, 0);
    const direction = position.clone().sub(center).normalize();
    return direction.multiplyScalar(-gravityValue);
  },
});
```

Simple cube-planet gravity (faces point to the axis that dominates the position):

```ts
gravityFn: (position) => {
  const axes = [
    new THREE.Vector3(1, 0, 0),
    new THREE.Vector3(-1, 0, 0),
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(0, -1, 0),
    new THREE.Vector3(0, 0, 1),
    new THREE.Vector3(0, 0, -1),
  ];

  const face = axes.reduce((best, axis) =>
    Math.abs(axis.dot(position)) > Math.abs(best.dot(position)) ? axis : best,
  );
  return face.clone().multiplyScalar(-20);
};
```

### Custom ground checks

You can implement your own collision logic and share it with the controller through `groundCheckFn`:

```ts
const controller = new FirstPersonController(camera, {
  element: domElement,
  groundCheckFn: (state) => {
    // Example with a physics engine
    const result = physics.raycastDown(state.position);
    if (!result) return { onGround: false, groundNormal: null };

    return {
      onGround: result.distance <= 0.1,
      groundNormal: result.normal.clone(),
    };
  },
  maxSlopeAngle: 55,
});
```

### State & debug helpers

The controller now exposes both immutable state snapshots and runtime diagnostics:

```ts
// Copy the current controller state (cloned vectors)
const state = controller.getState();
console.log(state.position, state.velocity);

// Apply controller state to any camera (e.g., a minimap view)
controller.applyToCamera(minimapCamera);

// Build a HUD from getDebugInfo()
const info = controller.getDebugInfo();
debugPanel.update({
  speed: info.speed, // horizontal velocity magnitude in units/sec
  grounded: info.onGround,
  yaw: THREE.MathUtils.radToDeg(info.yaw),
  pitch: THREE.MathUtils.radToDeg(info.pitch),
  pointer: info.pointerLocked,
});
```

### Pointer lock helpers

The controller exposes `lockPointer()`, `unlockPointer()`, and `isPointerLocked()` (with `requestPointerLock`/`exitPointerLock` aliases) so you can wire custom UI (buttons, pause menus, etc.). Pointer lock exits cleanly when the user presses Escape, and `onPointerLockToggle` lets you listen to state changes.

### Look-only mode & hooks

- Pass `lookOnly: true` to `FirstPersonController` to skip all position/velocity updates while still handling pointer lock and yaw/pitch.
- Use `onLookChange(yaw, pitch)` to mirror orientation into your own camera or physics system without cloning cameras.
- For a minimal bundle, import the standalone look controller: `import { LookController } from "three-first-person-controller/look-only";`.
- When mirroring orientation (e.g., `applyToCamera(otherCamera, { includePosition: false })`), positions stay untouched so your own movement system stays in control.

## Test Scene

Run the included demo scene to try out the controller before publishing:

```bash
npm install
npm run dev
```

This starts a Vite dev server that serves the files in `demo/`. The scene includes three focused test zones (obstacle field, jump course, sprint lane), a live HUD driven by `getDebugInfo()`, and a control panel where you can tweak move speed, gravity, crouch settings, slope limits, look sensitivity, and FOV. Use `npm run demo:build` to produce a static build (output in `dist-demo/`) and `npm run demo:preview` to serve that build.

## Architecture

The source is organized with explicit layers so you can extend or replace pieces as needed:

- `src/types.ts` centralizes all shared interfaces (config, bindings, options, callbacks, controller state) and is re-exported from the package entry point.
- `src/constants.ts` defines the immutable defaults for physics tuning and input, making it easy to build variant controllers without touching logic.
- `src/input/KeyboardControls.ts` and `src/input/PointerLockManager.ts` encapsulate DOM interactions (keyboard listeners and pointer-lock lifecycle), keeping `FirstPersonController` focused on simulation.
- `src/FirstPersonController.ts` wires the input helpers into the movement integrator that mutates both an internal controller state and the owning `THREE.PerspectiveCamera`.
- `src/LookController.ts` is the pointer-lock + yaw/pitch-only variant for apps that handle movement themselves.
- TypeScript runs in strict mode with additional flags (`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, etc.), so keep everything strongly typed and avoid implicit `any`/`null` usages.

## API Reference

### Constructors

- `new FirstPersonController(camera: THREE.PerspectiveCamera, options: FirstPersonControllerOptions)`
- `new LookController(camera: THREE.PerspectiveCamera, options: LookControllerOptions)`

`options.element` is required for both constructors; pass the canvas or container that should receive pointer lock and focus.

### FirstPersonController methods

- `update(deltaSeconds: number)`
- `updateOptions(options: FirstPersonControllerOptions)`
- `setMovementConfig(config: Partial<PlayerConfig>)`
- `setLookSensitivity(value: number)`
- `setMaxPitch(value: number)`
- `setLookAngles(yaw: number, pitch?: number)`
- `setSprintMultiplier(value: number)`
- `setFieldOfView(value: number)`
- `setPointerLockEnabled(enabled: boolean)`
- `setAutoPointerLock(enabled: boolean)`
- `setKeyBindings(bindings: KeyBindingsOverrides)`
- `setPointerLockChangeCallback(callback?: (locked: boolean) => void)`
- `setPointerLockToggleCallback(callback?: (locked: boolean) => void)`
- `setLookChangeCallback(callback?: (yaw: number, pitch: number) => void)`
- `setJumpCallback(callback?: () => void)`
- `lockPointer()`, `unlockPointer()`, `isPointerLocked()`
- `getHeight(): number`
- `getState(): Readonly<ControllerState>`
- `applyToCamera(camera: THREE.PerspectiveCamera, options?: { includePosition?: boolean })`
- `enableCrouch(enabled: boolean)`
- `setCrouch(enabled: boolean)`
- `getDebugInfo()`
- `dispose()`

### LookController methods (look-only)

- `update()`
- `setLookAngles(yaw: number, pitch?: number)`
- `setLookSensitivity(value: number)`
- `setMaxPitch(value: number)`
- `setFieldOfView(value: number)`
- `setPointerLockEnabled(enabled: boolean)`
- `setAutoPointerLock(enabled: boolean)`
- `setPointerLockChangeCallback(callback?: (locked: boolean) => void)`
- `setPointerLockToggleCallback(callback?: (locked: boolean) => void)`
- `setLookChangeCallback(callback?: (yaw: number, pitch: number) => void)`
- `lockPointer()`, `unlockPointer()`, `isPointerLocked()`
- `getAngles(): { yaw: number; pitch: number }`
- `applyToCamera(camera: THREE.PerspectiveCamera, options?: { includePosition?: boolean })`
- `dispose()`

### Options & callbacks

`LookControllerOptions`:
- `element` (required) – DOM element to focus and lock.
- `lookSensitivity`, `maxPitch`, `fieldOfView`
- `enablePointerLock`, `autoPointerLock`
- `onPointerLockChange`, `onPointerLockToggle`, `onLookChange`

`FirstPersonControllerOptions` extend `LookControllerOptions`:
- Movement: `height`, `moveSpeed`, `jumpSpeed`, `gravity`, `sprintMultiplier`, `initialPosition`
- Input: `keyBindings`
- Physics hooks: `gravityFn`, `groundCheckFn`
- Crouch: `enableCrouch`, `crouchHeight`, `crouchSpeedMultiplier`
- Ground/steps: `maxStepHeight`, `maxSlopeAngle`
- Mode: `lookOnly` (skips position/velocity updates)
- Events: `onJump`

### Exported types

- `PlayerConfig`
- `KeyBindings`, `KeyBindingsOverrides`
- `FirstPersonControllerOptions`, `LookControllerOptions`, `LookChangeCallback`
- `ControllerState`
- `GravityFn`
- `GroundCheckFn`, `MovementAction`

## Building & Publishing

- `npm run build` compiles the TypeScript source to `dist/` and produces declaration files.
- `npm run test` executes the Vitest suite (JS DOM environment) covering the controller and input utilities.
- `npm run lint` runs ESLint (with TypeScript + Prettier integration) across the source and demo.
- `npm run format` applies Prettier formatting to the repo.
- `npm run release` uses `standard-version` to bump package versions and update `CHANGELOG.md`.
- `npm run setup:hooks` installs the Husky git hooks (pre-commit runs lint + test).
- `npm publish --access public` (after running `npm run build`) will distribute the package to the npm registry.
- To cut an automated release, trigger the `Release` GitHub workflow (it runs lint/test/build and `npm run release`, then pushes the new tag for you). Publishing to npm can also be fully automated by configuring a repo secret named `NPM_TOKEN`; the `Publish` workflow runs automatically whenever a GitHub Release is published.

## Contributing

Contributions are welcome! If you spot a bug or want to add a feature:

1. Fork the repository and create a branch for your change.
2. Run `npm install` to grab dependencies.
3. Use `npm run lint`, `npm run test`, and `npm run dev` to verify your changes locally.
4. Open a pull request describing the motivation and any relevant screenshots/demo steps.

For larger enhancements, consider opening an issue first so we can discuss the approach.

## License

MIT © Andre Glegg
