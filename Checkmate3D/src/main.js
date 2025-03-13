import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';

// UI Elements
const welcomeScreen = document.getElementById('welcome-screen');
const loadingScreen = document.getElementById('loading-screen');
const loadingText = document.getElementById('loading-text');
let playerColor = 'white';
let currentTurn = 'white';
let moveCount = 1;

// Create game info div as full-height sidebar
const gameInfoDiv = document.createElement('div');
gameInfoDiv.id = 'game-info';
gameInfoDiv.innerHTML = `
    <div class="game-controls">
        <div id="turn-indicator">White's Turn</div>
        <div id="game-status"></div>

        <div id="captured-pieces">
            <div class="captured-pieces-label">White Captured Pieces:</div>
            <div id="white-captured"></div>
            <div class="captured-pieces-label">Black Captured Pieces:</div>
            <div id="black-captured"></div>
        </div>
        
        <div id="move-history">
            <h3>Move History</h3>
            <div id="moves-container"></div>
        </div>
        
        <div class="action-buttons">
            <button id="resign-button">Resign</button>
            <button id="new-game-button">New Game</button>
        </div>
    </div>
`;
document.body.appendChild(gameInfoDiv);
gameInfoDiv.style.display = 'none';

const turnIndicator = document.getElementById('turn-indicator');
const movesContainer = document.getElementById('moves-container');
const whiteCapturedDiv = document.getElementById('white-captured');
const blackCapturedDiv = document.getElementById('black-captured');
const gameStatusDiv = document.getElementById('game-status');
const resignButton = document.getElementById('resign-button');
const newGameButton = document.getElementById('new-game-button');

let gameActive = false;
let inCheck = false;
let checkmate = false;
let stalemate = false;
const capturedPieces = {
    white: [],
    black: []
};

// Track the last moved pawn for en passant
let lastMovedPawn = null;
let enPassantTarget = null;

document.getElementById('white-button').addEventListener('click', () => {
    playerColor = 'white';
    startGame();
});

document.getElementById('black-button').addEventListener('click', () => {
    playerColor = 'black';
    startGame();
});

resignButton.addEventListener('click', () => {
    if (!gameActive || checkmate || stalemate) return;

    gameActive = false;
    const winner = currentTurn === 'white' ? 'Black' : 'White';
    gameStatusDiv.textContent = `${winner} wins by resignation`;
    gameStatusDiv.style.color = '#ff6b6b';
});

newGameButton.addEventListener('click', () => {
    resetGame();
    welcomeScreen.style.display = 'flex';
    gameInfoDiv.style.display = 'none';
});

// Starts the game with selected color
function startGame() {
    welcomeScreen.style.display = 'none';
    loadingScreen.style.display = 'flex';
    gameInfoDiv.style.display = 'none';

    currentTurn = 'white';
    moveCount = 1;
    gameActive = true;
    inCheck = false;
    checkmate = false;
    stalemate = false;
    capturedPieces.white = [];
    capturedPieces.black = [];
    lastMovedPawn = null;
    enPassantTarget = null;

    turnIndicator.textContent = "White's Turn";
    movesContainer.innerHTML = '';
    whiteCapturedDiv.innerHTML = '';
    blackCapturedDiv.innerHTML = '';
    gameStatusDiv.textContent = '';

    initializeGame();
}

function resetGame() {
    while (scene.children.length > 0) {
        scene.remove(scene.children[0]);
    }

    squares.length = 0;
    pieces.length = 0;

    selectedPiece = null;
    animationState = null;
    lastMovedPawn = null;
    enPassantTarget = null;

    setupLighting();
}

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

// Sound effects
const audioListener = new THREE.AudioListener();
const audioLoader = new THREE.AudioLoader();
const sounds = {
    moveSound: new THREE.Audio(audioListener),
    captureSound: new THREE.Audio(audioListener),
    checkSound: new THREE.Audio(audioListener),
    invalidSound: new THREE.Audio(audioListener),
    castlingSound: new THREE.Audio(audioListener)
};

// Loads sound effects
function loadSounds() {
    loadingText.textContent = "Loading sound effects...";
    return new Promise((resolve) => {
        resolve();
    });
}

// Board Structure
const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];
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

const pieceValues = {
    pawn: 1,
    knight: 3,
    bishop: 3,
    rook: 5,
    queen: 9,
    king: 0
};

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111111);

const boardContainer = new THREE.Group();
scene.add(boardContainer);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.add(audioListener);

const canvas = document.querySelector('canvas.threejs');
if (!canvas) {
    console.error("No canvas element found with class 'threejs'");
}

