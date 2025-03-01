import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';

const loadingScreen = document.getElementById("loading-screen");
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111111);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ 
  canvas: document.querySelector('canvas.threejs'),
  antialias: true
});
const controls = new OrbitControls(camera, renderer.domElement);
const squares = [];
const pieces = [];
let selectedPiece = null;
let animationState = null;
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const loader = new GLTFLoader();
const HIGHLIGHT_COLOR = new THREE.Color(0xffff00);
const HIGHLIGHT_INTENSITY = 0.5;

// Initialize scene
camera.position.set(6, 10, 10);
camera.lookAt(0, 0, 0);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;

// Configure controls
controls.enableDamping = true;
controls.minDistance = 8;
controls.maxDistance = 15;
controls.maxPolarAngle = Math.PI / 2.2;

// Lighting setup
const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
directionalLight.position.set(10, 15, 10);
directionalLight.castShadow = true;
scene.add(directionalLight);

scene.add(new THREE.AmbientLight(0xffffff, 0.4));
scene.add(new THREE.DirectionalLight(0xffffff, 0.5).position.set(-10, 5, -10));

// Movement validation functions
const isValidPawnMove = (piece, currentPos, targetPos, dx, dz, targetPiece) => {
  const color = piece.userData.color;
  const direction = color === 'white' ? -1 : 1;
  // FIX 2: Correct initial position check
  const initialZ = color === 'white' ? 2.5 : -2.5;
  const isInitialMove = currentPos.z === initialZ;

  // Forward movement
  if (dx === 0) {
    if (dz === direction && !targetPiece) return true;
    if (dz === 2 * direction && isInitialMove) {
      const intermediatePos = { 
        x: currentPos.x, 
        z: currentPos.z + direction 
      };
      return !getPieceAtPosition(intermediatePos) && !targetPiece;
    }
  } 
  // Diagonal capture
  else if (Math.abs(dx) === 1 && dz === direction) {
    return !!targetPiece && targetPiece.userData.color !== color;
  }
  return false;
};

const isValidKnightMove = (dx, dz) => {
  return (Math.abs(dx) === 2 && Math.abs(dz) === 1) || 
         (Math.abs(dx) === 1 && Math.abs(dz) === 2);
};

const isValidBishopMove = (dx, dz) => Math.abs(dx) === Math.abs(dz);
const isValidRookMove = (dx, dz) => dx === 0 || dz === 0;
const isValidQueenMove = (dx, dz) => isValidBishopMove(dx, dz) || isValidRookMove(dx, dz);
const isValidKingMove = (dx, dz) => Math.abs(dx) <= 1 && Math.abs(dz) <= 1;

const isPathClear = (currentPos, targetPos) => {
  const dx = targetPos.x - currentPos.x;
  const dz = targetPos.z - currentPos.z;
  const steps = Math.max(Math.abs(dx), Math.abs(dz));
  const stepX = dx / steps;
  const stepZ = dz / steps;

  for (let i = 1; i < steps; i++) {
    const checkPos = {
      x: currentPos.x + stepX * i,
      z: currentPos.z + stepZ * i
    };
    if (getPieceAtPosition(checkPos)) return false;
  }
  return true;
};

const getPieceAtPosition = (position) => {
  return pieces.find(piece => 
    Math.abs(piece.userData.position.x - position.x) < 0.1 && 
    Math.abs(piece.userData.position.z - position.z) < 0.1
  );
};

const isValidMove = (piece, targetPos) => {
  const currentPos = piece.userData.position;
  const dx = targetPos.x - currentPos.x;
  const dz = targetPos.z - currentPos.z;
  const targetPiece = getPieceAtPosition(targetPos);

  if (targetPiece?.userData.color === piece.userData.color) return false;

  switch (piece.userData.type) {
    case 'pawn': 
      return isValidPawnMove(piece, currentPos, targetPos, dx, dz, targetPiece);
    case 'knight': 
      return isValidKnightMove(dx, dz);
    case 'bishop': 
      return isValidBishopMove(dx, dz) && isPathClear(currentPos, targetPos);
    case 'rook': 
      return isValidRookMove(dx, dz) && isPathClear(currentPos, targetPos);
    case 'queen': 
      return isValidQueenMove(dx, dz) && isPathClear(currentPos, targetPos);
    case 'king': 
      return isValidKingMove(dx, dz);
    default: return false;
  }
};

