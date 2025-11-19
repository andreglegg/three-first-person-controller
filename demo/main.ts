import "./style.css";
import * as THREE from "three";
import { FirstPersonController } from "three-first-person-controller";

const TEST_COLORS = {
  background: 0x03060f,
  ground: 0x0c101f,
  grid: 0x1c2942,
  highlight: 0x73a7ff,
  obstacle: 0x142134,
  jump: 0x712ff0,
  sprint: 0xffffff,
  checkpointA: 0x2de1c2,
  checkpointB: 0xffc857,
  checkpointC: 0xff7b89,
};

const canvas = document.querySelector<HTMLCanvasElement>("#scene");
if (!canvas) {
  throw new Error("Canvas element #scene not found.");
}

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.shadowMap.enabled = true;
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(TEST_COLORS.background);

const scene = new THREE.Scene();
scene.background = new THREE.Color(TEST_COLORS.background);
scene.fog = new THREE.Fog(TEST_COLORS.background, 40, 140);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 200);

const controller = new FirstPersonController(camera, renderer.domElement, {
  moveSpeed: 6,
  jumpSpeed: 9,
  gravity: 25,
  sprintMultiplier: 1.8,
  fieldOfView: 80,
  onPointerLockChange: (locked) => {
    document.body.style.cursor = locked ? "none" : "crosshair";
    statusElements.pointerLock.textContent = locked ? "Locked" : "Free";
  },
});

const statusElements = {
  speed: document.querySelector<HTMLElement>("[data-speed]"),
  grounded: document.querySelector<HTMLElement>("[data-grounded]"),
  pointerLock: document.querySelector<HTMLElement>("[data-pointer-lock]"),
};

if (!statusElements.speed || !statusElements.grounded || !statusElements.pointerLock) {
  throw new Error("Overlay status elements missing.");
}

const clock = new THREE.Clock();
const previousPosition = camera.position.clone();
const tempPosition = new THREE.Vector3();
const checkpointSpheres: THREE.Mesh[] = [];
const labelSprites: Array<{ sprite: THREE.Sprite; baseY: number }> = [];
const obstaclePillars: THREE.Mesh[] = [];
let sprintScanner: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial> | undefined;

initializeScene();
animate();

function initializeScene(): void {
  addBaseEnvironment();
  createObstacleField();
  createJumpCourse();
  createSprintLane();
  handleResize();
  window.addEventListener("resize", handleResize);
  window.addEventListener("beforeunload", cleanupScene);
}

function addBaseEnvironment(): void {
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(240, 240),
    new THREE.MeshStandardMaterial({
      color: TEST_COLORS.ground,
      roughness: 0.95,
      metalness: 0.1,
    }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const grid = new THREE.GridHelper(220, 80, TEST_COLORS.highlight, TEST_COLORS.grid);
  const gridMaterials = Array.isArray(grid.material) ? grid.material : [grid.material];
  gridMaterials.forEach((material) => {
    if (material instanceof THREE.LineBasicMaterial) {
      material.opacity = 0.15;
      material.transparent = true;
      material.depthWrite = false;
    }
  });
  scene.add(grid);

  const ambient = new THREE.HemisphereLight(0x6e9eff, 0x05070f, 0.5);
  const keyLight = new THREE.DirectionalLight(0xfff2d5, 1.15);
  keyLight.position.set(10, 18, -6);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048, 2048);
  keyLight.shadow.bias = -0.001;
  scene.add(ambient, keyLight);
}

function createObstacleField(): void {
  const geometry = new THREE.CylinderGeometry(0.4, 0.4, 1.3, 16);
  const positions = [
    [-4, 10],
    [-2, 11],
    [0, 9],
    [2, 12],
    [4, 10],
    [-3, 13],
    [3, 8],
    [1, 12],
  ];

  positions.forEach(([x, z], index) => {
    const material = new THREE.MeshStandardMaterial({
      color: TEST_COLORS.obstacle,
      emissive: TEST_COLORS.highlight,
      emissiveIntensity: 0.4 + (index % 3) * 0.2,
      roughness: 0.4,
      metalness: 0.2,
    });
    const pillar = new THREE.Mesh(geometry, material);
    pillar.position.set(x, 0.65, z);
    pillar.castShadow = true;
    pillar.receiveShadow = true;
    scene.add(pillar);
    obstaclePillars.push(pillar);
  });

  createLabel("Obstacle Field", new THREE.Vector3(-6, 3, 14));
}

function createJumpCourse(): void {
  const basePosition = new THREE.Vector3(5, 0, 2);
  const platformMaterial = new THREE.MeshStandardMaterial({
    color: 0x15192c,
    emissive: TEST_COLORS.jump,
    emissiveIntensity: 0.6,
    roughness: 0.35,
  });

  for (let i = 0; i < 5; i += 1) {
    const height = 0.3 + i * 0.2;
    const platform = new THREE.Mesh(
      new THREE.BoxGeometry(1.8 - i * 0.15, height, 1.8),
      platformMaterial.clone(),
    );
    platform.position.set(basePosition.x + i * 1.4, height / 2, basePosition.z - i * 1.3);
    platform.castShadow = true;
    platform.receiveShadow = true;
    scene.add(platform);
  }

  createCheckpoint(new THREE.Vector3(11, 0.4, -2), TEST_COLORS.checkpointB);
  createLabel("Jump Course", new THREE.Vector3(8, 3, 4));
}

