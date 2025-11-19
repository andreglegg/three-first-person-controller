# three-first-person-controller

Lightweight first-person movement controller for Three.js scenes. Handles pointer lock, WASD movement, jumping, and gravity so you can focus on building the rest of your experience.

## Installation

```bash
npm install three-first-person-controller three
```

`three` is declared as a peer dependency, so ensure it is installed in your project.

## Usage

```ts
import * as THREE from "three";
import { FirstPersonController } from "three-first-person-controller";

const renderer = new THREE.WebGLRenderer({ canvas: document.querySelector("canvas")! });
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

const controller = new FirstPersonController(camera, renderer.domElement);
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

## Configuration

Supply an options object to customize physics, pointer lock behavior, and key bindings. Every option is optional.

```ts
const controller = new FirstPersonController(camera, renderer.domElement, {
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
  onPointerLockChange: (locked) => console.log("pointer lock?", locked),
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
controller.dispose(); // remove all DOM listeners when tearing down the scene

// Need the current camera baseline height (e.g. for HUDs)?:
controller.getHeight();
```

## Test Scene

Run the included demo scene to try out the controller before publishing:

```bash
npm install
npm run dev
```

This starts a Vite dev server that serves the files in `demo/`. The scene includes three focused test zones (obstacle field, jump course, sprint lane) plus a live HUD so you can validate pointer lock, strafing, jumping, and sprint speed tweaks from the console. Use `npm run demo:build` to produce a static build (output in `dist-demo/`) and `npm run demo:preview` to serve that build.

## Architecture

The source is organized with explicit layers so you can extend or replace pieces as needed:

- `src/types.ts` centralizes all shared interfaces (config, bindings, options) and is re-exported from the package entry point.
- `src/constants.ts` defines the immutable defaults for physics tuning and input, making it easy to build variant controllers without touching logic.
- `src/input/KeyboardControls.ts` and `src/input/PointerLockManager.ts` encapsulate DOM interactions (keyboard listeners and pointer-lock lifecycle), keeping `FirstPersonController` focused on simulation.
- `src/FirstPersonController.ts` wires the input helpers into the movement integrator that mutates the `THREE.PerspectiveCamera`.
- TypeScript runs in strict mode with additional flags (`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, etc.), so keep everything strongly typed and avoid implicit `any`/`null` usages.

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
