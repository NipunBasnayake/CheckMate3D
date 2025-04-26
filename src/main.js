import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'];
const PIECE_VALUES = { pawn: 1, knight: 3, bishop: 3, rook: 5, queen: 9, king: 0 };
const PIECE_DATA = {
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

const HIGHLIGHT_COLOR = new THREE.Color(0xffff00);
const VALID_MOVE_COLOR = new THREE.Color(0x00ff00);
const CAPTURE_COLOR = new THREE.Color(0xff0000);
const CHECK_COLOR = new THREE.Color(0xff0000);
const CASTLING_COLOR = new THREE.Color(0x0088ff);
const EN_PASSANT_COLOR = new THREE.Color(0xff8800);
const HIGHLIGHT_INTENSITY = 0.3;

const textureLoader = new THREE.TextureLoader();
const welcomeScreen = document.getElementById('welcome-screen');
const loadingScreen = document.getElementById('loading-screen');
const loadingText = document.getElementById('loading-text');
const modeSelectionScreen = document.getElementById('mode-selection-screen');
const colorSelectionText = document.getElementById('color-selection-text');

let gameMode = '';
let engineStrength = 'medium';
let playerColor = 'white';
let currentTurn = 'white';
let moveCount = 1;
let gameActive = false;
let inCheck = false;
let checkmate = false;
let stalemate = false;
let selectedPiece = null;
let animationState = null;
let lastMovedPawn = null;
let enPassantTarget = null;
let initialSetupComplete = false;
const capturedPieces = { white: [], black: [] };

let stockfishEngine = null;

function playSound(sound) {
    if (sound && sound.buffer) {
        const soundInstance = sound.clone();
        soundInstance.setVolume(sound.getVolume());
        soundInstance.play();
    }
}

function initStockfish() {
    console.log("Mock Stockfish engine initialized");
    stockfishEngine = {
        postMessage: function (message) {
            console.log("Message to Stockfish:", message);

            if (message.startsWith('go depth')) {
                setTimeout(() => {
                    const moves = getAllPossibleMoves(currentTurn);
                    if (moves.length > 0) {
                        const selectedMove = moves[Math.floor(Math.random() * moves.length)];
                        const piece = selectedMove.piece;
                        const from = getSquareName(piece.userData.position);
                        const to = getSquareName(selectedMove.targetPos);

                        handleStockfishMessage({
                            data: `bestmove ${from[0]}${from[1]}${to[0]}${to[1]}`
                        });
                    }
                }, 500);
            }
        }
    };
}

function handleStockfishMessage(event) {
    const message = event.data;
    if (message.startsWith('bestmove')) {
        const moveStr = message.split(' ')[1];
        if (moveStr === '(none)') {
            console.log("Stockfish could not find a move");
            return;
        }

        const fromSquare = moveStr.substring(0, 2);
        const toSquare = moveStr.substring(2, 4);

        console.log(`Engine wants to move from ${fromSquare} to ${toSquare}`);

        const fromX = FILES.indexOf(fromSquare[0]) - 3.5;
        const fromZ = RANKS.indexOf(fromSquare[1]) - 3.5;
        const toX = FILES.indexOf(toSquare[0]) - 3.5;
        const toZ = RANKS.indexOf(toSquare[1]) - 3.5;

        const piece = getPieceAtPosition({ x: fromX, z: fromZ });
        if (piece) {
            console.log(`Found engine piece to move: ${piece.userData.name}`);

            const targetPiece = getPieceAtPosition({ x: toX, z: toZ });
            if (targetPiece) {
                console.log(`Engine will capture ${targetPiece.userData.name}`);
            }

            movePiece(piece, { x: toX, z: toZ });
        } else {
            console.error(`Could not find piece at ${fromSquare} (${fromX}, ${fromZ})`);

            const possibleMoves = getAllPossibleMoves(currentTurn);
            if (possibleMoves.length > 0) {
                const randomMove = possibleMoves[Math.floor(Math.random() * possibleMoves.length)];
                console.log(`Falling back to random move with ${randomMove.piece.userData.name}`);
                movePiece(randomMove.piece, randomMove.targetPos);
            }
        }
    }
}

function boardToFEN() {
    let fen = '';

    for (let rankIndex = 0; rankIndex < 8; rankIndex++) {
        let emptySquares = 0;

        for (let fileIndex = 0; fileIndex < 8; fileIndex++) {
            const x = fileIndex - 3.5;
            const z = rankIndex - 3.5;

            const piece = getPieceAtPosition({ x, z });

            if (piece) {
                if (emptySquares > 0) {
                    fen += emptySquares;
                    emptySquares = 0;
                }

                let pieceLetter = piece.userData.type[0];
                if (piece.userData.type === 'knight') pieceLetter = 'n';

                fen += piece.userData.color === 'white' ? pieceLetter.toUpperCase() : pieceLetter;
            } else {
                emptySquares++;
            }
        }

        if (emptySquares > 0) {
            fen += emptySquares;
        }

        if (rankIndex < 7) {
            fen += '/';
        }
    }

    fen += ' ' + (currentTurn === 'white' ? 'w' : 'b');

    let castlingStr = '';
    const whiteKing = findKing('white');
    const blackKing = findKing('black');

    if (whiteKing && !whiteKing.userData.hasMoved) {
        const kingsideRook = pieces.find(p =>
            p.userData.type === 'rook' &&
            p.userData.color === 'white' &&
            p.userData.position.x === 3.5 &&
            p.userData.position.z === 3.5 &&
            !p.userData.hasMoved
        );
        const queensideRook = pieces.find(p =>
            p.userData.type === 'rook' &&
            p.userData.color === 'white' &&
            p.userData.position.x === -3.5 &&
            p.userData.position.z === 3.5 &&
            !p.userData.hasMoved
        );

        if (kingsideRook) castlingStr += 'K';
        if (queensideRook) castlingStr += 'Q';
    }

    if (blackKing && !blackKing.userData.hasMoved) {
        const kingsideRook = pieces.find(p =>
            p.userData.type === 'rook' &&
            p.userData.color === 'black' &&
            p.userData.position.x === 3.5 &&
            p.userData.position.z === -3.5 &&
            !p.userData.hasMoved
        );
        const queensideRook = pieces.find(p =>
            p.userData.type === 'rook' &&
            p.userData.color === 'black' &&
            p.userData.position.x === -3.5 &&
            p.userData.position.z === -3.5 &&
            !p.userData.hasMoved
        );

        if (kingsideRook) castlingStr += 'k';
        if (queensideRook) castlingStr += 'q';
    }

    fen += ' ' + (castlingStr || '-');

    if (enPassantTarget) {
        const file = FILES[Math.round(enPassantTarget.x + 3.5)];
        const rank = RANKS[Math.round(enPassantTarget.z + 3.5)];
        fen += ' ' + file + rank;
    } else {
        fen += ' -';
    }

    fen += ' 0';

    fen += ' ' + Math.ceil(moveCount / 2);

    return fen;
}

const engineStrengthContainer = document.getElementById('engine-strength-container');
const engineStrengthSelect = document.getElementById('engine-strength');

const gameModeIndicator = document.getElementById('game-mode-indicator');
gameModeIndicator.style.display = 'none';

const gameInfoDiv = document.getElementById('game-info');
gameInfoDiv.style.display = 'none';

const turnIndicator = document.getElementById('turn-indicator');
const movesContainer = document.getElementById('moves-container');
const whiteCapturedDiv = document.getElementById('white-captured');
const blackCapturedDiv = document.getElementById('black-captured');
const gameStatusDiv = document.getElementById('game-status');
const resignButton = document.getElementById('resign-button');
const newGameButton = document.getElementById('new-game-button');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x292930);
const boardContainer = new THREE.Group();
scene.add(boardContainer);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 10, 10);
camera.lookAt(0, 0, 0);

