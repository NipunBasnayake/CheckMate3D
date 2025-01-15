import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry';

// Scene and Camera
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(6, 10, 10);
camera.lookAt(0, 0, 0);

const canvas = document.querySelector('canvas.threejs');
const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.minDistance = 8; 
controls.maxDistance = 15; 
controls.maxPolarAngle = Math.PI / 2.2; 

// Light
const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
directionalLight.position.set(10, 15, 10);
directionalLight.castShadow = true;
scene.add(directionalLight);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
scene.add(ambientLight);

// Chessboard
const createChessboard = () => {
  const tileSize = 1;
  const boardSize = 8;

  const baseGeometry = new THREE.BoxGeometry(boardSize + 2, 0.5, boardSize + 2);
  const baseMaterial = new THREE.MeshStandardMaterial({
    color: 0x444444,
    roughness: 0.5,
    metalness: 0.2,
  });
  const base = new THREE.Mesh(baseGeometry, baseMaterial);
  base.position.y = -0.25;
  scene.add(base);

  for (let row = 0; row < boardSize; row++) {
    for (let col = 0; col < boardSize; col++) {
      const isWhite = (row + col) % 2 === 0;
      const color = isWhite ? 0xf0d9b5 : 0xb58863; // Lichess-like colors

      const tileGeometry = new THREE.BoxGeometry(tileSize, 0.1, tileSize);
      const tileMaterial = new THREE.MeshStandardMaterial({
        color: color,
        roughness: 0.3,
        metalness: 0.1,
      });
      const tile = new THREE.Mesh(tileGeometry, tileMaterial);

      tile.position.set(col - boardSize / 2 + 0.5, 0, row - boardSize / 2 + 0.5);
      scene.add(tile);
    }
  }
};

// Letters and Numbers
const addLabels = () => {
  const fontLoader = new FontLoader();
  fontLoader.load('https://threejs.org/examples/fonts/helvetiker_regular.typeface.json', (font) => {
    const textMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });

    for (let i = 0; i < 8; i++) {
      const letter = String.fromCharCode(97 + i);

      const textGeometryBottom = new TextGeometry(letter, {
        font: font,
        size: 0.15,
        height: 0.01,
      });
      const textMeshBottom = new THREE.Mesh(textGeometryBottom, textMaterial);
      textMeshBottom.position.set(i - 3.5, 0, -4.25);
      textMeshBottom.rotation.x = -Math.PI / 2;
      scene.add(textMeshBottom);

      const textGeometryTop = new TextGeometry(letter, {
        font: font,
        size: 0.15,
        height: 0.01,
      });
      const textMeshTop = new THREE.Mesh(textGeometryTop, textMaterial);
      textMeshTop.position.set(i - 3.5, 0, 4.35);
      textMeshTop.rotation.x = -Math.PI / 2;
      scene.add(textMeshTop);
    }

    for (let i = 0; i < 8; i++) {
      const number = (8 - i).toString();

      const textGeometryLeft = new TextGeometry(number, {
        font: font,
        size: 0.15,
        height: 0.01,
      });
      const textMeshLeft = new THREE.Mesh(textGeometryLeft, textMaterial);
      textMeshLeft.position.set(-4.35, 0, i - 3.5);
      textMeshLeft.rotation.x = -Math.PI / 2;
      scene.add(textMeshLeft);

      const textGeometryRight = new TextGeometry(number, {
        font: font,
        size: 0.15,
        height: 0.01,
      });
      const textMeshRight = new THREE.Mesh(textGeometryRight, textMaterial);
      textMeshRight.position.set(4.25, 0, i - 3.5);
      textMeshRight.rotation.x = -Math.PI / 2;
      scene.add(textMeshRight);
    }
  });
};

createChessboard();
addLabels();

const backgroundTexture = new THREE.TextureLoader().load(
  'https://via.placeholder.com/512x512.png?text=GradientBackground'
);
scene.background = backgroundTexture;

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
