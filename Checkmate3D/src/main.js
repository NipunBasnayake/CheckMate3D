import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';

// Preallocate reused objects
const tempVec3 = new THREE.Vector3();
const tempPos = { x: 0, z: 0 };
const materialCache = {
    dark: new THREE.MeshStandardMaterial({ 
        color: 0x222222, 
        metalness: 0.7,
        roughness: 0.7,
        emissive: new THREE.Color(0x000000),
        emissiveIntensity: 0
    }),
    light: new THREE.MeshStandardMaterial({ 
        color: 0xffffff, 
        metalness: 0.7,
        roughness: 0.7,
        emissive: new THREE.Color(0x000000),
        emissiveIntensity: 0
    })
};
const squareGeometry = new THREE.BoxGeometry(1, 0.1, 1);

// Shared variables
const files = ['a','b','c','d','e','f','g','h'];
const ranks = ['8','7','6','5','4','3','2','1'];
const pieceData = {
    black: [
        ['rook', -3.5, -3.5], ['knight', -2.5, -3.5], ['bishop', -1.5, -3.5],
        ['queen', -0.5, -3.5], ['king', 0.5, -3.5], ['bishop', 1.5, -3.5],
        ['knight', 2.5, -3.5], ['rook', 3.5, -3.5]
    ],
    white: [
        ['rook', -3.5, 3.5], ['knight', -2.5, 3.5], ['bishop', -1.5, 3.5],
        ['queen', -0.5, 3.5], ['king', 0.5, 3.5], ['bishop', 1.5, 3.5],
        ['knight', 2.5, 3.5], ['rook', 3.5, 3.5]
    ]
};

// Scene setup
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
const HIGHLIGHT_INTENSITY = 0.3;

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
    const initialZ = color === 'white' ? 2.5 : -2.5;
    const isInitialMove = currentPos.z === initialZ;

    if (dx === 0) {
        if (dz === direction && !targetPiece) return true;
        if (dz === 2 * direction && isInitialMove) {
            tempPos.x = currentPos.x;
            tempPos.z = currentPos.z + direction;
            return !getPieceAtPosition(tempPos) && !targetPiece;
        }
    } else if (Math.abs(dx) === 1 && dz === direction) {
        return !!targetPiece && targetPiece.userData.color !== color;
    }
    return false;
};

const isValidKnightMove = (dx, dz) => (Math.abs(dx) === 2 && Math.abs(dz) === 1) || (Math.abs(dx) === 1 && Math.abs(dz) === 2);
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
        tempPos.x = currentPos.x + stepX * i;
        tempPos.z = currentPos.z + stepZ * i;
        if (getPieceAtPosition(tempPos)) return false;
    }
    return true;
};

const getPieceAtPosition = position => {
    for (let i = pieces.length - 1; i >= 0; i--) {
        const piece = pieces[i];
        if (Math.abs(piece.userData.position.x - position.x) < 0.1 && 
            Math.abs(piece.userData.position.z - position.z) < 0.1) {
            return piece;
        }
    }
    return null;
};

const isValidMove = (piece, targetPos) => {
    const currentPos = piece.userData.position;
    const dx = targetPos.x - currentPos.x;
    const dz = targetPos.z - currentPos.z;
    const targetPiece = getPieceAtPosition(targetPos);

    if (targetPiece?.userData.color === piece.userData.color) return false;

    switch (piece.userData.type) {
        case 'pawn': return isValidPawnMove(piece, currentPos, targetPos, dx, dz, targetPiece);
        case 'knight': return isValidKnightMove(dx, dz);
        case 'bishop': return isValidBishopMove(dx, dz) && isPathClear(currentPos, targetPos);
        case 'rook': return isValidRookMove(dx, dz) && isPathClear(currentPos, targetPos);
        case 'queen': return isValidQueenMove(dx, dz) && isPathClear(currentPos, targetPos);
        case 'king': return isValidKingMove(dx, dz);
        default: return false;
    }
};

// Loading functions
const loadChessboard = () => {
    return new Promise((resolve, reject) => {
        loader.load('assets/models/chess_board.glb', (gltf) => {
            console.log("Chessboard loaded successfully!");
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
        }, undefined, (error) => {
            console.error("Error loading chessboard:", error);
            reject(error);
        });
    });
};