const canvas = document.querySelector('canvas.threejs');
if (!canvas) {
    console.error("No canvas element found with class 'threejs'");
}
const renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    antialias: true
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.minDistance = 8;
controls.maxDistance = 15;
controls.maxPolarAngle = Math.PI / 2.2;
controls.minPolarAngle = Math.PI / 6;
controls.autoRotate = false;
controls.autoRotateSpeed = 0.5;
controls.enablePan = false;
controls.enableRotate = true;
controls.rotateSpeed = 0.7;
controls.minAzimuthAngle = 0;
controls.maxAzimuthAngle = 0;

const squares = [];
const pieces = [];
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const loader = new GLTFLoader();
const tempVec3 = new THREE.Vector3();
const tempPos = { x: 0, z: 0 };

let boardFlipped = false;
let flipAnimationState = null;
const FLIP_ANIMATION_DURATION = 1000;

function flipBoard() {
    if (flipAnimationState) return;
    boardFlipped = !boardFlipped;

    const flipButton = document.getElementById('flip-board-button');
    if (boardFlipped) {
        flipButton.classList.add('flipped');
    } else {
        flipButton.classList.remove('flipped');
    }

    const startCameraZ = camera.position.z;
    const targetCameraZ = -startCameraZ;
    const startBoardRotation = boardContainer.rotation.y;
    const targetBoardRotation = boardFlipped ? Math.PI : 0;

    flipAnimationState = {
        startTime: Date.now(),
        duration: FLIP_ANIMATION_DURATION,
        startCameraZ: startCameraZ,
        targetCameraZ: targetCameraZ,
        startBoardRotation: startBoardRotation,
        targetBoardRotation: targetBoardRotation
    };

    if (sounds.moveSound && sounds.moveSound.buffer) {
        const flipSound = sounds.moveSound.clone();
        flipSound.setVolume(0.3);
        flipSound.play();
    }
}

function updateFlipAnimation(deltaTime) {
    if (!flipAnimationState) return;

    const now = Date.now();
    const elapsed = now - flipAnimationState.startTime;
    const progress = Math.min(elapsed / flipAnimationState.duration, 1);

    const easedProgress = Math.sin(progress * Math.PI / 2); 

    camera.position.z = flipAnimationState.startCameraZ +
        (flipAnimationState.targetCameraZ - flipAnimationState.startCameraZ) * easedProgress;

    boardContainer.rotation.y = flipAnimationState.startBoardRotation +
        (flipAnimationState.targetBoardRotation - flipAnimationState.startBoardRotation) * easedProgress;

    camera.lookAt(0, 0, 0);
    controls.update();

    if (progress >= 1) {
        camera.position.z = flipAnimationState.targetCameraZ;
        boardContainer.rotation.y = flipAnimationState.targetBoardRotation;
        flipAnimationState = null;
    }
}

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

const audioListener = new THREE.AudioListener();
camera.add(audioListener);
const audioLoader = new THREE.AudioLoader();
const sounds = {
    moveSound: new THREE.Audio(audioListener),
    captureSound: new THREE.Audio(audioListener),
    checkSound: new THREE.Audio(audioListener),
    invalidSound: new THREE.Audio(audioListener),
    castlingSound: new THREE.Audio(audioListener)
};

document.getElementById('multiplayer-button').addEventListener('click', () => {
    gameMode = 'multiplayer';
    modeSelectionScreen.style.display = 'none';
    welcomeScreen.style.display = 'flex';
    engineStrengthContainer.style.display = 'none';
    colorSelectionText.textContent = 'Choose your playing color';
});

