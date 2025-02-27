import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';

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

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.minDistance = 8;
controls.maxDistance = 15;
controls.maxPolarAngle = Math.PI / 2.2;

const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
directionalLight.position.set(10, 15, 10);
directionalLight.castShadow = true;
scene.add(directionalLight);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
scene.add(ambientLight);

const backLight = new THREE.DirectionalLight(0xffffff, 0.5);
backLight.position.set(-10, 5, -10);
scene.add(backLight);

const squares = [];
const pieces = [];
let selectedPiece = null;
let animationState = null;

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

const getSquareName = (position) => {
  const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];

  const fileIndex = Math.round(position.x + 3.5);
  const rankIndex = Math.round(position.z + 3.5);

  if (fileIndex >= 0 && fileIndex < 8 && rankIndex >= 0 && rankIndex < 8) {
    return files[fileIndex] + ranks[rankIndex];
  } else {
    return null;
  }
};

const createPiece = (type, color, position) => {
  const loader = new GLTFLoader();
  const formattedType = type.charAt(0).toUpperCase() + type.slice(1);
  const filename = `assets/models/Pieces/${color}${formattedType}.glb`;

  loader.load(filename, (gltf) => {
    const model = gltf.scene;
    model.position.set(position.x, 0, position.z);

    const squareName = getSquareName(position);

    model.userData = { 
      type,
      color,
      originalY: 0,
      position: { x: position.x, z: position.z },
      name: `${color} ${type} ${squareName}`
    };

    model.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        child.userData.originalEmissive = child.material.emissive.clone();
        child.userData.originalEmissiveIntensity = child.material.emissiveIntensity;
        
        if (color === "white") {
          child.material.color.set(0xffffff);
          child.material.metalness = 0.2;
          child.material.roughness = 0.1;
        } else if (color === "black") {
          child.material.color.set(0x6b6b6b);
          child.material.metalness = 0.5;
          child.material.roughness = 0.1;
        }
      }
    });

    scene.add(model);
    pieces.push(model);
  });
};

const placePieces = () => {
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
};

const selectPiece = (piece) => {
  console.log('Selected Piece:', piece.userData.name);
  
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
  selectedPiece.position.y -= 0.2;
  selectedPiece.traverse((child) => {
    if (child.isMesh) {
      child.material.emissive.copy(child.userData.originalEmissive);
      child.material.emissiveIntensity = child.userData.originalEmissiveIntensity;
      child.material.needsUpdate = true;
    }
  });
  selectedPiece = null;
};

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
      const squareName = getSquareName(targetSquare.position);
      console.log('Clicked Square:', squareName);
      
      const targetPosition = new THREE.Vector3(targetSquare.position.x, selectedPiece.position.y, targetSquare.position.z);

      animationState = {
        piece: selectedPiece,
        start: selectedPiece.position.clone(),
        end: targetPosition,
        startTime: Date.now()
      };

      selectedPiece.userData.position = { x: targetPosition.x, z: targetPosition.z };
      deselectPiece(); 
    }
  } else if (pieceIntersects.length > 0) {
    const clickedPiece = pieceIntersects[0].object.parent;
    console.log('Clicked Piece:', clickedPiece.userData.name);
    selectPiece(clickedPiece);
  }
});

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

      animationState.piece.position.y -= 0.2;

      deselectPiece();
      animationState = null; 
    }
  }

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
};


createChessboard();
placePieces();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

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
        roughness: 0.7  
      });

      const square = new THREE.Mesh(geometry, material);
      square.position.set(x - 3.52, height, z - 3.5);
      square.receiveShadow = true;
      
      const squareName = `${files[x]}${ranks[z]}`;
      square.userData.name = squareName;
      squares.push(square);
      scene.add(square);
    }
  }
};

createUnderChessboard();

animate();