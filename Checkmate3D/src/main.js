import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';

// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111111);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(6, 10, 10);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ 
  canvas: document.querySelector('canvas.threejs'),
  antialias: true
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.minDistance = 8;
controls.maxDistance = 15;
controls.maxPolarAngle = Math.PI / 2.2;

// Lighting
const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
directionalLight.position.set(10, 15, 10);
directionalLight.castShadow = true;
scene.add(directionalLight);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
scene.add(ambientLight);

const backLight = new THREE.DirectionalLight(0xffffff, 0.5);
backLight.position.set(-10, 5, -10);
scene.add(backLight);

// Game state
const squares = [];
const pieces = [];
let selectedPiece = null;
let animationState = null;

// Chessboard creation
const createChessboard = () => {
  const loader = new GLTFLoader();
  loader.load('assets/models/chess_board.glb', (gltf) => {
    gltf.scene.scale.set(0.5, 0.5, 0.5);
    gltf.scene.position.set(0, -0.3, 0);

    gltf.scene.traverse((child) => {
      if (child.isMesh) {
        child.receiveShadow = true;
        child.castShadow = true;
        if (child.userData.square) squares.push(child);
      }
    });

    scene.add(gltf.scene);
  }, undefined, (error) => {
    console.error('Error loading chessboard:', error);
  });
};

// Piece creation
const createPiece = (type, color, position) => {
  const loader = new GLTFLoader();
  const formattedType = type.charAt(0).toUpperCase() + type.slice(1);
  const filename = `assets/models/Pieces/${color}${formattedType}.glb`;

  loader.load(filename, (gltf) => {
    const model = gltf.scene;
    model.position.set(position.x, 0, position.z);
    model.userData = { 
      type,
      color,
      originalY: 0,
      position: { x: position.x, z: position.z }
    };

    model.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        child.userData.originalEmissive = child.material.emissive.clone();
        child.userData.originalEmissiveIntensity = child.material.emissiveIntensity;
      }
    });

    scene.add(model);
    pieces.push(model);
  });
};

// Initial piece placement
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
  for (let i = 0; i < 8; i++) {
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
  for (let i = 0; i < 8; i++) {
    createPiece('pawn', 'black', { x: i - 3.5, z: 2.5 });
  }
};

// Selection handling
const selectPiece = (piece) => {
  selectedPiece = piece;
  piece.position.y += 0.2;
  piece.userData.originalY = piece.position.y;

  piece.traverse((child) => {
    if (child.isMesh) {
      child.material.emissive.set(0x0000ff).multiplyScalar(2);
      child.material.needsUpdate = true;
    }
  });
};

const deselectPiece = () => {
  if (!selectedPiece) return;

  selectedPiece.position.y = selectedPiece.userData.originalY;
  selectedPiece.traverse((child) => {
    if (child.isMesh) {
      child.material.emissive.copy(child.userData.originalEmissive);
      child.material.emissiveIntensity = child.userData.originalEmissiveIntensity;
      child.material.needsUpdate = true;
    }
  });
  selectedPiece = null;
};

// Interaction handling
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

window.addEventListener('click', (event) => {
  if (animationState) return;

  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);

  const pieceIntersects = raycaster.intersectObjects(pieces, true);
  const squareIntersects = raycaster.intersectObjects(squares);

  if (selectedPiece) {
    if (pieceIntersects.length > 0) {
      const clickedPiece = pieceIntersects[0].object.parent;
      if (clickedPiece === selectedPiece) {
        deselectPiece();
      } else if (clickedPiece.userData.color === selectedPiece.userData.color) {
        deselectPiece();
        selectPiece(clickedPiece);
      }
    } else if (squareIntersects.length > 0) {
      const targetSquare = squareIntersects[0].object;
      animationState = {
        piece: selectedPiece,
        start: new THREE.Vector3().copy(selectedPiece.position),
        end: new THREE.Vector3(
          targetSquare.position.x,
          selectedPiece.userData.originalY,
          targetSquare.position.z
        ),
        startTime: Date.now()
      };
    }
  } else if (pieceIntersects.length > 0) {
    selectPiece(pieceIntersects[0].object.parent);
  }
});

// Animation loop
const animate = () => {
  controls.update();

  if (animationState) {
    const progress = Math.min((Date.now() - animationState.startTime) / 1000, 1);
    animationState.piece.position.lerpVectors(
      animationState.start,
      animationState.end,
      progress
    );

    if (progress === 1) {
      animationState.piece.userData.position = {
        x: animationState.end.x,
        z: animationState.end.z
      };
      deselectPiece();
      animationState = null;
    }
  }

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
};

// Initial setup
createChessboard();
placePieces();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();