// Loading functions
const loadChessboard = () => {
  return new Promise((resolve) => {
    loader.load('assets/models/chess_board.glb', (gltf) => {
      gltf.scene.scale.set(0.5, 0.5, 0.5);
      gltf.scene.position.set(0, -0.3, 0);
      gltf.scene.traverse(child => {
        if (child.isMesh) {
          child.receiveShadow = child.castShadow = true;
          if (child.userData.square) squares.push(child);
        }
      });
      scene.add(gltf.scene);
      resolve();
    }, undefined, error => console.error("Error loading chessboard:", error));
  });
};

// Piece creation
const createPiece = (type, color, position) => {
  loader.load(`assets/models/Pieces/${color}${type.charAt(0).toUpperCase() + type.slice(1)}.glb`, (gltf) => {
    const model = gltf.scene;
    model.position.set(position.x, 0, position.z);
    
    model.userData = {
      type, color,
      originalY: 0,
      position: { x: position.x, z: position.z },
      name: `${color} ${type} ${getSquareName(position)}`,
      hasMoved: false
    };

    model.traverse(child => {
      if (child.isMesh) {
        child.castShadow = child.receiveShadow = true;
        child.userData.originalEmissive = child.material.emissive.clone();
        child.userData.originalEmissiveIntensity = child.material.emissiveIntensity;
        child.material.color.set(color === "white" ? 0xffffff : 0x6b6b6b);
        child.material.metalness = color === "white" ? 0.2 : 0.5;
        child.material.roughness = 0.1;
      }
    });

    scene.add(model);
    pieces.push(model);
  });
};

// Game logic
const getSquareName = (position) => {
  const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];
  const fileIndex = Math.round(position.x + 3.5);
  const rankIndex = Math.round(position.z + 3.5);
  return files[fileIndex] + ranks[rankIndex];
};

const selectPiece = (piece) => {
  selectedPiece = piece;
  piece.position.y += 0.2;
  piece.userData.originalY = piece.position.y;

  highlightValidSquares(piece);

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
  selectedPiece.position.y -= 0.2;
  resetSquareHighlights();
  selectedPiece.traverse((child) => {
    if (child.isMesh) {
      child.material.emissive.copy(child.userData.originalEmissive);
      child.material.emissiveIntensity = child.userData.originalEmissiveIntensity;
      child.material.needsUpdate = true;
    }
  });
  selectedPiece = null;
};

const highlightValidSquares = (piece) => {
  squares.forEach(square => {
    const originalMaterial = square.material;
    
    if (!square.userData.originalEmissive) {
      square.userData.originalEmissive = originalMaterial.emissive.clone();
      square.userData.originalEmissiveIntensity = originalMaterial.emissiveIntensity;
    }

    if (isValidMove(piece, square.position)) {
      originalMaterial.emissive = HIGHLIGHT_COLOR;
      originalMaterial.emissiveIntensity = HIGHLIGHT_INTENSITY;
    } else {
      originalMaterial.emissive.copy(square.userData.originalEmissive);
      originalMaterial.emissiveIntensity = square.userData.originalEmissiveIntensity;
    }
    originalMaterial.needsUpdate = true;
  });
};

const resetSquareHighlights = () => {
  squares.forEach(square => {
    if (square.userData.originalEmissive) {
      square.material.emissive.copy(square.userData.originalEmissive);
      square.material.emissiveIntensity = square.userData.originalEmissiveIntensity;
      square.material.needsUpdate = true;
    }
  });
};