const aiButton = document.getElementById('ai-button');
aiButton.textContent = 'Play with Engine';
aiButton.addEventListener('click', () => {
    gameMode = 'engine';
    modeSelectionScreen.style.display = 'none';
    welcomeScreen.style.display = 'flex';
    engineStrengthContainer.style.display = 'block';
    colorSelectionText.textContent = 'Choose your playing color against the Engine';

    initStockfish();
});

document.getElementById('back-to-mode').addEventListener('click', () => {
    welcomeScreen.style.display = 'none';
    modeSelectionScreen.style.display = 'flex';
});

document.getElementById('white-button').addEventListener('click', () => {
    playerColor = 'white';
    if (gameMode === 'engine') {
        engineStrength = engineStrengthSelect.value;
    }
    startGame();
});

document.getElementById('black-button').addEventListener('click', () => {
    playerColor = 'black';
    if (gameMode === 'engine') {
        engineStrength = engineStrengthSelect.value;
    }
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
    completeReset();

    welcomeScreen.style.display = 'none';
    modeSelectionScreen.style.display = 'flex';
    gameInfoDiv.style.display = 'none';
    gameModeIndicator.style.display = 'none';
});

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

    gameModeIndicator.innerHTML = gameMode === 'engine'
        ? `Mode: <span>Engine (${getEngineStrengthLabel()})</span>`
        : `Mode: <span>Multiplayer</span>`;
    gameModeIndicator.style.display = 'block';

    updateFlipButtonState();

    initializeGame();

    if (gameMode === 'engine' && playerColor === 'black') {
        setTimeout(() => {
            makeEngineMove();
        }, 1000);
    }
}

function getEngineStrengthLabel() {
    switch (engineStrength) {
        case 'easy': return 'Beginner';
        case 'medium': return 'Intermediate';
        case 'hard': return 'Advanced';
        case 'expert': return 'Expert';
        default: return 'Intermediate';
    }
}

function completeReset() {
    while (boardContainer.children.length > 0) {
        boardContainer.remove(boardContainer.children[0]);
    }

    squares.length = 0;
    pieces.length = 0;

    selectedPiece = null;
    animationState = null;
    lastMovedPawn = null;
    enPassantTarget = null;
    gameMode = '';
    engineStrength = 'medium';
    initialSetupComplete = false;

    setupLighting();
}

function resetGame() {
    while (boardContainer.children.length > 0) {
        boardContainer.remove(boardContainer.children[0]);
    }

    squares.length = 0;
    pieces.length = 0;

    selectedPiece = null;
    animationState = null;
    lastMovedPawn = null;
    enPassantTarget = null;
    gameMode = '';
    engineStrength = 'medium';
    initialSetupComplete = false;

    setupLighting();
}

function initializeGame() {
    console.log("Initializing 3D chess game...");

    setupLighting();
    setCameraPosition();

    loadGameAssets().then(() => {
        console.log("Game assets loaded successfully!");

        setBoardRotation();
        initialSetupComplete = true;

        loadingScreen.style.display = 'none';
        gameInfoDiv.style.display = 'block';

        setupEventListeners();

        gameLoop();
    }).catch(error => {
        console.error("Failed to load game assets:", error);
        loadingText.textContent = "Error loading game. Please try again.";
    });
}

function updateFlipButtonState() {
    boardFlipped = false;
    const flipButton = document.getElementById('flip-board-button');
    if (flipButton) {
        flipButton.classList.remove('flipped');
    }
}

function setupEventListeners() {
    window.addEventListener('resize', onWindowResize, false);
    window.addEventListener('mousedown', onMouseDown, false);
    window.addEventListener('touchstart', onTouchStart, false);

    const flipBoardButton = document.getElementById('flip-board-button');
    if (flipBoardButton) {
        flipBoardButton.addEventListener('click', flipBoard);
    }
}

async function loadGameAssets() {
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
        for (const [type, x, z] of PIECE_DATA.white) {
            whiteBackRankPromises.push(createPiece(type, 'white', { x, z }));
        }
        await Promise.all(whiteBackRankPromises);

        loadingText.textContent = "Loading pieces... (3/8)";
        const blackBackRankPromises = [];
        for (const [type, x, z] of PIECE_DATA.black) {
            blackBackRankPromises.push(createPiece(type, 'black', { x, z }));
        }
        await Promise.all(blackBackRankPromises);

        return true;
    } catch (error) {
        console.error("Error loading game assets:", error);
        loadingText.textContent = "Error loading game assets. Check console for details.";
        throw error;
    }
}

function setCameraPosition() {
    if (playerColor === 'white') {
        camera.position.set(0, 5, 5);
    } else {
        camera.position.set(0, 5, -5);
    }
    camera.lookAt(0, 0, 0);
    controls.update();
}

function setBoardRotation() {
    if (playerColor === 'black' && !boardFlipped || playerColor === 'white' && boardFlipped) {
        boardContainer.rotation.y = Math.PI;
    } else {
        boardContainer.rotation.y = 0;
    }
}

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

function loadSounds() {
    loadingText.textContent = "Loading sound effects...";
    return new Promise((resolve) => {
        const soundPromises = [];

        const soundFiles = {
            moveSound: 'assets/sounds/move.mp3',
            captureSound: 'assets/sounds/capture.mp3',
            checkSound: 'assets/sounds/check.mp3',
            invalidSound: 'assets/sounds/invalid.mp3',
            castlingSound: 'assets/sounds/castling.mp3'
        };

        for (const [soundName, soundPath] of Object.entries(soundFiles)) {
            const promise = new Promise((resolveSound) => {
                audioLoader.load(
                    soundPath,
                    (buffer) => {
                        sounds[soundName].setBuffer(buffer);
                        sounds[soundName].setVolume(0.5);
                        resolveSound();
                    },
                    (xhr) => {
                        const percent = (xhr.loaded / xhr.total) * 100;
                        loadingText.textContent = `Loading ${soundName}: ${Math.round(percent)}%`;
                    },
                    (error) => {
                        console.warn(`Could not load sound ${soundName}:`, error);
                        resolveSound();
                    }
                );
            });
            soundPromises.push(promise);
        }

        Promise.all(soundPromises)
            .then(() => {
                console.log("Sound effects loaded");
                resolve();
            })
            .catch((error) => {
                console.warn("Some sounds failed to load, continuing without them:", error);
                resolve();
            });
    });
}