function createSprintLane(): void {
  const track = new THREE.Mesh(
    new THREE.PlaneGeometry(6, 32),
    new THREE.MeshStandardMaterial({
      color: 0x12172c,
      emissive: 0x0b0f1e,
      emissiveIntensity: 0.8,
      roughness: 0.25,
      metalness: 0.4,
    }),
  );
  track.rotation.x = -Math.PI / 2;
  track.position.set(0, 0.02, -22);
  track.receiveShadow = true;
  scene.add(track);

  const lineMaterial = new THREE.MeshBasicMaterial({
    color: TEST_COLORS.sprint,
    transparent: true,
    opacity: 0.35,
    side: THREE.DoubleSide,
  });

  const startLine = new THREE.Mesh(new THREE.PlaneGeometry(6, 0.3), lineMaterial);
  startLine.rotation.x = -Math.PI / 2;
  startLine.position.set(0, 0.03, -8);

  const finishLine = new THREE.Mesh(new THREE.PlaneGeometry(6, 0.3), lineMaterial);
  finishLine.rotation.x = -Math.PI / 2;
  finishLine.position.set(0, 0.03, -36);

  scene.add(startLine, finishLine);

  sprintScanner = new THREE.Mesh(
    new THREE.RingGeometry(1.6, 1.9, 64),
    new THREE.MeshBasicMaterial({
      color: TEST_COLORS.checkpointA,
      transparent: true,
      opacity: 0.25,
      side: THREE.DoubleSide,
    }),
  );
  sprintScanner.rotation.x = -Math.PI / 2;
  sprintScanner.position.set(0, 0.25, -30);
  scene.add(sprintScanner);

  createCheckpoint(new THREE.Vector3(0, 0.35, -16), TEST_COLORS.checkpointA);
  createCheckpoint(new THREE.Vector3(0, 0.35, -24), TEST_COLORS.checkpointB);
  createCheckpoint(new THREE.Vector3(0, 0.35, -32), TEST_COLORS.checkpointC);

  createLabel("Sprint Lane", new THREE.Vector3(0, 3.2, -14));
}

function createCheckpoint(position: THREE.Vector3, color: number): void {
  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(0.35, 24, 24),
    new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 1.2,
      transparent: true,
      opacity: 0.9,
    }),
  );
  sphere.position.copy(position);
  sphere.castShadow = true;
  scene.add(sphere);
  checkpointSpheres.push(sphere);

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.12, 0.1, 12),
    new THREE.MeshStandardMaterial({
      color: 0x070a12,
      emissive: color,
      emissiveIntensity: 0.2,
    }),
  );
  base.position.set(position.x, 0.05, position.z);
  base.receiveShadow = true;
  scene.add(base);
}

function createLabel(text: string, position: THREE.Vector3): void {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.fillStyle = "rgba(4, 7, 18, 0.8)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#7fc3ff";
  ctx.font = "bold 70px 'Inter', 'Segoe UI', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  const spriteMaterial = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(spriteMaterial);
  sprite.position.copy(position);
  sprite.scale.set(6, 2.5, 1);
  scene.add(sprite);
  labelSprites.push({ sprite, baseY: position.y });
}

function animate(): void {
  const delta = clock.getDelta();
  const elapsed = clock.getElapsedTime();

  controller.update(delta);
  updateStatus(delta);

  obstaclePillars.forEach((pillar, index) => {
    const material = pillar.material as THREE.MeshStandardMaterial;
    material.emissiveIntensity = 0.5 + Math.sin(elapsed * 2 + index) * 0.2;
  });

  checkpointSpheres.forEach((sphere, index) => {
    const scale = 1 + Math.sin(elapsed * 2.5 + index) * 0.08;
    sphere.scale.setScalar(scale);
  });

  labelSprites.forEach(({ sprite, baseY }, index) => {
    sprite.position.y = baseY + Math.sin(elapsed * 0.9 + index) * 0.1;
  });

  if (sprintScanner) {
    sprintScanner.rotation.z += delta * 0.9;
    sprintScanner.material.opacity = 0.2 + Math.sin(elapsed * 2) * 0.05;
  }

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

function updateStatus(delta: number): void {
  tempPosition.copy(camera.position);
  const distance = tempPosition.distanceTo(previousPosition);
  const speed = delta > 0 ? distance / delta : 0;
  statusElements.speed.textContent = `${speed.toFixed(2)} m/s`;

  const grounded = camera.position.y <= controller.getHeight() + 0.01;
  statusElements.grounded.textContent = grounded ? "Yes" : "Airborne";
  statusElements.pointerLock.textContent = controller.isPointerLocked() ? "Locked" : "Free";

  previousPosition.copy(tempPosition);
}

function handleResize(): void {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function cleanupScene(): void {
  window.removeEventListener("resize", handleResize);
  window.removeEventListener("beforeunload", cleanupScene);
  controller.dispose();
}

const hot = (import.meta as ImportMeta & { hot?: { dispose(cb: () => void): void } }).hot;
if (hot) {
  hot.dispose(() => {
    cleanupScene();
  });
}
