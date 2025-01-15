import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(4, 8, 8);
camera.lookAt(0, 0, 0);

const canvas = document.querySelector('canvas.threejs');
const renderer = new THREE.WebGLRenderer({ canvas: canvas });
renderer.setSize(window.innerWidth, window.innerHeight);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;

const light = new THREE.PointLight(0xffffff, 1, 100);
light.position.set(5, 10, 5);
scene.add(light);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
scene.add(ambientLight);

const createChessboard = () => {
  const tileSize = 1;
  const boardSize = 8;

  for (let row = 0; row < boardSize; row++) {
    for (let col = 0; col < boardSize; col++) {
      const isWhite = (row + col) % 2 === 0;
      const color = isWhite ? 0xffffff : 0x000000;

      const tileGeometry = new THREE.BoxGeometry(tileSize, 0.1, tileSize);
      const tileMaterial = new THREE.MeshStandardMaterial({ color });
      const tile = new THREE.Mesh(tileGeometry, tileMaterial);

      tile.position.set(col - boardSize / 2 + 0.5, 0, row - boardSize / 2 + 0.5);
      scene.add(tile);
    }
  }
};

createChessboard();

const renderloop = () => {
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(renderloop);
};

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

renderloop();