function loadChessboard() {
    loadingText.textContent = "Creating chessboard...";
    return new Promise((resolve) => {
        const boardGroup = new THREE.Group();
        const boardGeometry = new THREE.BoxGeometry(9, 0.2, 9);

        const boardTexture = textureLoader.load('assets/textures/wood-frame.jpg', () => {
        });
        boardTexture.wrapS = boardTexture.wrapT = THREE.RepeatWrapping;
        boardTexture.repeat.set(1, 1);

        const boardNormalMap = textureLoader.load('assets/textures/wood-normal.jpg');
        boardNormalMap.wrapS = boardNormalMap.wrapT = THREE.RepeatWrapping;
        boardNormalMap.repeat.set(1, 1);

        const boardRoughnessMap = textureLoader.load('assets/textures/wood-roughness.jpg');

        const boardMaterial = new THREE.MeshStandardMaterial({
            map: boardTexture,
            normalMap: boardNormalMap,
            normalScale: new THREE.Vector2(0.5, 0.5),
            roughnessMap: boardRoughnessMap,
            roughness: 0.7,
            metalness: 0.1,
            envMapIntensity: 0.8
        });

        const board = new THREE.Mesh(boardGeometry, boardMaterial);
        board.receiveShadow = true;
        boardGroup.add(board);

        const lightSquareTexture = textureLoader.load('assets/textures/marble-light.jpg');
        const darkSquareTexture = textureLoader.load('assets/textures/marble-dark.jpg');

        const lightSquareNormal = textureLoader.load('assets/textures/marble-light-normal.jpg');
        const darkSquareNormal = textureLoader.load('assets/textures/marble-dark-normal.jpg');

        for (let x = -3.5; x <= 3.5; x++) {
            for (let z = -3.5; z <= 3.5; z++) {
                const isWhite = (Math.floor(x + 3.5) + Math.floor(z + 3.5)) % 2 === 0;

                const squareGeometry = new THREE.BoxGeometry(0.995, 0.1, 0.995);

                const squareMaterial = new THREE.MeshStandardMaterial({
                    map: isWhite ? lightSquareTexture : darkSquareTexture,
                    normalMap: isWhite ? lightSquareNormal : darkSquareNormal,
                    normalScale: new THREE.Vector2(0.3, 0.3),
                    roughness: isWhite ? 0.4 : 0.5,
                    metalness: 0.1,
                    clearcoat: 0.3,
                    clearcoatRoughness: 0.5
                });

                const square = new THREE.Mesh(squareGeometry, squareMaterial);
                square.position.set(x, 0.2, z);
                square.receiveShadow = true;

                const fileIndex = Math.round(x + 3.5);
                const rankIndex = Math.round(z + 3.5);
                square.userData = {
                    square: true,
                    name: FILES[fileIndex] + RANKS[rankIndex],
                    originalEmissive: new THREE.Color(0x000000),
                    originalEmissiveIntensity: 0
                };

                squares.push(square);
                boardGroup.add(square);
            }
        }

        if (scene.environment) {
            boardMaterial.envMap = scene.environment;
            squares.forEach(square => {
                square.material.envMap = scene.environment;
            });
        }

        const edgeLightIntensity = 0.4;
        const cornerLight1 = new THREE.PointLight(0xFFFFFF, edgeLightIntensity, 5);
        cornerLight1.position.set(4.5, 0.8, 4.5);
        boardGroup.add(cornerLight1);

        const cornerLight2 = new THREE.PointLight(0xFFFFFF, edgeLightIntensity, 5);
        cornerLight2.position.set(-4.5, 0.8, -4.5);
        boardGroup.add(cornerLight2);

        boardContainer.add(boardGroup);
        resolve();
    });
}

function applyPieceMaterial(model, color) {
    const baseTexture = textureLoader.load(`assets/textures/${color}-piece-base.jpg`);
    const normalMap = textureLoader.load(`assets/textures/${color}-piece-normal.jpg`);
    const roughnessMap = textureLoader.load(`assets/textures/${color}-piece-roughness.jpg`);

    model.traverse((child) => {
        if (child.isMesh && child.material) {
            if (Array.isArray(child.material)) {
                child.material.forEach(mat => {
                    configureMaterial(mat, color, baseTexture, normalMap, roughnessMap);
                });
            } else {
                configureMaterial(child.material, color, baseTexture, normalMap, roughnessMap);
            }
        }
    });
}

function configureMaterial(material, color, baseTexture, normalMap, roughnessMap) {
    material.map = baseTexture;
    material.normalMap = normalMap;
    material.normalScale = new THREE.Vector2(0.7, 0.7);
    material.roughnessMap = roughnessMap;

    if (color === 'white') {
        material.roughness = 0.2;
        material.metalness = 0.1;
        material.clearcoat = 1.0;
        material.clearcoatRoughness = 0.1;
        material.envMapIntensity = 1.5;
    } else {
        material.roughness = 0.2;
        material.metalness = 0.2;
        material.clearcoat = 1.0;
        material.clearcoatRoughness = 0.1;
        material.envMapIntensity = 1.2;
    }

    material.emissive = new THREE.Color(color === 'white' ? 0x333333 : 0x222222);
    material.emissiveIntensity = 0.03;
}

