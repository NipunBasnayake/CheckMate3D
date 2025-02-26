import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(6, 10, 10);
camera.lookAt(0, 0, 0);

const canvas = document.querySelector('canvas.threejs');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.minDistance = 8;
controls.maxDistance = 15;
controls.maxPolarAngle = Math.PI / 2.2;

const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(10, 15, 10);
directionalLight.castShadow = true;
directionalLight.color.set(0xffffff);
directionalLight.intensity = 1.5;
scene.add(directionalLight);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
ambientLight.intensity = 0.2;
scene.add(ambientLight);

// Add backlight to create board outline
const backLight = new THREE.DirectionalLight(0xffffff, 0.5);
backLight.position.set(-10, 5, -10);
scene.add(backLight);

const squares = [];
const boardSize = 8;

const createChessboard = () => {
  const loader = new GLTFLoader();
  loader.load('assets/models/chess_board.glb', (gltf) => {
    gltf.scene.traverse((child) => {
      if (child.isMesh) {
        child.receiveShadow = true;
        child.castShadow = true;
        
        // Enhance material properties for better color vibrancy
        if (child.material) {
          child.material.roughness = 0.3;
          child.material.metalness = 0.2;
          child.material.needsUpdate = true;
        }

        if (child.userData.square) {
          squares.push(child);
        }
      }
    });
    scene.add(gltf.scene);
  }, undefined, (error) => {
    console.error('Error loading chessboard:', error);
  });
};

createChessboard();
scene.background = new THREE.Color(0x111111);

const pieces = [];
let selectedPiece = null;
const paths = [];

const createPathHighlight = (start, end) => {
  const geometry = new THREE.BufferGeometry();
  const vertices = new Float32Array([
    start.x, 0.05, start.z, 
    end.x, 0.05, end.z,   
  ]);
  geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  const material = new THREE.LineBasicMaterial({ color: 0xff0000, linewidth: 2 });
  const pathLine = new THREE.Line(geometry, material);
  scene.add(pathLine);
  paths.push(pathLine);
};

const createPiece = (type, color, position) => {
  let geometry;
  const material = new THREE.MeshStandardMaterial({
    color: color === 'white' ? 0xffffff : 0x000000,
    roughness: 0.4,
    metalness: 0.1,
  });

  switch (type) {
    case 'pawn':
      geometry = new THREE.CylinderGeometry(0.3, 0.3, 0.7, 32);
      break;
    case 'rook':
      geometry = new THREE.CylinderGeometry(0.4, 0.4, 1, 32);
      break;
    case 'knight':
      geometry = new THREE.CylinderGeometry(0.35, 0.35, 0.9, 32);
      break;
    case 'bishop':
      geometry = new THREE.CylinderGeometry(0.35, 0.35, 1, 32);
      break;
    case 'queen':
      geometry = new THREE.CylinderGeometry(0.5, 0.4, 1.3, 32);
      break;
    case 'king':
      geometry = new THREE.CylinderGeometry(0.5, 0.4, 1.4, 32);
      break;
    default:
      geometry = new THREE.CylinderGeometry(0.3, 0.3, 0.7, 32);
  }

  const piece = new THREE.Mesh(geometry, material);
  piece.position.set(position.x, 0.35, position.z);
  piece.userData = { type, color };
  scene.add(piece);
  pieces.push(piece);
};

const placePieces = () => {
  // White pieces
  createPiece('rook', 'white', { x: -3.5, z: -3.5 });
  createPiece('knight', 'white', { x: -2.5, z: -3.5 });
  createPiece('bishop', 'white', { x: -1.5, z: -3.5 });
  createPiece('queen', 'white', { x: -0.5, z: -3.5 });
  createPiece('king', 'white', { x: 0.5, z: -3.5 });
  createPiece('bishop', 'white', { x: 1.5, z: -3.5 });
  createPiece('knight', 'white', { x: 2.5, z: -3.5 });
  createPiece('rook', 'white', { x: 3.5, z: -3.5 });
  for (let i = 0; i < boardSize; i++) {
    createPiece('pawn', 'white', { x: i - 3.5, z: -2.5 });
  }

  // Black pieces
  createPiece('rook', 'black', { x: -3.5, z: 3.5 });
  createPiece('knight', 'black', { x: -2.5, z: 3.5 });
  createPiece('bishop', 'black', { x: -1.5, z: 3.5 });
  createPiece('queen', 'black', { x: -0.5, z: 3.5 });
  createPiece('king', 'black', { x: 0.5, z: 3.5 });
  createPiece('bishop', 'black', { x: 1.5, z: 3.5 });
  createPiece('knight', 'black', { x: 2.5, z: 3.5 });
  createPiece('rook', 'black', { x: 3.5, z: 3.5 });
  for (let i = 0; i < boardSize; i++) {
    createPiece('pawn', 'black', { x: i - 3.5, z: 2.5 });
  }
};

placePieces();

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

      const previousPosition = { x: selectedPiece.position.x, z: selectedPiece.position.z };
      const newPosition = { x: square.position.x, z: square.position.z };

      selectedPiece.position.set(newPosition.x, 0.35, newPosition.z);

      createPathHighlight(previousPosition, newPosition);

      selectedPiece = null;
    }
  } else {
    const intersects = raycaster.intersectObjects(pieces);
    if (intersects.length > 0) {
      selectedPiece = intersects[0].object;
      console.log(`Selected piece: ${selectedPiece.userData.type}`);
    }
  }
};

window.addEventListener('click', onMouseClick);

const renderLoop = () => {
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(renderLoop);
};

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

renderLoop();