// Event handlers
window.addEventListener('click', (event) => {
  if (animationState) return;

  mouse.set(
    (event.clientX / window.innerWidth) * 2 - 1,
    -(event.clientY / window.innerHeight) * 2 + 1
  );
  raycaster.setFromCamera(mouse, camera);

  const pieceIntersects = raycaster.intersectObjects(pieces, true);
  const squareIntersects = raycaster.intersectObjects(squares);

  if (selectedPiece) {
    if (pieceIntersects.length > 0) {
      const clickedPiece = pieceIntersects[0].object.parent;
      if (clickedPiece === selectedPiece) deselectPiece();
      else if (clickedPiece.userData.color === selectedPiece.userData.color) {
        deselectPiece();
        selectPiece(clickedPiece);
      }
    } 
    else if (squareIntersects.length > 0) {
      const targetSquare = squareIntersects[0].object;
      if (isValidMove(selectedPiece, targetSquare.position)) {
        const targetPiece = getPieceAtPosition(targetSquare.position);
        if (targetPiece) {
          scene.remove(targetPiece);
          pieces.splice(pieces.indexOf(targetPiece), 1);
        }

        animationState = {
          piece: selectedPiece,
          start: selectedPiece.position.clone(),
          end: new THREE.Vector3().copy(targetSquare.position).setY(selectedPiece.position.y),
          startTime: Date.now()
        };

        selectedPiece.userData.position = { 
          x: targetSquare.position.x, 
          z: targetSquare.position.z 
        };
        selectedPiece.userData.hasMoved = true;
        deselectPiece();
      }
    }
  } 
  else if (pieceIntersects.length > 0) {
    selectPiece(pieceIntersects[0].object.parent);
  }
});

// Animation loop
const animate = () => {
  controls.update();
  if (animationState) {
    const progress = Math.min((Date.now() - animationState.startTime) / 500, 1);
    animationState.piece.position.lerpVectors(
      animationState.start,
      animationState.end,
      progress
    );
    if (progress === 1) {
      animationState.piece.position.y -= 0.2;
      animationState = null;
    }
  }
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
};

// Initialization
loadingScreen.style.display = "flex";
loadChessboard().then(() => {
  createUnderChessboard();
  placePieces();
  loadingScreen.style.display = "none";
  animate();
});

// Helper functions
function placePieces() {
  createPiece('rook', 'black', { x: -3.5, z: -3.5 });
  createPiece('knight', 'black', { x: -2.5, z: -3.5 });
  createPiece('bishop', 'black', { x: -1.5, z: -3.5 });
  createPiece('queen', 'black', { x: -0.5, z: -3.5 });
  createPiece('king', 'black', { x: 0.5, z: -3.5 });
  createPiece('bishop', 'black', { x: 1.5, z: -3.5 });
  createPiece('knight', 'black', { x: 2.5, z: -3.5 });
  createPiece('rook', 'black', { x: 3.5, z: -3.5 });
  for (let i = 0; i < 8; i++) {
    createPiece('pawn', 'black', { x: i - 3.5, z: -2.5 });
  }

  createPiece('rook', 'white', { x: -3.5, z: 3.5 });
  createPiece('knight', 'white', { x: -2.5, z: 3.5 });
  createPiece('bishop', 'white', { x: -1.5, z: 3.5 });
  createPiece('queen', 'white', { x: -0.5, z: 3.5 });
  createPiece('king', 'white', { x: 0.5, z: 3.5 });
  createPiece('bishop', 'white', { x: 1.5, z: 3.5 });
  createPiece('knight', 'white', { x: 2.5, z: 3.5 });
  createPiece('rook', 'white', { x: 3.5, z: 3.5 });
  for (let i = 0; i < 8; i++) {
    createPiece('pawn', 'white', { x: i - 3.5, z: 2.5 });
  }
}

const createUnderChessboard = () => {
  const size = 1;
  const height = -0.07;
  const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];

  for (let x = 0; x < 8; x++) {
    for (let z = 0; z < 8; z++) {
      const isDarkSquare = (x + z) % 2 !== 0;
      const color = isDarkSquare ? 0x222222 : 0xffffff;

      const geometry = new THREE.BoxGeometry(size, 0.1, size);
      const material = new THREE.MeshStandardMaterial({ 
        color, 
        metalness: 0.7,
        roughness: 0.7,
        emissive: new THREE.Color(0x000000), // Initialize emissive
        emissiveIntensity: 0
      });

      const square = new THREE.Mesh(geometry, material);
      square.position.set(x - 3.5, height, z - 3.5);
      square.receiveShadow = true;
      
      // Store original emissive properties
      square.userData.originalEmissive = material.emissive.clone();
      square.userData.originalEmissiveIntensity = material.emissiveIntensity;

      const squareName = `${files[x]}${ranks[z]}`;
      square.userData.name = squareName;
      squares.push(square);
      scene.add(square);
    }
  }
};

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});