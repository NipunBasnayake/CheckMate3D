import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry';
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
scene.add(directionalLight);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
scene.add(ambientLight);

const squares = [];
const boardSize = 8;

const createChessboard = () => {
  const tileSize = 1;

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

const addLabels = () => {
  const fontLoader = new FontLoader();
  fontLoader.load('https://threejs.org/examples/fonts/helvetiker_regular.typeface.json', (font) => {
    const textMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });

    for (let i = 0; i < 8; i++) {
      const letter = String.fromCharCode(97 + i);

      const createText = (text, x, z) => {
        const textGeometry = new TextGeometry(text, {
          font,
          size: 0.2,
          height: 0.02,
          bevelEnabled: true,
          bevelThickness: 0.01,
          bevelSize: 0.005,
        });
        const textMesh = new THREE.Mesh(textGeometry, textMaterial);
        textMesh.position.set(x, 0.01, z);
        textMesh.rotation.x = -Math.PI / 2;
        scene.add(textMesh);
      };

      createText(letter, i - 3.5, -4.5); 
      createText(letter, i - 3.5, 4.5); 

      const number = (8 - i).toString();
      createText(number, -4.5, i - 3.5); 
      createText(number, 4.5, i - 3.5);  
    }
  });
};

createChessboard();
addLabels();

scene.background = new THREE.Color(0x888888);

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

const onMouseClick = (event) => {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);

  const intersects = raycaster.intersectObjects(squares);
  if (intersects.length > 0) {
    const clickedSquare = intersects[0].object.userData.square;
    console.log(`Square clicked: ${clickedSquare}`);
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

const pieces = [];

const createPiece = (type, color, position) => {
  let geometry;
  const material = new THREE.MeshStandardMaterial({
    color: color === 'white' ? 0xffffff : 0x000000,
    roughness: 0.4,
    metalness: 0.1,
  });

  switch (type) {
    case 'pawn':
      geometry = new THREE.CylinderGeometry(0.3, 0.3, 1, 32);
      break;
    case 'rook':
      geometry = new THREE.CylinderGeometry(0.4, 0.4, 1.2, 32);
      break;
    case 'knight':
      geometry = new THREE.CylinderGeometry(0.35, 0.35, 1, 32);
      break;
    case 'bishop':
      geometry = new THREE.CylinderGeometry(0.35, 0.35, 1.2, 32);
      break;
    case 'queen':
      geometry = new THREE.CylinderGeometry(0.5, 0.4, 1.5, 32);
      break;
    case 'king':
      geometry = new THREE.CylinderGeometry(0.5, 0.4, 1.6, 32);
      break;
    default:
      geometry = new THREE.CylinderGeometry(0.3, 0.3, 1, 32);
  }

  const piece = new THREE.Mesh(geometry, material);
  piece.position.set(position.x, 0.5, position.z);
  scene.add(piece);
  pieces.push(piece);
};

const placePieces = () => {
  const pieceSetup = [
    { type: 'rook', color: 'black', position: { x: -3.5, z: -3.5 } },
    { type: 'knight', color: 'black', position: { x: -2.5, z: -3.5 } },
    { type: 'bishop', color: 'black', position: { x: -1.5, z: -3.5 } },
    { type: 'queen', color: 'black', position: { x: -0.5, z: -3.5 } },
    { type: 'king', color: 'black', position: { x: 0.5, z: -3.5 } },
    { type: 'bishop', color: 'black', position: { x: 1.5, z: -3.5 } },
    { type: 'knight', color: 'black', position: { x: 2.5, z: -3.5 } },
    { type: 'rook', color: 'black', position: { x: 3.5, z: -3.5 } },
    { type: 'pawn', color: 'black', position: { x: -3.5, z: -2.5 } },
    { type: 'pawn', color: 'black', position: { x: -2.5, z: -2.5 } },
    { type: 'pawn', color: 'black', position: { x: -1.5, z: -2.5 } },
    { type: 'pawn', color: 'black', position: { x: -0.5, z: -2.5 } },
    { type: 'pawn', color: 'black', position: { x: 0.5, z: -2.5 } },
    { type: 'pawn', color: 'black', position: { x: 1.5, z: -2.5 } },
    { type: 'pawn', color: 'black', position: { x: 2.5, z: -2.5 } },
    { type: 'pawn', color: 'black', position: { x: 3.5, z: -2.5 } },

    { type: 'rook', color: 'white', position: { x: -3.5, z: 3.5 } },
    { type: 'knight', color: 'white', position: { x: -2.5, z: 3.5 } },
    { type: 'bishop', color: 'white', position: { x: -1.5, z: 3.5 } },
    { type: 'queen', color: 'white', position: { x: -0.5, z: 3.5 } },
    { type: 'king', color: 'white', position: { x: 0.5, z: 3.5 } },
    { type: 'bishop', color: 'white', position: { x: 1.5, z: 3.5 } },
    { type: 'knight', color: 'white', position: { x: 2.5, z: 3.5 } },
    { type: 'rook', color: 'white', position: { x: 3.5, z: 3.5 } },
    { type: 'pawn', color: 'white', position: { x: -3.5, z: 2.5 } },
    { type: 'pawn', color: 'white', position: { x: -2.5, z: 2.5 } },
    { type: 'pawn', color: 'white', position: { x: -1.5, z: 2.5 } },
    { type: 'pawn', color: 'white', position: { x: -0.5, z: 2.5 } },
    { type: 'pawn', color: 'white', position: { x: 0.5, z: 2.5 } },
    { type: 'pawn', color: 'white', position: { x: 1.5, z: 2.5 } },
    { type: 'pawn', color: 'white', position: { x: 2.5, z: 2.5 } },
    { type: 'pawn', color: 'white', position: { x: 3.5, z: 2.5 } },
  ];

  pieceSetup.forEach(({ type, color, position }) => {
    createPiece(type, color, position);
  });
};

placePieces();

renderLoop();