// Piece creation
const createPiece = (type, color, position) => {
    return new Promise((resolve, reject) => {
        const formattedType = type.charAt(0).toUpperCase() + type.slice(1);
        const filename = `assets/models/Pieces/${color}${formattedType}.glb`;

        loader.load(filename, (gltf) => {
            console.log(`Piece ${color} ${type} loaded successfully!`);
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
            resolve();
        }, undefined, (error) => {
            console.error(`Error loading piece ${color} ${type}:`, error);
            reject(error);
        });
    });
};

// Game logic
const getSquareName = (position) => {
    const fileIndex = Math.round(position.x + 3.5);
    const rankIndex = Math.round(position.z + 3.5);
    return files[fileIndex] + ranks[rankIndex];
};

const selectPiece = (piece) => {
  selectedPiece = piece;
  piece.position.y += 0.2;
  piece.userData.originalY = piece.position.y;

  console.log(`Selected piece: ${piece.userData.name}`); // Debug log
  highlightValidSquares(piece); // Ensure this is called

  piece.traverse((child) => {
      if (child.isMesh) {
          child.material.emissive.set(0x0000ff).multiplyScalar(2);
          child.material.needsUpdate = true;
      }
  });
};

const deselectPiece = () => {
  if (!selectedPiece) return;

  console.log("Deselecting piece"); // Debug log
  resetSquareHighlights(); // Ensure this is called

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
const highlightValidSquares = (piece) => {
  console.log("Highlighting valid squares for:", piece.userData.name); // Debug log

  for (let i = 0; i < squares.length; i++) {
      const square = squares[i];
      const mat = square.material;

      // Store original emissive properties if not already stored
      if (!square.userData.originalEmissive) {
          square.userData.originalEmissive = mat.emissive.clone();
          square.userData.originalEmissiveIntensity = mat.emissiveIntensity;
      }

      // Check if the square is a valid move
      if (isValidMove(piece, square.position)) {
          console.log(`Valid square: ${square.userData.name}`); // Debug log
          mat.emissive = HIGHLIGHT_COLOR;
          mat.emissiveIntensity = HIGHLIGHT_INTENSITY;
      } else {
          mat.emissive.copy(square.userData.originalEmissive);
          mat.emissiveIntensity = square.userData.originalEmissiveIntensity;
      }
      mat.needsUpdate = true;
  }
};

const resetSquareHighlights = () => {
  console.log("Resetting square highlights"); // Debug log

  for (let i = 0; i < squares.length; i++) {
      const square = squares[i];
      const mat = square.material;

      if (square.userData.originalEmissive) {
          mat.emissive.copy(square.userData.originalEmissive);
          mat.emissiveIntensity = square.userData.originalEmissiveIntensity;
          mat.needsUpdate = true;
      }
  }
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
        } else if (squareIntersects.length > 0) {
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
    } else if (pieceIntersects.length > 0) {
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
loadChessboard()
    .then(() => {
        createUnderChessboard();
        return Promise.all([
            ...pieceData.black.map(([type, x, z]) => createPiece(type, 'black', { x, z })),
            ...pieceData.white.map(([type, x, z]) => createPiece(type, 'white', { x, z })),
            ...Array.from({ length: 8 }, (_, i) => createPiece('pawn', 'black', { x: i - 3.5, z: -2.5 })),
            ...Array.from({ length: 8 }, (_, i) => createPiece('pawn', 'white', { x: i - 3.5, z: 2.5 }))
        ]);
    })
    .then(() => {
        console.log("All assets loaded successfully!");
        loadingScreen.style.display = "none";
        animate();
    })
    .catch((error) => {
        console.error("Error loading assets:", error);
        loadingScreen.textContent = "Failed to load assets. Please check the console for details.";
    });

const createUnderChessboard = () => {
  const height = -0.07;
  for (let x = 0; x < 8; x++) {
      for (let z = 0; z < 8; z++) {
          const isDarkSquare = (x + z) % 2 !== 0;
          const color = isDarkSquare ? 0x222222 : 0xffffff;

          const material = new THREE.MeshStandardMaterial({ 
              color, 
              metalness: 0.7,
              roughness: 0.7,
              emissive: new THREE.Color(0x000000), 
              emissiveIntensity: 0 
          });

          const square = new THREE.Mesh(squareGeometry, material);
          square.position.set(x - 3.5, height, z - 3.5);
          square.receiveShadow = true;
          
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