import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(6, 10, 10);
camera.lookAt(0, 0, 0);

const canvas = document.querySelector('canvas.threejs');
const renderer = new THREE.WebGLRenderer({ 
  canvas, 
  antialias: true,
  powerPreference: "high-performance"
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.minDistance = 8;
controls.maxDistance = 15;
controls.maxPolarAngle = Math.PI / 2.2;

// Lighting setup
const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
directionalLight.position.set(10, 15, 10);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 2048;
directionalLight.shadow.mapSize.height = 2048;
scene.add(directionalLight);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
scene.add(ambientLight);

const backLight = new THREE.DirectionalLight(0xffffff, 0.5);
backLight.position.set(-10, 5, -10);
scene.add(backLight);

// Game state
const boardSize = 8;
const squares = [];
const pieces = [];
let selectedPiece = null;
const paths = [];
const pieceModels = { white: {}, black: {} };

// Load assets
const loadAssets = async () => {
  await loadChessboard();
  await loadChessPieces();
};

const loadChessboard = () => {
  return new Promise((resolve) => {
    const loader = new GLTFLoader();
    loader.load('assets/models/chess_board.glb', (gltf) => {
      gltf.scene.traverse((child) => {
        if (child.isMesh) {
          child.receiveShadow = true;
          child.castShadow = true;
          if (child.userData.square) {
            squares.push(child);
          }
          child.material.roughness = 0.3;
          child.material.metalness = 0.2;
        }
      });
      scene.add(gltf.scene);
      resolve();
    });
  });
};

const loadChessPieces = () => {
  return new Promise((resolve) => {
    const loader = new GLTFLoader();
    loader.load('assets/models/chess_pieces.glb', (gltf) => {
      const scale = 0.8;
      
      gltf.scene.traverse((child) => {
        if (child.isMesh) {
          const [color, type] = child.name.toLowerCase().split('_');
          if (color && pieceModels[color] && type) {
            child.castShadow = true;
            child.receiveShadow = true;
            
            // Store original model
            pieceModels[color][type] = child.clone();
            
            // Enhance materials
            child.material = new THREE.MeshStandardMaterial({
              color: color === 'white' ? 0xeeeeee : 0x222222,
              roughness: 0.3,
              metalness: 0.2
            });
          }
        }
      });
      resolve();
    });
  });
};

// Piece management
const createPiece = (type, color, position) => {
  const model = pieceModels[color][type];
  if (!model) {
    console.error(`Missing model for ${color} ${type}`);
    return null;
  }

  const piece = model.clone();
  piece.position.set(position.x, 0.35, position.z);
  piece.scale.set(0.8, 0.8, 0.8);
  piece.rotation.y = Math.PI;
  piece.userData = { type, color, originalPosition: position };
  piece.castShadow = true;
  pieces.push(piece);
  scene.add(piece);
  return piece;
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
  
  // White pawns
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
  
  // Black pawns
  for (let i = 0; i < boardSize; i++) {
    createPiece('pawn', 'black', { x: i - 3.5, z: 2.5 });
  }
};

// Interaction
const createPathHighlight = (start, end) => {
  paths.forEach(path => scene.remove(path));
  paths.length = 0;

  const geometry = new THREE.BufferGeometry();
  const vertices = new Float32Array([
    start.x, 0.05, start.z, 
    end.x, 0.05, end.z
  ]);
  geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  const material = new THREE.LineBasicMaterial({ color: 0x00ff00, linewidth: 2 });
  const pathLine = new THREE.Line(geometry, material);
  scene.add(pathLine);
  paths.push(pathLine);
};

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
      const newPosition = { 
        x: square.position.x, 
        y: 0.35,
        z: square.position.z 
      };
      
      createPathHighlight(selectedPiece.position, newPosition);
      selectedPiece.position.copy(newPosition);
      selectedPiece = null;
    }
  } else {
    const intersects = raycaster.intersectObjects(pieces);
    if (intersects.length > 0) {
      selectedPiece = intersects[0].object;
      selectedPiece.material.emissive.setHex(0x444444);
      console.log(`Selected: ${selectedPiece.userData.color} ${selectedPiece.userData.type}`);
    }
  }
};

// Initialization
const init = async () => {
  scene.background = new THREE.Color(0x111111);
  await loadAssets();
  placePieces();
  window.addEventListener('click', onMouseClick);
};

// Render loop
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

init().then(() => {
  renderLoop();
});