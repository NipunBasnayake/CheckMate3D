import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry';

// Scene, Camera, and Renderer
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(6, 10, 10);
camera.lookAt(0, 0, 0);

const canvas = document.querySelector('canvas.threejs');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);

// Orbit Controls
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.minDistance = 8;
controls.maxDistance = 15;
controls.maxPolarAngle = Math.PI / 2.2;

// Lights
const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(10, 15, 10);
directionalLight.castShadow = true;
scene.add(directionalLight);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
scene.add(ambientLight);

// Chessboard Configuration
const squares = [];
const boardSize = 8;

const createChessboard = () => {
  const tileSize = 1;

  // Board Base
  const baseGeometry = new THREE.BoxGeometry(boardSize + 2, 0.5, boardSize + 2);
  const baseMaterial = new THREE.MeshStandardMaterial({
    color: 0x444444,
    roughness: 0.5,
    metalness: 0.2,
  });
  const base = new THREE.Mesh(baseGeometry, baseMaterial);
  base.position.y = -0.25;
  scene.add(base);

  // Tiles
  for (let row = 0; row < boardSize; row++) {
    for (let col = 0; col < boardSize; col++) {
      const isWhite = (row + col) % 2 === 0;
      const color = isWhite ? 0xf0d9b5 : 0xb58863;

      const tileGeometry = new THREE.BoxGeometry(tileSize, 0.1, tileSize);
      const tileMaterial = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.3,
        metalness: 0.1,
      });
      const tile = new THREE.Mesh(tileGeometry, tileMaterial);

      tile.position.set(col - boardSize / 2 + 0.5, 0, row - boardSize / 2 + 0.5);
      tile.userData = { square: `${String.fromCharCode(97 + col)}${8 - row}` };
      scene.add(tile);
      squares.push(tile);
    }
  }
};

createChessboard();

// Add Letters and Numbers
const addLabels = () => {
  const loader = new FontLoader();
  loader.load('https://threejs.org/examples/fonts/helvetiker_regular.typeface.json', (font) => {
    const textMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const textSize = 0.2;

    for (let i = 0; i < boardSize; i++) {
      // Numbers (left and right)
      const numberGeometry = new TextGeometry(`${8 - i}`, {
        font,
        size: textSize,
        height: 0.05,
      });
      const numberMesh = new THREE.Mesh(numberGeometry, textMaterial);
      numberMesh.position.set(-boardSize / 2 - 0.8, 0.05, i - boardSize / 2 + 0.5);
      numberMesh.rotation.x = -Math.PI / 2;
      scene.add(numberMesh);

      const numberMeshRight = numberMesh.clone();
      numberMeshRight.position.x = boardSize / 2 + 0.3;
      scene.add(numberMeshRight);

      // Letters (top and bottom)
      const letterGeometry = new TextGeometry(String.fromCharCode(97 + i), {
        font,
        size: textSize,
        height: 0.05,
      });
      const letterMesh = new THREE.Mesh(letterGeometry, textMaterial);
      letterMesh.position.set(i - boardSize / 2 + 0.5, 0.05, -boardSize / 2 - 0.8);
      letterMesh.rotation.x = -Math.PI / 2;
      scene.add(letterMesh);

      const letterMeshTop = letterMesh.clone();
      letterMeshTop.position.z = boardSize / 2 + 0.3;
      scene.add(letterMeshTop);
    }
  });
};

addLabels();

// Load Pieces
const pieces = [];
let selectedPiece = null;
const loader = new FBXLoader();

const loadPiece = (fileName, color, position) => {
  loader.load(`Chess/${fileName}`, (object) => {
    object.traverse((child) => {
      if (child.isMesh) {
        child.material.color.set(color === 'white' ? 0xffffff : 0x000000);
      }
    });

    object.scale.set(0.17, 0.17, 0.17);
    object.position.set(position.x, 0, position.z);
    object.userData = { color, type: fileName.split('.')[0] }; // Metadata
    scene.add(object);
    pieces.push(object);
  });
};

// Place all pieces
const initialPositions = [
  { file: 'Rook.fbx', color: 'white', x: -3.5, z: -3.5 },
  { file: 'Knight.fbx', color: 'white', x: -2.5, z: -3.5 },
  { file: 'Bishop.fbx', color: 'white', x: -1.5, z: -3.5 },
  { file: 'Queen.fbx', color: 'white', x: -0.5, z: -3.5 },
  { file: 'King.fbx', color: 'white', x: 0.5, z: -3.5 },
  { file: 'Bishop.fbx', color: 'white', x: 1.5, z: -3.5 },
  { file: 'Knight.fbx', color: 'white', x: 2.5, z: -3.5 },
  { file: 'Rook.fbx', color: 'white', x: 3.5, z: -3.5 },
  { file: 'Pawn.fbx', color: 'white', x: -3.5, z: -2.5 },
];

initialPositions.forEach((pos) => {
  loadPiece(pos.file, pos.color, { x: pos.x, z: pos.z });
});

// Mouse Interaction Logic
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

const onMouseClick = (event) => {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);

  if (selectedPiece) {
    const intersects = raycaster.intersectObjects(squares);
    if (intersects.length > 0) {
      const square = intersects[0].object;
      selectedPiece.position.set(square.position.x, 0, square.position.z);
      selectedPiece = null;
    }
  } else {
    const intersects = raycaster.intersectObjects(pieces);
    if (intersects.length > 0) {
      selectedPiece = intersects[0].object;
    }
  }
};

window.addEventListener('click', onMouseClick);

// Render Loop
const renderLoop = () => {
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(renderLoop);
};

// Handle Resizing
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

renderLoop();