const renderer = new THREE.WebGLRenderer({
    canvas: canvas,
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
const VALID_MOVE_COLOR = new THREE.Color(0x00ff00);
const CAPTURE_COLOR = new THREE.Color(0xff0000);
const CHECK_COLOR = new THREE.Color(0xff0000);
const CASTLING_COLOR = new THREE.Color(0x0088ff);
const EN_PASSANT_COLOR = new THREE.Color(0xff8800);
const HIGHLIGHT_INTENSITY = 0.3;

camera.position.set(0, 10, 10);
camera.lookAt(0, 0, 0);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// Camera controls
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.minDistance = 8;
controls.maxDistance = 15;
controls.maxPolarAngle = Math.PI / 2.2;
controls.autoRotate = false;
controls.autoRotateSpeed = 0.5;
controls.enablePan = false;

// Sets up lightins
function setupLighting() {
    scene.children.forEach(child => {
        if (child.isLight) scene.remove(child);
    });

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
    directionalLight.position.set(10, 15, 10);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 50;
    directionalLight.shadow.camera.left = -10;
    directionalLight.shadow.camera.right = 10;
    directionalLight.shadow.camera.top = 10;
    directionalLight.shadow.camera.bottom = -10;
    directionalLight.shadow.bias = -0.0005;
    scene.add(directionalLight);

    scene.add(new THREE.AmbientLight(0xffffff, 0.4));

    const fillLight = new THREE.DirectionalLight(0xffffff, 0.5);
    fillLight.position.set(-10, 5, -10);
    scene.add(fillLight);

    const cornerLights = [
        { pos: [-4, 1, -4], color: 0x6495ED, intensity: 0.5 },
        { pos: [4, 1, -4], color: 0x6495ED, intensity: 0.5 },
        { pos: [-4, 1, 4], color: 0x6495ED, intensity: 0.5 },
        { pos: [4, 1, 4], color: 0x6495ED, intensity: 0.5 }
    ];

    cornerLights.forEach(light => {
        const pointLight = new THREE.PointLight(light.color, light.intensity, 10);
        pointLight.position.set(...light.pos);
        scene.add(pointLight);
    });
}

// Rotates the board
function setBoardRotation() {
    if (playerColor === 'black') {
        boardContainer.rotation.y = Math.PI;
    } else {
        boardContainer.rotation.y = 0;
    }
}

// Validates pawn
const isValidPawnMove = (piece, currentPos, targetPos, dx, dz, targetPiece) => {
    const color = piece.userData.color;
    const direction = color === 'white' ? -1 : 1;
    const initialZ = color === 'white' ? 2.5 : -2.5;
    const isInitialMove = currentPos.z === initialZ;

    // Regular pawn moves
    if (dx === 0) {
        if (dz === direction && !targetPiece) return true;
        if (dz === 2 * direction && isInitialMove) {
            tempPos.x = currentPos.x;
            tempPos.z = currentPos.z + direction;
            return !getPieceAtPosition(tempPos) && !targetPiece;
        }
    } 
    // Diagonal captures
    else if (Math.abs(dx) === 1 && dz === direction) {
        // Regular capture
        if (targetPiece && targetPiece.userData.color !== color) return true;
        
        // En passant capture
        if (enPassantTarget && 
            Math.abs(enPassantTarget.x - targetPos.x) < 0.1 && 
            Math.abs(enPassantTarget.z - targetPos.z) < 0.1) {
            return true;
        }
    }
    return false;
};

// Validates knight
const isValidKnightMove = (dx, dz) => (Math.abs(dx) === 2 && Math.abs(dz) === 1) || (Math.abs(dx) === 1 && Math.abs(dz) === 2);

// Validates bishop
const isValidBishopMove = (dx, dz) => Math.abs(dx) === Math.abs(dz);

// Validates rook
const isValidRookMove = (dx, dz) => dx === 0 || dz === 0;

// Validates queen
const isValidQueenMove = (dx, dz) => isValidBishopMove(dx, dz) || isValidRookMove(dx, dz);

// Validates king
const isValidKingMove = (dx, dz) => Math.abs(dx) <= 1 && Math.abs(dz) <= 1;

// Handle castling move
const handleCastling = (king, targetPos) => {
    // Only allow castling if the king hasn't moved yet
    if (king.userData.hasMoved) return false;
    
    const color = king.userData.color;
    const startingRow = color === 'white' ? 3.5 : -3.5;
    
    // King must be on starting position
    if (king.userData.position.z !== startingRow || king.userData.position.x !== 0.5) return false;
    
    // Check if the king is in check
    if (isKingInCheck(color)) return false;
    
    // Determine if it's kingside or queenside castling
    const isKingside = targetPos.x > king.userData.position.x;
    const rookX = isKingside ? 3.5 : -3.5;
    
    // Find the correct rook
    const rook = pieces.find(piece => 
        piece.userData.type === 'rook' && 
        piece.userData.color === color && 
        piece.userData.position.x === rookX && 
        piece.userData.position.z === startingRow &&
        !piece.userData.hasMoved
    );
    
    // If no eligible rook found, castling is not possible
    if (!rook) return false;
    
    // Check if the path between king and rook is clear
    const direction = isKingside ? 1 : -1;
    const distance = isKingside ? 2 : 3;
    
    for (let i = 1; i <= distance; i++) {
        tempPos.x = king.userData.position.x + (i * direction);
        tempPos.z = startingRow;
        
        // Path must be clear
        if (getPieceAtPosition(tempPos)) return false;
        
        // For the squares the king moves through, check they're not under attack
        if (i <= 2) {
            king.userData.position = { x: tempPos.x, z: tempPos.z };
            const wouldBeCheck = isKingInCheck(color);
            king.userData.position = { x: 0.5, z: startingRow };
            
            if (wouldBeCheck) return false;
        }
    }
    
    // Perform the castling
    const kingNewX = isKingside ? 2.5 : -1.5;
    const rookNewX = isKingside ? 1.5 : -0.5;
    
    // Move the rook
    rook.userData.position = { x: rookNewX, z: startingRow };
    rook.userData.hasMoved = true;
    
    // Record the castling move
    const notation = isKingside ? "O-O" : "O-O-O";
    recordSpecialMove(notation, color);
    
    // Animate the rook move
    animationState = {
        piece: rook,
        startPos: new THREE.Vector3(rook.position.x, rook.position.y, rook.position.z),
        targetPos: new THREE.Vector3(rookNewX, rook.position.y, startingRow),
        progress: 0,
        duration: 500,
        startTime: Date.now(),
        captureOccurred: false,
        isCastling: true
    };
    
    // Return true to indicate successful castling
    return true;
};

// Record a special move (castling, etc) in the move history
const recordSpecialMove = (notation, color) => {
    if (color === 'white') {
        const moveRow = document.createElement('div');
        moveRow.className = 'move-row';
        moveRow.innerHTML = `
            <div class="move-entry">
                <span class="move-number">${moveCount}.</span>
                <span class="white-move">${notation}</span>
                <span class="black-move"></span>
            </div>
        `;
        movesContainer.appendChild(moveRow);
    } else {
        const moveRows = movesContainer.querySelectorAll('.move-entry');
        const lastRow = moveRows[moveRows.length - 1];
        if (lastRow) {
            lastRow.querySelector('.black-move').textContent = notation;
            moveCount++;
        }
    }
    
    movesContainer.scrollTop = movesContainer.scrollHeight;
};

// Perform the en passant capture
const handleEnPassantCapture = (piece, targetPos) => {
    if (!enPassantTarget) return false;
    
    if (Math.abs(enPassantTarget.x - targetPos.x) < 0.1 && 
        Math.abs(enPassantTarget.z - targetPos.z) < 0.1) {
        
        // Find and remove the pawn that's being captured
        const capturedPawnPos = { 
            x: targetPos.x, 
            z: piece.userData.position.z 
        };
        
        const capturedPawn = getPieceAtPosition(capturedPawnPos);
        if (capturedPawn && capturedPawn.userData.type === 'pawn') {
            capturedPieces[capturedPawn.userData.color].push(capturedPawn.userData.type);
            updateCapturedPiecesDisplay();
            
            boardContainer.remove(capturedPawn);
            const index = pieces.indexOf(capturedPawn);
            if (index > -1) {
                pieces.splice(index, 1);
            }
            
            return true;
        }
    }
    
    return false;
};

// Is path clear
const isPathClear = (currentPos, targetPos) => {
    const dx = targetPos.x - currentPos.x;
    const dz = targetPos.z - currentPos.z;
    const steps = Math.max(Math.abs(dx), Math.abs(dz));

    if (steps <= 1) return true; 

    const stepX = dx / steps;
    const stepZ = dz / steps;

    for (let i = 1; i < steps; i++) {
        tempPos.x = currentPos.x + stepX * i;
        tempPos.z = currentPos.z + stepZ * i;
        if (getPieceAtPosition(tempPos)) return false;
    }
    return true;
};

// If piece in selected position
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

// square
const getSquareAtPosition = position => {
    for (let i = 0; i < squares.length; i++) {
        const square = squares[i];
        if (Math.abs(square.position.x - position.x) < 0.1 &&
            Math.abs(square.position.z - position.z) < 0.1) {
            return square;
        }
    }
    return null;
};

// Check if castling is possible at the target position
const canCastleTo = (king, targetPos) => {
    if (king.userData.type !== 'king' || king.userData.hasMoved) return false;
    
    const kingPos = king.userData.position;
    const dx = targetPos.x - kingPos.x;
    
    // Must be horizontal movement of 2 squares
    if (Math.abs(dx) !== 2 || targetPos.z !== kingPos.z) return false;
    
    // Create a theoretical target for handleCastling
    return handleCastling(king, targetPos);
};

// Is given move valid
const isValidMove = (piece, targetPos) => {
    if (piece.userData.color !== currentTurn) return false;

    const currentPos = piece.userData.position;
    const dx = targetPos.x - currentPos.x;
    const dz = targetPos.z - currentPos.z;
    const targetPiece = getPieceAtPosition(targetPos);

    if (targetPiece?.userData.color === piece.userData.color) return false;

    // Check for castling
    if (piece.userData.type === 'king' && Math.abs(dx) === 2 && dz === 0) {
        return canCastleTo(piece, targetPos);
    }

    let isValid = false;
    switch (piece.userData.type) {
        case 'pawn': isValid = isValidPawnMove(piece, currentPos, targetPos, dx, dz, targetPiece); break;
        case 'knight': isValid = isValidKnightMove(dx, dz); break;
        case 'bishop': isValid = isValidBishopMove(dx, dz) && isPathClear(currentPos, targetPos); break;
        case 'rook': isValid = isValidRookMove(dx, dz) && isPathClear(currentPos, targetPos); break;
        case 'queen': isValid = isValidQueenMove(dx, dz) && isPathClear(currentPos, targetPos); break;
        case 'king': isValid = isValidKingMove(dx, dz); break;
        default: return false;
    }

    if (isValid) {
        return !wouldBeInCheck(piece, targetPos);
    }

    return false;
};

const findKing = (color) => {
    return pieces.find(piece => piece.userData.type === 'king' && piece.userData.color === color);
};

// King check?
const isKingInCheck = (color) => {
    const king = findKing(color);
    if (!king) return false;

    const kingPos = king.userData.position;

    return pieces.some(piece => {
        if (piece.userData.color === color) return false;

        const piecePos = piece.userData.position;
        const dx = kingPos.x - piecePos.x;
        const dz = kingPos.z - piecePos.z;

        switch (piece.userData.type) {
            case 'pawn':
                return Math.abs(dx) === 1 &&
                    ((piece.userData.color === 'white' && dz === -1) ||
                        (piece.userData.color === 'black' && dz === 1));
            case 'knight':
                return isValidKnightMove(dx, dz);
            case 'bishop':
                return isValidBishopMove(dx, dz) && isPathClear(piecePos, kingPos);
            case 'rook':
                return isValidRookMove(dx, dz) && isPathClear(piecePos, kingPos);
            case 'queen':
                return isValidQueenMove(dx, dz) && isPathClear(piecePos, kingPos);
            case 'king':
                return isValidKingMove(dx, dz);
            default:
                return false;
        }
    });
};

// Can king leave the check?
const wouldBeInCheck = (piece, targetPos) => {
    const originalPos = { ...piece.userData.position };
    const targetPiece = getPieceAtPosition(targetPos);
    let targetPieceIndex = -1;

    if (targetPiece) {
        targetPieceIndex = pieces.indexOf(targetPiece);
        pieces.splice(targetPieceIndex, 1);
    }

    piece.userData.position = { x: targetPos.x, z: targetPos.z };
    const isInCheck = isKingInCheck(piece.userData.color);
    piece.userData.position = originalPos;

    if (targetPiece && targetPieceIndex !== -1) {
        pieces.splice(targetPieceIndex, 0, targetPiece);
    }
    return isInCheck;
};

// is checkmate
const checkForCheckmate = (color) => {
    if (!isKingInCheck(color)) return false;

    for (const piece of pieces) {
        if (piece.userData.color !== color) continue;

        for (const square of squares) {
            if (isValidMove(piece, square.position)) {
                return false;
            }
        }
    }
    return true;
};

// is stalemate
const checkForStalemate = (color) => {
    if (isKingInCheck(color)) return false;

    for (const piece of pieces) {
        if (piece.userData.color !== color) continue;

        for (const square of squares) {
            if (isValidMove(piece, square.position)) {
                return false;
            }
        }
    }
    return true;
};

// Chessboard
const loadChessboard = () => {
    loadingText.textContent = "Creating chessboard...";
    return new Promise((resolve) => {
        const boardGroup = new THREE.Group();
        const boardGeometry = new THREE.BoxGeometry(8, 0.2, 8);
        const boardMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
        const board = new THREE.Mesh(boardGeometry, boardMaterial);
        board.receiveShadow = true;
        boardGroup.add(board);

        // Create squares on the board
        for (let x = -3.5; x <= 3.5; x++) {
            for (let z = -3.5; z <= 3.5; z++) {
                const isWhite = (Math.floor(x + 3.5) + Math.floor(z + 3.5)) % 2 === 0;
                const squareGeometry = new THREE.BoxGeometry(0.95, 0.1, 0.95);
                const squareMaterial = new THREE.MeshStandardMaterial({
                    color: isWhite ? 0xE8E8E8 : 0x303030,
                    emissive: new THREE.Color(0x000000)
                });

                const square = new THREE.Mesh(squareGeometry, squareMaterial);
                square.position.set(x, 0.2, z);
                square.receiveShadow = true;

                const fileIndex = Math.round(x + 3.5);
                const rankIndex = Math.round(z + 3.5);

                square.userData = {
                    square: true,
                    name: files[fileIndex] + ranks[rankIndex],
                    originalEmissive: new THREE.Color(0x000000),
                    originalEmissiveIntensity: 0
                };

                squares.push(square);
                boardGroup.add(square);
            }
        }

        boardContainer.add(boardGroup);
        resolve();
    });
};

// Creates a chess piece
const createPiece = (type, color, position) => {
    return new Promise((resolve) => {
        const modelName = `${color}${type.charAt(0).toUpperCase() + type.slice(1)}`;
        const modelPath = `assets/models/Pieces/${modelName}.glb`;

        const yPosition = 0.25;

        loader.load(
            modelPath,
            (gltf) => {
                const model = gltf.scene;
                model.castShadow = true;

                model.scale.set(0.85, 0.85, 0.85);
                model.position.set(position.x, yPosition, position.z);

                if (type === 'knight' && color === 'white') {
                    model.rotation.y = Math.PI; 
                }

                if (type === 'bishop' && color === 'white') {
                    model.rotation.y = Math.PI; 
                }

                if (type === 'king') {
                    model.rotation.y = Math.PI / 2;
                }

                model.userData = {
                    type, color,
                    originalY: yPosition, 
                    position: { x: position.x, z: position.z },
                    name: `${color} ${type} ${getSquareName(position)}`,
                    hasMoved: false
                };

                boardContainer.add(model);
                pieces.push(model);
                resolve();
            },
            (xhr) => {
                const percentComplete = (xhr.loaded / xhr.total) * 100;
                loadingText.textContent = `Loading ${color} ${type}: ${Math.round(percentComplete)}%`;
            },
            (error) => {
                fallbackToSimpleGeometry(type, color, position).then(resolve);
            }
        );
    });
};

const fallbackToSimpleGeometry = (type, color, position) => {
    return new Promise((resolve) => {
        let geometry;
        let height = 1;

        switch (type) {
            case 'pawn':
                geometry = new THREE.ConeGeometry(0.2, 0.5, 8);
                height = 0.5;
                break;
            case 'rook':
                geometry = new THREE.BoxGeometry(0.3, 0.7, 0.3);
                height = 0.7;
                break;
            case 'knight':
                geometry = new THREE.TorusGeometry(0.2, 0.1, 8, 12);
                height = 0.7;
                break;
            case 'bishop':
                geometry = new THREE.ConeGeometry(0.2, 0.8, 8);
                height = 0.8;
                break;
            case 'queen':
                geometry = new THREE.DodecahedronGeometry(0.3);
                height = 0.9;
                break;
            case 'king':
                geometry = new THREE.CylinderGeometry(0.2, 0.2, 1, 8);
                height = 1;
                break;
        }

        const material = new THREE.MeshStandardMaterial({
            color: color === 'white' ? 0xffffff : 0x303030,
            metalness: 0.5,
            roughness: 0.5,
            emissive: new THREE.Color(0x000000)
        });

        const model = new THREE.Mesh(geometry, material);
        model.castShadow = true;
        model.position.set(position.x, height / 2, position.z);

        model.userData = {
            type, color,
            originalY: height / 2,
            position: { x: position.x, z: position.z },
            name: `${color} ${type} ${getSquareName(position)}`,
            hasMoved: false
        };

        model.material.userData = {
            originalEmissive: new THREE.Color(0x000000),
            originalEmissiveIntensity: 0
        };

        boardContainer.add(model);
        pieces.push(model);
        resolve();
    });
};

const getSquareName = (position) => {
    const fileIndex = Math.round(position.x + 3.5);
    const rankIndex = Math.round(position.z + 3.5);

    if (fileIndex >= 0 && fileIndex < 8 && rankIndex >= 0 && rankIndex < 8) {
        return files[fileIndex] + ranks[rankIndex];
    }
    return "invalid";
};

const selectPiece = (piece) => {
    if (piece.userData.color !== currentTurn || !gameActive) {
        return;
    }

    if (selectedPiece) deselectPiece();

    selectedPiece = piece;

    if (!piece.userData.originalY) {
        piece.userData.originalY = piece.position.y;
    }

    piece.position.y += 0.2;

    const hasValidMoves = highlightValidMoves(piece);

    piece.traverse((child) => {
        if (child.isMesh && child.material) {
            if (!child.material.userData) {
                child.material.userData = {
                    originalEmissive: child.material.emissive ? child.material.emissive.clone() : new THREE.Color(0x000000),
                    originalEmissiveIntensity: child.material.emissiveIntensity || 0
                };
            }

            child.material.emissive = new THREE.Color(0x0000ff);
            child.material.emissiveIntensity = 0.5;
            child.material.needsUpdate = true;
        }
    });

    piece.userData.floatAnimation = {
        startY: piece.position.y,
        time: 0
    };
};

const deselectPiece = () => {
    if (!selectedPiece) return;

    resetSquareHighlights();

    selectedPiece.position.y = selectedPiece.userData.originalY;
    delete selectedPiece.userData.floatAnimation;

    selectedPiece.traverse((child) => {
        if (child.isMesh && child.material && child.material.userData) {
            child.material.emissive.copy(child.material.userData.originalEmissive || new THREE.Color(0x000000));
            child.material.emissiveIntensity = child.material.userData.originalEmissiveIntensity || 0;
            child.material.needsUpdate = true;
        }
    });

    selectedPiece = null;
};

const highlightValidMoves = (piece) => {
    let validMovesFound = false;

    squares.forEach(square => {
        const mat = square.material;

        if (!square.userData.originalEmissive) {
            square.userData.originalEmissive = mat.emissive.clone();
            square.userData.originalEmissiveIntensity = mat.emissiveIntensity;
        }

        mat.emissive.copy(square.userData.originalEmissive);
        mat.emissiveIntensity = square.userData.originalEmissiveIntensity;

        // Check for castling
        if (piece.userData.type === 'king' && !piece.userData.hasMoved) {
            const dx = square.position.x - piece.userData.position.x;
            if (Math.abs(dx) === 2 && square.position.z === piece.userData.position.z) {
                if (canCastleTo(piece, square.position)) {
                    validMovesFound = true;
                    mat.emissive = CASTLING_COLOR.clone();
                    mat.emissiveIntensity = HIGHLIGHT_INTENSITY;
                }
            }
        }
        
        // Regular moves
        else if (isValidMove(piece, square.position)) {
            validMovesFound = true;
            const targetPiece = getPieceAtPosition(square.position);

            if (targetPiece) {
                mat.emissive = CAPTURE_COLOR.clone();
            } else if (piece.userData.type === 'pawn' && 
                       square.position.x !== piece.userData.position.x && 
                       enPassantTarget && 
                       Math.abs(enPassantTarget.x - square.position.x) < 0.1 &&
                       Math.abs(enPassantTarget.z - square.position.z) < 0.1) {
                // Highlight en passant capture
                mat.emissive = EN_PASSANT_COLOR.clone();
            } else {
                mat.emissive = VALID_MOVE_COLOR.clone();
            }
            mat.emissiveIntensity = HIGHLIGHT_INTENSITY;
        }

        mat.needsUpdate = true;
    });

    return validMovesFound;
};

const resetSquareHighlights = () => {
    squares.forEach(square => {
        const mat = square.material;
        if (square.userData.originalEmissive) {
            mat.emissive.copy(square.userData.originalEmissive);
            mat.emissiveIntensity = square.userData.originalEmissiveIntensity;
            mat.needsUpdate = true;
        }
    });
};

const highlightKingInCheck = (color) => {
    const king = findKing(color);
    if (!king) return;

    const kingSquare = getSquareAtPosition(king.userData.position);
    if (!kingSquare) return;

    const mat = kingSquare.material;

    if (!kingSquare.userData.originalEmissive) {
        kingSquare.userData.originalEmissive = mat.emissive.clone();
        kingSquare.userData.originalEmissiveIntensity = mat.emissiveIntensity;
    }

    mat.emissive.copy(CHECK_COLOR);
    mat.emissiveIntensity = HIGHLIGHT_INTENSITY * 1.5;
    mat.needsUpdate = true;

    king.traverse((child) => {
        if (child.isMesh && child.material) {
            if (!child.material.userData) {
                child.material.userData = {
                    originalEmissive: child.material.emissive ? child.material.emissive.clone() : new THREE.Color(0x000000),
                    originalEmissiveIntensity: child.material.emissiveIntensity || 0
                };
            }

            child.material.emissive.set(1, 0, 0);
            child.material.emissiveIntensity = 0.7;
            child.material.needsUpdate = true;
        }
    });
};

const resetKingHighlight = (color) => {
    const king = findKing(color);
    if (!king) return;

    king.traverse((child) => {
        if (child.isMesh && child.material && child.material.userData) {
            child.material.emissive.copy(child.material.userData.originalEmissive);
            child.material.emissiveIntensity = child.material.userData.originalEmissiveIntensity;
            child.material.needsUpdate = true;
        }
    });

    const kingSquare = getSquareAtPosition(king.userData.position);
    if (kingSquare && kingSquare.userData.originalEmissive) {
        const mat = kingSquare.material;
        mat.emissive.copy(kingSquare.userData.originalEmissive);
        mat.emissiveIntensity = kingSquare.userData.originalEmissiveIntensity;
        mat.needsUpdate = true;
    }
};

const movePiece = (piece, targetPos) => {
    if (!gameActive) return;
    if (piece.userData.color !== currentTurn) return;

    const currentPos = { ...piece.userData.position };
    const fromSquare = getSquareName(currentPos);
    const toSquare = getSquareName(targetPos);

    console.log(`Moving ${piece.userData.name} from ${fromSquare} to ${toSquare}`);
    let captureOccurred = false;
    let capturedType = null;
    
    // Check if we're making a castling move
    const isCastling = piece.userData.type === 'king' && Math.abs(targetPos.x - currentPos.x) === 2;
    if (isCastling) {
        if (handleCastling(piece, targetPos)) {
            // The king's move will be handled below, the rook's move is handled by handleCastling
        } else {
            console.log("Castling failed");
            return;
        }
    }
    
    // Check for en passant capture
    let isEnPassantCapture = false;
    if (piece.userData.type === 'pawn' && 
        currentPos.x !== targetPos.x && 
        !getPieceAtPosition(targetPos)) {
        isEnPassantCapture = handleEnPassantCapture(piece, targetPos);
        if (isEnPassantCapture) {
            captureOccurred = true;
            capturedType = 'pawn';
        }
    }
    
    // Regular capture
    const targetPiece = getPieceAtPosition(targetPos);
    if (targetPiece) {
        console.log(`Capturing ${targetPiece.userData.name}`);
        captureOccurred = true;
        capturedType = targetPiece.userData.type;

        capturedPieces[targetPiece.userData.color].push(targetPiece.userData.type);
        updateCapturedPiecesDisplay();

        boardContainer.remove(targetPiece);
        const index = pieces.indexOf(targetPiece);
        if (index > -1) {
            pieces.splice(index, 1);
        }
    }

    // Clear en passant target after the move
    const prevEnPassantTarget = enPassantTarget;
    enPassantTarget = null;
    
    // Set new en passant target if this is a two-square pawn move
    if (piece.userData.type === 'pawn') {
        const direction = piece.userData.color === 'white' ? -1 : 1;
        const initialZ = piece.userData.color === 'white' ? 2.5 : -2.5;
        
        if (currentPos.z === initialZ && 
            Math.abs(targetPos.z - currentPos.z) === 2) {
            // Set the en passant target square behind the pawn
            enPassantTarget = { 
                x: targetPos.x, 
                z: targetPos.z - direction 
            };
            lastMovedPawn = piece;
        }
    }

    piece.userData.position = { x: targetPos.x, z: targetPos.z };
    piece.userData.name = `${piece.userData.color} ${piece.userData.type} ${toSquare}`;
    piece.userData.hasMoved = true;

    // Handle pawn promotion
    if (piece.userData.type === 'pawn') {
        const endRank = piece.userData.color === 'white' ? -3.5 : 3.5;
        if (targetPos.z === endRank) {
            promotePawn(piece);
        }
    }

    animationState = {
        piece: piece,
        startPos: new THREE.Vector3(piece.position.x, piece.position.y, piece.position.z),
        targetPos: new THREE.Vector3(targetPos.x, piece.position.y, targetPos.z),
        progress: 0,
        duration: 500,
        startTime: Date.now(),
        captureOccurred: captureOccurred,
        isCastling: isCastling,
        isEnPassantCapture: isEnPassantCapture
    };

    if (!isCastling) { // Castling notation is already recorded in handleCastling
        recordMove(piece, fromSquare, toSquare, captureOccurred, capturedType, isEnPassantCapture);
    }

    const oppositeColor = currentTurn === 'white' ? 'black' : 'white';

    if (inCheck) {
        resetKingHighlight(oppositeColor);
    }

    inCheck = isKingInCheck(oppositeColor);

    currentTurn = oppositeColor;
    turnIndicator.textContent = `${currentTurn.charAt(0).toUpperCase() + currentTurn.slice(1)}'s Turn`;

    if (inCheck) {
        console.log(`${oppositeColor} is in check!`);
        highlightKingInCheck(oppositeColor);

        checkmate = checkForCheckmate(oppositeColor);
        if (checkmate) {
            console.log(`Checkmate! ${currentTurn === 'white' ? 'Black' : 'White'} wins!`);
            gameActive = false;
            gameStatusDiv.textContent = `Checkmate! ${currentTurn === 'black' ? 'White' : 'Black'} wins!`;
            gameStatusDiv.style.color = '#ff6b6b';
        } else {
            gameStatusDiv.textContent = `${oppositeColor.charAt(0).toUpperCase() + oppositeColor.slice(1)} is in check!`;
            gameStatusDiv.style.color = '#ff6b6b';
        }
    } else {
        stalemate = checkForStalemate(oppositeColor);
        if (stalemate) {
            console.log("Stalemate! The game is a draw.");
            gameActive = false;
            gameStatusDiv.textContent = "Stalemate! The game is a draw.";
            gameStatusDiv.style.color = '#ffa500';
        } else {
            gameStatusDiv.textContent = '';
        }
    }

    deselectPiece();
};

const recordMove = (piece, fromSquare, toSquare, captureOccurred, capturedType, isEnPassantCapture = false) => {
    const color = piece.userData.color;
    const pieceType = piece.userData.type;

    let moveText = '';

    if (pieceType !== 'pawn') {
        let pieceLetter = pieceType.charAt(0).toUpperCase();
        if (pieceType === 'knight') pieceLetter = 'N';
        moveText += pieceLetter;
    }

    if (captureOccurred) {
        if (pieceType === 'pawn') {
            moveText += fromSquare.charAt(0); 
        }
        moveText += 'x';
    }

    moveText += toSquare;
    
    // Add en passant notation
    if (isEnPassantCapture) {
        moveText += ' e.p.';
    }

    // Add promotion notation (assuming queen promotion for simplicity)
    if (pieceType === 'pawn') {
        const lastRank = color === 'white' ? '8' : '1';
        if (toSquare.charAt(1) === lastRank) {
            moveText += '=Q';
        }
    }

    if (checkmate) {
        moveText += '#';
    } else if (inCheck) {
        moveText += '+';
    }

    if (color === 'white') {
        const moveRow = document.createElement('div');
        moveRow.className = 'move-row';
        moveRow.innerHTML = `
        <div class="move-entry">
            <span class="move-number">${moveCount}.</span>
            <span class="white-move">${moveText}</span>
            <span class="black-move"></span>
        </div>
    `;
        movesContainer.appendChild(moveRow);
    } else {
        const moveRows = movesContainer.querySelectorAll('.move-entry');
        const lastRow = moveRows[moveRows.length - 1];
        if (lastRow) {
            lastRow.querySelector('.black-move').textContent = moveText;
            moveCount++;
        }
    }

    movesContainer.scrollTop = movesContainer.scrollHeight;
};

const updateCapturedPiecesDisplay = () => {
    whiteCapturedDiv.innerHTML = '';
    blackCapturedDiv.innerHTML = '';

    const sortByValue = (a, b) => pieceValues[b] - pieceValues[a];

    const displayPieces = (pieces, container) => {
        if (pieces.length === 0) {
            container.innerHTML += 'None';
            return;
        }

        pieces.sort(sortByValue);

        const pieceSymbols = {
            pawn: '♙',
            knight: '♘',
            bishop: '♗',
            rook: '♖',
            queen: '♕',
            king: '♔'
        };

        pieces.forEach(piece => {
            const span = document.createElement('span');
            span.className = 'captured-piece';
            span.textContent = pieceSymbols[piece];
            span.title = piece.charAt(0).toUpperCase() + piece.slice(1);
            container.appendChild(span);
        });
    };

    displayPieces(capturedPieces.black, whiteCapturedDiv);
    displayPieces(capturedPieces.white, blackCapturedDiv);
};

const promotePawn = (pawn) => {
    console.log(`Promoting ${pawn.userData.color} pawn at ${getSquareName(pawn.userData.position)}`);

    const newType = 'queen';
    const color = pawn.userData.color;
    const position = { ...pawn.userData.position };

    boardContainer.remove(pawn);
    const index = pieces.indexOf(pawn);
    if (index > -1) {
        pieces.splice(index, 1);
    }

    createPiece(newType, color, position).then(() => {
        console.log(`Promoted to ${color} ${newType}`);
    });
};

const updateAnimations = (deltaTime) => {
    pieces.forEach(piece => {
        if (piece.userData.floatAnimation) {
            piece.userData.floatAnimation.time += deltaTime;
            const time = piece.userData.floatAnimation.time;
            const startY = piece.userData.floatAnimation.startY;

            piece.position.y = startY + Math.sin(time * 5) * 0.05;
        }
    });

    if (animationState) {
        const now = Date.now();
        const elapsed = now - animationState.startTime;
        animationState.progress = Math.min(elapsed / animationState.duration, 1);

        const easedProgress = animationState.progress < 0.5
            ? 2 * animationState.progress * animationState.progress
            : -1 + (4 - 2 * animationState.progress) * animationState.progress;

        tempVec3.lerpVectors(animationState.startPos, animationState.targetPos, easedProgress);
        animationState.piece.position.copy(tempVec3);

        animationState.piece.position.y = 0.2 + Math.sin(easedProgress * Math.PI) * 0.5;

        if (animationState.progress >= 1) {
            animationState.piece.position.copy(animationState.targetPos);
            animationState.piece.position.y = animationState.piece.userData.originalY || 0;

            if (animationState.captureOccurred) {
                console.log("Capture sound would play here");
            } else if (animationState.isCastling) {
                console.log("Castling sound would play here");
            } else {
                console.log("Move sound would play here");
            }

            animationState = null;
        }
    }
};

const setupEventListeners = () => {
    window.addEventListener('resize', onWindowResize, false);
    window.addEventListener('mousedown', onMouseDown, false);
    window.addEventListener('touchstart', onTouchStart, false);
};

const onWindowResize = () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
};

const onMouseDown = (event) => {
    if (animationState) return; 

    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    checkInteraction();
};

const onTouchStart = (event) => {
    if (animationState || event.touches.length !== 1) return;

    event.preventDefault();

    const touch = event.touches[0];
    mouse.x = (touch.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(touch.clientY / window.innerHeight) * 2 + 1;

    checkInteraction();
};

const checkInteraction = () => {
    raycaster.setFromCamera(mouse, camera);

    const pieceIntersects = raycaster.intersectObjects(pieces, true);
    if (pieceIntersects.length > 0) {
        let pieceParent = pieceIntersects[0].object;
        while (pieceParent.parent && !pieceParent.userData.type) {
            pieceParent = pieceParent.parent;
        }

        if (pieceParent.userData.type) {
            if (selectedPiece && pieceParent.userData.color !== selectedPiece.userData.color) {
                if (isValidMove(selectedPiece, pieceParent.userData.position)) {
                    movePiece(selectedPiece, pieceParent.userData.position);
                } else {
                    console.log("Invalid move");
                }
                return;
            }
            selectPiece(pieceParent);
            return;
        }
    }
    const squareIntersects = raycaster.intersectObjects(squares, false);
    if (squareIntersects.length > 0) {
        const square = squareIntersects[0].object;

        if (selectedPiece) {
            if (isValidMove(selectedPiece, square.position)) {
                movePiece(selectedPiece, square.position);
            } else {
                console.log("Invalid move to", square.userData.name);
            }
        } else {
            deselectPiece();
        }
    }
};

const initializeGame = () => {
    console.log("Initializing 3D chess game...");

    setupLighting();
    setCameraPosition();

    loadGameAssets().then(() => {
        console.log("Game assets loaded successfully!");

        setBoardRotation();

        loadingScreen.style.display = 'none';
        gameInfoDiv.style.display = 'block';

        setupEventListeners();

        gameLoop();
    }).catch(error => {
        console.error("Failed to load game assets:", error);
        loadingText.textContent = "Error loading game. Please try again.";
    });
};

function setCameraPosition() {
    if (playerColor === 'white') {
        camera.position.set(0, 10, 10);
    } else {
        camera.position.set(0, 10, -10);
    }
    camera.lookAt(0, 0, 0);
    controls.update();
}

const loadGameAssets = async () => {
    try {
        await loadChessboard();

        await loadSounds();

        loadingText.textContent = "Loading pieces... (1/8)";
        const pawnPromises = [];
        for (let i = -3.5; i <= 3.5; i++) {
            pawnPromises.push(createPiece('pawn', 'white', { x: i, z: 2.5 }));
            pawnPromises.push(createPiece('pawn', 'black', { x: i, z: -2.5 }));
        }
        await Promise.all(pawnPromises);

        loadingText.textContent = "Loading pieces... (2/8)";
        const whiteBackRankPromises = [];
        for (const [type, x, z] of pieceData.white) {
            whiteBackRankPromises.push(createPiece(type, 'white', { x, z }));
        }
        await Promise.all(whiteBackRankPromises);

        loadingText.textContent = "Loading pieces... (3/8)";
        const blackBackRankPromises = [];
        for (const [type, x, z] of pieceData.black) {
            blackBackRankPromises.push(createPiece(type, 'black', { x, z }));
        }
        await Promise.all(blackBackRankPromises);

        return true;
    } catch (error) {
        console.error("Error loading game assets:", error);
        loadingText.textContent = "Error loading game assets. Check console for details.";
        throw error;
    }
};

let lastTime = 0;
const gameLoop = (timestamp) => {
    const deltaTime = (timestamp - lastTime) / 1000;
    lastTime = timestamp;

    requestAnimationFrame(gameLoop);

    updateAnimations(deltaTime);

    controls.update();

    renderer.render(scene, camera);
};

window.addEventListener('load', () => {
    console.log("Window loaded");

    welcomeScreen.style.display = 'flex';
    loadingScreen.style.display = 'none';
    gameInfoDiv.style.display = 'none';
});