function createPiece(type, color, position) {
    return new Promise((resolve) => {
        const modelName = `${color}${type.charAt(0).toUpperCase() + type.slice(1)}`;
        const modelPath = `assets/models/Pieces/${modelName}.glb`;
        const yPosition = 0.25;

        loader.load(
            modelPath,
            (gltf) => {
                const model = gltf.scene;
                model.castShadow = true;

                applyPieceMaterial(model, color);

                model.scale.set(0.95, 0.95, 0.95);
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
                    type,
                    color,
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
                console.warn(`Failed to load ${color} ${type} model:`, error);
            }
        );
    });
}

function selectPiece(piece) {
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
}

function deselectPiece() {
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
}

function highlightValidMoves(piece) {
    let validMovesFound = false;

    squares.forEach(square => {
        const mat = square.material;

        if (!square.userData.originalEmissive) {
            square.userData.originalEmissive = mat.emissive.clone();
            square.userData.originalEmissiveIntensity = mat.emissiveIntensity;
        }

        mat.emissive.copy(square.userData.originalEmissive);
        mat.emissiveIntensity = square.userData.originalEmissiveIntensity;

        if (piece.userData.type === 'king' && !piece.userData.hasMoved) {
            const dx = square.position.x - piece.userData.position.x;
            if (Math.abs(dx) === 2 && square.position.z === piece.userData.position.z) {
                if (isValidCastling(piece, square.position)) {
                    validMovesFound = true;
                    mat.emissive = CASTLING_COLOR.clone();
                    mat.emissiveIntensity = HIGHLIGHT_INTENSITY;
                    console.log(`Highlighting castling move to ${square.userData.name}`);
                }
            }
        }
        else if (isValidMove(piece, square.position)) {
            validMovesFound = true;
            const targetPiece = getPieceAtPosition(square.position);

            if (targetPiece) {
                mat.emissive = CAPTURE_COLOR.clone();
                mat.emissiveIntensity = HIGHLIGHT_INTENSITY;
                console.log(`Highlighting capture move to ${square.userData.name} where ${targetPiece.userData.name} is located`);
            } else if (piece.userData.type === 'pawn' &&
                square.position.x !== piece.userData.position.x &&
                enPassantTarget &&
                Math.abs(enPassantTarget.x - square.position.x) < 0.1 &&
                Math.abs(enPassantTarget.z - square.position.z) < 0.1) {
                mat.emissive = EN_PASSANT_COLOR.clone();
                mat.emissiveIntensity = HIGHLIGHT_INTENSITY;
            } else {
                mat.emissive = VALID_MOVE_COLOR.clone();
                mat.emissiveIntensity = HIGHLIGHT_INTENSITY;
            }
        }

        mat.needsUpdate = true;
    });

    return validMovesFound;
}

function isValidCastling(king, targetPos) {
    if (king.userData.type !== 'king' || king.userData.hasMoved) return false;

    const kingPos = king.userData.position;
    const dx = targetPos.x - kingPos.x;

    if (Math.abs(dx) !== 2 || targetPos.z !== kingPos.z) return false;

    const color = king.userData.color;
    const startingRow = color === 'white' ? 3.5 : -3.5;

    if (kingPos.z !== startingRow || kingPos.x !== 0.5) return false;

    if (isKingInCheck(color)) return false;

    const isKingside = targetPos.x > kingPos.x;
    const rookX = isKingside ? 3.5 : -3.5;

    const rook = pieces.find(piece =>
        piece.userData.type === 'rook' &&
        piece.userData.color === color &&
        Math.abs(piece.userData.position.x - rookX) < 0.1 &&
        Math.abs(piece.userData.position.z - startingRow) < 0.1 &&
        !piece.userData.hasMoved
    );

    if (!rook) {
        return false;
    }

    const direction = isKingside ? 1 : -1;
    const distance = isKingside ? 2 : 3;

    for (let i = 1; i <= distance; i++) {
        const tempPos = {
            x: kingPos.x + (i * direction),
            z: startingRow
        };

        if (getPieceAtPosition(tempPos)) {
            return false;
        }

        if (i <= 2) {
            const originalPos = { ...kingPos };
            king.userData.position = { x: tempPos.x, z: tempPos.z };

            const wouldBeCheck = isKingInCheck(color);

            king.userData.position = originalPos;

            if (wouldBeCheck) {
                return false;
            }
        }
    }

    return true;
}

function resetSquareHighlights() {
    squares.forEach(square => {
        const mat = square.material;
        if (square.userData.originalEmissive) {
            mat.emissive.copy(square.userData.originalEmissive);
            mat.emissiveIntensity = square.userData.originalEmissiveIntensity;
            mat.needsUpdate = true;
        }
    });
}

function highlightKingInCheck(color) {
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
}

function resetKingHighlight(color) {
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

    if (king.userData.floatAnimation) {
        delete king.userData.floatAnimation;
        king.position.y = king.userData.originalY || 0.25;
    }

    if (selectedPiece === king) {
        selectedPiece = null;
    }
}

