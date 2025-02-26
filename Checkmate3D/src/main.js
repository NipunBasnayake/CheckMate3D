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
const pieceScale = new THREE.Vector3(1.6, 1.6, 1.6);

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
  const loader = new GLTFLoader();
  const formattedType = type === 'pawn' ? 'Pawn' : 
                      type === 'knight' ? 'Knight' :
                      type === 'bishop' ? 'Bishop' :
                      type === 'rook' ? 'Rook' :
                      type === 'queen' ? 'Queen' :
                      'King';
  
  const filename = `assets/models/Pieces/${color}${formattedType}.glb`;

  loader.load(filename, (gltf) => {
    const model = gltf.scene;
    model.position.set(position.x, 0, position.z);
    model.scale.copy(pieceScale);
    
    model.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        child.userData = { root: model, type, color };
      }
    });

    model.userData = { type, color };
    scene.add(model);
    pieces.push(model);
  }, undefined, (error) => {
    console.error(`Error loading ${color} ${type}:`, error);
  });
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
      const newPosition = { x: square.position.x, z: square.position.z };

      selectedPiece.position.set(newPosition.x, 0, newPosition.z);
      createPathHighlight(selectedPiece.position, newPosition);
      selectedPiece = null;
    }
  } else {
    const intersects = raycaster.intersectObjects(pieces, true);
    if (intersects.length > 0) {
      const clickedObject = intersects[0].object;
      if (clickedObject.userData.root) {
        selectedPiece = clickedObject.userData.root;
        console.log(`Selected piece: ${selectedPiece.userData.type}`);
      }
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