function movePiece(piece, targetPos) {
    if (!gameActive) return;
    if (piece.userData.color !== currentTurn) return;

    const currentPos = { ...piece.userData.position };
    const fromSquare = getSquareName(currentPos);
    const toSquare = getSquareName(targetPos);

    console.log(`Moving ${piece.userData.name} from ${fromSquare} to ${toSquare}`);

    let captureOccurred = false;
    let capturedType = null;
    let capturedPiece = null;

    const targetPiece = getPieceAtPosition(targetPos);
    if (targetPiece) {
        if (targetPiece.userData.color === piece.userData.color) {
            console.log(`Cannot capture own piece ${targetPiece.userData.name}`);
            return;
        }

        console.log(`CAPTURE: ${piece.userData.name} captures ${targetPiece.userData.name} at ${toSquare}`);
        captureOccurred = true;
        capturedType = targetPiece.userData.type;
        capturedPiece = targetPiece;

        capturedPieces[targetPiece.userData.color].push(targetPiece.userData.type);
        updateCapturedPiecesDisplay();

        boardContainer.remove(targetPiece);
        const index = pieces.indexOf(targetPiece);
        if (index > -1) {
            pieces.splice(index, 1);
            console.log(`Removed captured piece ${targetPiece.userData.name}, ${pieces.length} pieces remain`);
        } else {
            console.warn(`Failed to find captured piece ${targetPiece.userData.name} in pieces array`);
        }
    }

    const isCastling = piece.userData.type === 'king' && Math.abs(targetPos.x - currentPos.x) === 2;
    if (isCastling) {
        if (handleCastling(piece, targetPos)) {
        } else {
            console.log("Castling failed");
            return;
        }
    }

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

    const prevEnPassantTarget = enPassantTarget;
    enPassantTarget = null;

    if (piece.userData.type === 'pawn') {
        const direction = piece.userData.color === 'white' ? -1 : 1;
        const initialZ = piece.userData.color === 'white' ? 2.5 : -2.5;

        if (Math.abs(currentPos.z - initialZ) < 0.1 &&
            Math.abs(targetPos.z - currentPos.z) === 2) {
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

    if (piece.userData.type === 'pawn') {
        const endRank = piece.userData.color === 'white' ? -3.5 : 3.5;
        if (Math.abs(targetPos.z - endRank) < 0.1) {
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

    if (!isCastling) {
        recordMove(piece, fromSquare, toSquare, captureOccurred, capturedType, isEnPassantCapture);
    }

    deselectPiece();

    const oppositeColor = currentTurn === 'white' ? 'black' : 'white';

    if (inCheck) {
        resetKingHighlight(currentTurn);
        if (selectedPiece && selectedPiece.userData.type === 'king') {
            selectedPiece = null;
        }
    }

    inCheck = isKingInCheck(oppositeColor);

    currentTurn = oppositeColor;
    turnIndicator.textContent = `${currentTurn.charAt(0).toUpperCase() + currentTurn.slice(1)}'s Turn`;

    if (inCheck) {
        console.log(`${oppositeColor} is in check!`);
        highlightKingInCheck(oppositeColor);

        playSound(sounds.checkSound);

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

    if (gameMode === 'engine' && currentTurn !== playerColor && !checkmate && !stalemate && gameActive) {
        setTimeout(() => {
            makeEngineMove();
        }, 1000);
    }
}

function executeCastling(king, targetPos) {
    const color = king.userData.color;
    const startingRow = color === 'white' ? 3.5 : -3.5;

    if (!isValidCastling(king, targetPos)) return false;

    const isKingside = targetPos.x > king.userData.position.x;
    const rookX = isKingside ? 3.5 : -3.5;

    const rook = pieces.find(piece =>
        piece.userData.type === 'rook' &&
        piece.userData.color === color &&
        Math.abs(piece.userData.position.x - rookX) < 0.1 &&
        Math.abs(piece.userData.position.z - startingRow) < 0.1 &&
        !piece.userData.hasMoved
    );

    if (!rook) return false;

    const kingNewX = isKingside ? 2.5 : -1.5;
    const rookNewX = isKingside ? 1.5 : -0.5;

    rook.userData.position = { x: rookNewX, z: startingRow };
    rook.userData.hasMoved = true;
    rook.userData.name = `${rook.userData.color} rook ${getSquareName({ x: rookNewX, z: startingRow })}`;

    const notation = isKingside ? "O-O" : "O-O-O";
    recordSpecialMove(notation, color);

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

    console.log(`Completed castling: ${notation} for ${color}`);
    return true;
}

function makeEngineMove() {
    if (!gameActive || currentTurn === playerColor) return;

    console.log("Engine is thinking...");

    gameStatusDiv.textContent = "Engine is thinking...";
    gameStatusDiv.style.color = '#3498db';

    let searchDepth = 10;
    switch (engineStrength) {
        case 'easy': searchDepth = 5; break;
        case 'medium': searchDepth = 10; break;
        case 'hard': searchDepth = 15; break;
        case 'expert': searchDepth = 20; break;
    }

    const fen = boardToFEN();
    console.log("Current position (FEN):", fen);

    if (stockfishEngine) {
        stockfishEngine.postMessage('position fen ' + fen);

        stockfishEngine.postMessage('go depth ' + searchDepth);
    } else {
        const possibleMoves = getAllPossibleMoves(currentTurn);
        console.log(`Engine found ${possibleMoves.length} possible moves`);

        const captureMoves = possibleMoves.filter(move => move.isCapture);

        if (captureMoves.length > 0 && Math.random() > 0.3) {
            const captureMove = captureMoves[Math.floor(Math.random() * captureMoves.length)];
            console.log(`Engine choosing capture move: ${captureMove.piece.userData.name} captures at ${getSquareName(captureMove.targetPos)}`);

            setTimeout(() => {
                gameStatusDiv.textContent = '';
                movePiece(captureMove.piece, captureMove.targetPos);
            }, 500);
        } else if (possibleMoves.length > 0) {
            const randomMove = possibleMoves[Math.floor(Math.random() * possibleMoves.length)];
            console.log(`Engine choosing random move: ${randomMove.piece.userData.name} to ${getSquareName(randomMove.targetPos)}`);

            setTimeout(() => {
                gameStatusDiv.textContent = '';
                movePiece(randomMove.piece, randomMove.targetPos);
            }, 500);
        } else {
            console.error("No legal moves found for engine!");
        }
    }
}

function recordMove(piece, fromSquare, toSquare, captureOccurred, capturedType, isEnPassantCapture = false) {
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

    if (isEnPassantCapture) {
        moveText += ' e.p.';
    }

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
}

function updateCapturedPiecesDisplay() {
    whiteCapturedDiv.innerHTML = '';
    blackCapturedDiv.innerHTML = '';

    const sortByValue = (a, b) => PIECE_VALUES[b] - PIECE_VALUES[a];

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
}

function promotePawn(pawn) {
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
}

function recordSpecialMove(notation, color) {
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
}

function isValidMove(piece, targetPos) {
    if (piece.userData.color !== currentTurn) return false;

    const currentPos = piece.userData.position;
    const dx = targetPos.x - currentPos.x;
    const dz = targetPos.z - currentPos.z;
    const targetPiece = getPieceAtPosition(targetPos);

    if (targetPiece?.userData.color === piece.userData.color) return false;

    if (piece.userData.type === 'king' && Math.abs(dx) === 2 && dz === 0) {
        return isValidCastling(piece, targetPos);
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
}

function isValidPawnMove(piece, currentPos, targetPos, dx, dz, targetPiece) {
    const color = piece.userData.color;
    const direction = color === 'white' ? -1 : 1;
    const initialZ = color === 'white' ? 2.5 : -2.5;
    const isInitialMove = Math.abs(currentPos.z - initialZ) < 0.1;

    if (dx === 0) {
        if (dz === direction && !targetPiece) return true;
        if (dz === 2 * direction && isInitialMove) {
            tempPos.x = currentPos.x;
            tempPos.z = currentPos.z + direction;
            return !getPieceAtPosition(tempPos) && !targetPiece;
        }
    }
    else if (Math.abs(dx) === 1 && dz === direction) {
        if (targetPiece && targetPiece.userData.color !== color) return true;

        if (enPassantTarget &&
            Math.abs(enPassantTarget.x - targetPos.x) < 0.1 &&
            Math.abs(enPassantTarget.z - targetPos.z) < 0.1) {
            return true;
        }
    }
    return false;
}

function isValidKnightMove(dx, dz) {
    return (Math.abs(dx) === 2 && Math.abs(dz) === 1) || (Math.abs(dx) === 1 && Math.abs(dz) === 2);
}

function isValidBishopMove(dx, dz) {
    return Math.abs(dx) === Math.abs(dz);
}

function isValidRookMove(dx, dz) {
    return dx === 0 || dz === 0;
}

function isValidQueenMove(dx, dz) {
    return isValidBishopMove(dx, dz) || isValidRookMove(dx, dz);
}

function isValidKingMove(dx, dz) {
    return Math.abs(dx) <= 1 && Math.abs(dz) <= 1;
}

function isPathClear(currentPos, targetPos) {
    const dx = targetPos.x - currentPos.x;
    const dz = targetPos.z - currentPos.z;
    const steps = Math.max(Math.abs(dx), Math.abs(dz));

    if (steps <= 1) return true;

    const stepX = dx / steps;
    const stepZ = dz / steps;

    for (let i = 1; i < steps; i++) {
        tempPos.x = currentPos.x + stepX * i;
        tempPos.z = currentPos.z + stepZ * i;

        const pieceAtPos = getPieceAtPosition(tempPos);
        if (pieceAtPos) {
            console.log(`Path blocked at ${getSquareName(tempPos)} by ${pieceAtPos.userData.name}`);
            return false;
        }
    }
    return true;
}

function handleCastling(king, targetPos) {
    if (king.userData.hasMoved) return false;

    const color = king.userData.color;
    const startingRow = color === 'white' ? 3.5 : -3.5;

    if (king.userData.position.z !== startingRow || king.userData.position.x !== 0.5) return false;

    if (isKingInCheck(color)) return false;

    const isKingside = targetPos.x > king.userData.position.x;
    const rookX = isKingside ? 3.5 : -3.5;

    const rook = pieces.find(piece =>
        piece.userData.type === 'rook' &&
        piece.userData.color === color &&
        Math.abs(piece.userData.position.x - rookX) < 0.1 &&
        Math.abs(piece.userData.position.z - startingRow) < 0.1 &&
        !piece.userData.hasMoved
    );

    if (!rook) {
        console.log(`No eligible rook found for ${color} ${isKingside ? 'kingside' : 'queenside'} castling`);
        return false;
    }

    const direction = isKingside ? 1 : -1;
    const distance = isKingside ? 2 : 3;

    for (let i = 1; i <= distance; i++) {
        tempPos.x = king.userData.position.x + (i * direction);
        tempPos.z = startingRow;

        if (getPieceAtPosition(tempPos)) {
            console.log(`Castling path blocked at ${getSquareName(tempPos)}`);
            return false;
        }

        if (i <= 2) {
            const originalPos = { ...king.userData.position };
            king.userData.position = { x: tempPos.x, z: tempPos.z };

            const wouldBeCheck = isKingInCheck(color);

            king.userData.position = originalPos;

            if (wouldBeCheck) {
                console.log(`Castling not allowed through check at ${getSquareName(tempPos)}`);
                return false;
            }
        }
    }

    const kingNewX = isKingside ? 2.5 : -1.5;
    const rookNewX = isKingside ? 1.5 : -0.5;

    rook.userData.position = { x: rookNewX, z: startingRow };
    rook.userData.hasMoved = true;

    const notation = isKingside ? "O-O" : "O-O-O";
    recordSpecialMove(notation, color);

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

    return true;
}

function canCastleTo(king, targetPos) {
    if (king.userData.type !== 'king' || king.userData.hasMoved) return false;

    const kingPos = king.userData.position;
    const dx = targetPos.x - kingPos.x;

    if (Math.abs(dx) !== 2 || targetPos.z !== kingPos.z) return false;

    return handleCastling(king, targetPos);
}

function handleEnPassantCapture(piece, targetPos) {
    if (!enPassantTarget) return false;

    if (Math.abs(enPassantTarget.x - targetPos.x) < 0.1 &&
        Math.abs(enPassantTarget.z - targetPos.z) < 0.1) {

        const capturedPawnPos = {
            x: targetPos.x,
            z: piece.userData.position.z
        };

        const capturedPawn = getPieceAtPosition(capturedPawnPos);
        if (capturedPawn && capturedPawn.userData.type === 'pawn') {
            console.log(`En passant capture at ${getSquareName(targetPos)}, removing ${capturedPawn.userData.name}`);

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
}

function findKing(color) {
    return pieces.find(piece => piece.userData.type === 'king' && piece.userData.color === color);
}

function isKingInCheck(color) {
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
}

function wouldBeInCheck(piece, targetPos) {
    const originalPos = { ...piece.userData.position };
    const targetPiece = getPieceAtPosition(targetPos);
    let targetPieceIndex = -1;
    let result = false;

    if (targetPiece) {
        targetPieceIndex = pieces.indexOf(targetPiece);
        if (targetPieceIndex > -1) {
            pieces.splice(targetPieceIndex, 1);
        }
    }

    piece.userData.position = { x: targetPos.x, z: targetPos.z };

    result = isKingInCheck(piece.userData.color);

    piece.userData.position = originalPos;

    if (targetPiece && targetPieceIndex !== -1) {
        pieces.splice(targetPieceIndex, 0, targetPiece);
    }

    return result;
}

function checkForCheckmate(color) {
    if (!isKingInCheck(color)) return false;

    const allLegalMoves = getAllPossibleMoves(color);
    return allLegalMoves.length === 0;
}

function checkForStalemate(color) {
    if (isKingInCheck(color)) return false;

    const allLegalMoves = getAllPossibleMoves(color);
    return allLegalMoves.length === 0;
}

function getPieceAtPosition(position) {
    const threshold = 0.2;

    for (let i = pieces.length - 1; i >= 0; i--) {
        const piece = pieces[i];
        if (Math.abs(piece.userData.position.x - position.x) < threshold &&
            Math.abs(piece.userData.position.z - position.z) < threshold) {
            return piece;
        }
    }
    return null;
}

function getSquareAtPosition(position) {
    const threshold = 0.15;

    for (let i = 0; i < squares.length; i++) {
        const square = squares[i];
        if (Math.abs(square.position.x - position.x) < threshold &&
            Math.abs(square.position.z - position.z) < threshold) {
            return square;
        }
    }
    return null;
}

function getSquareName(position) {
    const fileIndex = Math.round(position.x + 3.5);
    const rankIndex = Math.round(position.z + 3.5);

    if (fileIndex >= 0 && fileIndex < 8 && rankIndex >= 0 && rankIndex < 8) {
        return FILES[fileIndex] + RANKS[rankIndex];
    }
    return "invalid";
}

function getAllPossibleMoves(color) {
    const possibleMoves = [];

    for (const piece of pieces) {
        if (piece.userData.color !== color) continue;

        console.log(`Considering moves for ${piece.userData.name}`);

        for (const square of squares) {
            if (isValidMove(piece, square.position)) {
                const targetPiece = getPieceAtPosition(square.position);
                if (targetPiece) {
                    console.log(`Found valid capture move: ${piece.userData.name} can capture ${targetPiece.userData.name} at ${square.userData.name}`);
                }

                possibleMoves.push({
                    piece: piece,
                    targetPos: square.position,
                    isCapture: !!targetPiece,
                    capturedPiece: targetPiece,
                    targetSquare: square.userData.name
                });
            }
        }
    }

    console.log(`Found ${possibleMoves.length} legal moves for ${color}`);
    console.log(`Capture moves: ${possibleMoves.filter(m => m.isCapture).length}`);

    return possibleMoves;
}

function updateAnimations(deltaTime) {
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
                playSound(sounds.captureSound);
            } else if (animationState.isCastling) {
                playSound(sounds.castlingSound);
            } else {
                playSound(sounds.moveSound);
            }

            animationState = null;
        }
    }
}

let lastTime = 0;
function gameLoop(timestamp) {
    const deltaTime = (timestamp - lastTime) / 1000;
    lastTime = timestamp;
  
    requestAnimationFrame(gameLoop);
  
    updateAnimations(deltaTime);
    
    updateFlipAnimation(deltaTime);
  
    controls.update();
  
    renderer.render(scene, camera);
  }

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function onMouseDown(event) {
    if (animationState) return;

    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    checkInteraction();
}

function onTouchStart(event) {
    if (animationState || event.touches.length !== 1) return;

    event.preventDefault();

    const touch = event.touches[0];
    mouse.x = (touch.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(touch.clientY / window.innerHeight) * 2 + 1;

    checkInteraction();
}

function checkInteraction() {
    if (gameMode === 'engine' && currentTurn !== playerColor) {
        return;
    }

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
                    console.log(`Capturing ${pieceParent.userData.name} with ${selectedPiece.userData.name}`);
                    movePiece(selectedPiece, pieceParent.userData.position);
                } else {
                    playSound(sounds.invalidSound);
                    console.log("Invalid capture move");
                }
                return;
            }

            if (gameMode === 'engine' && pieceParent.userData.color !== playerColor) {
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
                playSound(sounds.invalidSound);
                console.log("Invalid move to", square.userData.name);
            }
        } else {
            deselectPiece();
        }
    }
}

window.addEventListener('load', () => {
    console.log("Window loaded");

    modeSelectionScreen.style.display = 'flex';
    welcomeScreen.style.display = 'none';
    loadingScreen.style.display = 'none';
    gameInfoDiv.style.display = 'none';
});