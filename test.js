const video = document.getElementById("video"); // Video element for face detection
let canvas = document.getElementById("renderCanvas"); // Babylon.js canvas
let engine = new BABYLON.Engine(canvas, true, { antialias: true });
let carSpeed = 0.2; // Car's forward speed
const baseCarSpeed = 0.2; // Base car speed (reset value)
let obstacleSpeed = 0.05; // Obstacles' forward speed
// Difficulty settings
let difficultyInterval;
let scene, car, obstacles = [],roads = [],ground = [],roadSegments = [];
let speedMultiplier = 1, isGameOver = false;
// Set the road width narrower
const roadWidth = 4; // Further reduce the width
const laneWidth = roadWidth / 3; // Adjust lanes for three-lane road
const lanes = [-1.5,1.5]; // Three lanes (left, middle, right)
const switchDelay = 15000; // Delay before switching starts (15 seconds)
const switchInterval = 3000; // Interval for switching lanes (3 seconds)
let currentLane = 1; // Start in the middle lane

let playerCar; // Reference to the car object
let previousX = null; // For detecting face movement
let faceDetectionInterval;
let currentLaneIndex = 1; // Start in the middle lane
let previousFacePosition = { x: 0, y: 0 }; // Track previous face position for smooth movement

// Load face-api.js models
async function loadFaceAPIModels() {
    await faceapi.nets.tinyFaceDetector.loadFromUri('https://gautam00010.github.io/FaceDash/models'); // Load Tiny Face Detector model
    await faceapi.nets.ssdMobilenetv1.loadFromUri('https://gautam00010.github.io/FaceDash/models'); // Load SSD MobileNet model
    await faceapi.nets.faceLandmark68Net.loadFromUri('https://gautam00010.github.io/FaceDash/models'); // Load Face Landmark model
    console.log("FaceAPI models loaded successfully.");
}

// Access the user's webcam
async function setupCamera() {
    try {
        const video = document.createElement("video"); // Create a hidden video element
        video.autoplay = true;
        video.muted = true;
        video.playsInline = true;

        // Request webcam access
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        video.srcObject = stream;

        return new Promise((resolve) => {
            video.onloadedmetadata = () => {
                video.play();
                resolve(video);
            };
        });
    } catch (err) {
        console.error("Error accessing camera:", err);
        alert("Unable to access the camera. Please check permissions and try again.");
        return null;
    }
}

function preprocessFrame(videoElement) {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;

    ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

    // Apply contrast and brightness adjustment
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
        // Adjust brightness (increase by 20)
        data[i] = Math.min(255, data[i] + 20); // Red
        data[i + 1] = Math.min(255, data[i + 1] + 20); // Green
        data[i + 2] = Math.min(255, data[i + 2] + 20); // Blue

        // Adjust contrast (scale by 1.2)
        data[i] = (data[i] - 128) * 1.2 + 128;
        data[i + 1] = (data[i + 1] - 128) * 1.2 + 128;
        data[i + 2] = (data[i + 2] - 128) * 1.2 + 128;
    }

    ctx.putImageData(imageData, 0, 0);
    return canvas;
}
const options = new faceapi.TinyFaceDetectorOptions({
    inputSize: 320, // Higher size improves detection accuracy
    scoreThreshold: 0.14, // Lower threshold for low-light faces
});

// Detect face movement and control the car
async function detectFace(videoElement) {
    const displaySize = { width: videoElement.videoWidth, height: videoElement.videoHeight };
    faceapi.matchDimensions(videoElement, displaySize);

    faceDetectionInterval = setInterval(async () => {
        try {
            const processedCanvas = preprocessFrame(videoElement);

            const detections = await faceapi
                .detectSingleFace(processedCanvas, options)
                .withFaceLandmarks();

            if (detections) {
                const faceBox = detections.detection.box;
                const centerX = faceBox.x + faceBox.width / 2;
                const normalizedX = centerX / displaySize.width;

                // Control car movement
                if (normalizedX < 0.5 && currentLaneIndex === 1) {
                    moveCarToLane(0); // Move to left lane
                } else if (normalizedX >= 0.5 && currentLaneIndex === 0) {
                    moveCarToLane(1); // Move to right lane
                }
            } else {
                console.warn("No face detected");
            }
        } catch (error) {
            console.error("Error during face detection:", error);
            clearInterval(faceDetectionInterval); // Stop face detection in case of persistent errors
        }
    }, 100); // Check every 100ms
}

// Move Car to Specific Lane
function moveCarToLane(laneIndex) {
    const targetX = lanes[laneIndex];
    const animationDuration = 15;

    BABYLON.Animation.CreateAndStartAnimation(
        "carMove",
        playerCar,
        "position.x",
        60, // Frames per second
        animationDuration,
        playerCar.position.x,
        targetX,
        BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT
    );

    console.log(`Car moved to lane ${laneIndex} (x = ${targetX})`);
    currentLaneIndex = laneIndex;
}


// Initialize face detection
async function initFaceDetection() {
    try {
        await loadFaceAPIModels();
        const videoElement = await setupCamera();
        detectFace(videoElement);
    } catch (error) {
        console.error("Face detection setup failed:", error);
    }
}

// Start the game
async function startGame() {
    startSound.play(); // Play the looping sound
    clearGame();
    showMenu('hud'); // Show HUD for gameplay
    await initFaceDetection();
    createScene();
    obstacles = [];
    startDifficultyIncrease();
    resetDifficulty();
    checkCarUnlocks(); // Check for new car unlocks
    console.log('Game started with car:', selectedCar);
    engine.runRenderLoop(() => {
        if (!isGameOver) {
            scene.render();
            updateGame();
        }
    });
}
// Create the game scene
function createScene() {
    scene = new BABYLON.Scene(engine);
    
    // Lighting
    const light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), scene);
    light.intensity = 0.8;
    scene.clearColor = new BABYLON.Color4(0.53, 0.81, 0.98, 1); // Light blue envirnoment

    // Road Setup
    for (let i = 0; i < 10; i++) {
        const road = BABYLON.MeshBuilder.CreateGround("road", { width: 6, height: 50 }, scene);
        road.position.z = i * -50;
        road.material = createRoadMaterial();
        roadSegments.push(road);
        createGrass(-8, i, ground);
        createGrass(8, i, ground);
    }
    
    // Add a temporary camera
    const tempCamera = new BABYLON.UniversalCamera("tempCamera", new BABYLON.Vector3(0, 5, -10), scene);
    tempCamera.setTarget(BABYLON.Vector3.Zero());
    tempCamera.attachControl(canvas, true);
    scene.activeCamera = tempCamera; // Set the temporary camera as active
    
    // Import the selected car
    importPlayerCar();
    // Start updating the score every second
    clearInterval(scoreInterval); // Clear any existing interval
    scoreInterval = setInterval(updateScore, 1000); // Increment score every 1 second

    // Start spawning obstacles every 3 seconds (adjust timing as needed)
    clearInterval(obstacleInterval); // Clear any existing interval
    obstacleInterval = setInterval(spawnObstacle, 2000); // Spawn obstacle every 3 seconds
    return scene;
}
function updateScore() {
    if (!isGameOver && !isPaused) { // Ensure score updates only when the game is not over and not paused
        score += 1; // Increment score
        document.getElementById("score").innerText = `Score ${score}`; // Display score
    }
}

let highScore = parseInt(localStorage.getItem("highScore")) || 0; // Initialize high score from local storage

function updateHighScore() {
    if (score > highScore) {
        highScore = score;
        localStorage.setItem("highScore", highScore); // Save to local storage
    }
    updateHighScoreDisplay(); // Ensure UI always reflects the correct score
}

// Function to initialize the high score on load
function initializeHighScore() {
    const savedHighScore = localStorage.getItem("highScore");
    highScore = savedHighScore ? parseInt(savedHighScore) : 0;
    updateHighScoreDisplay(); // Update UI immediately
}

function updateHighScoreDisplay() {
    // Update the high score on the main screen
    const highScoreElement = document.getElementById("highScore");
    if (highScoreElement) {
        highScoreElement.innerText = `Score ${highScore}`;
    }
}
window.onload = () => {
    initializeHighScore();
};

// Grass Creation Function
function createGrass(x, i, ground) {
    const grass = BABYLON.MeshBuilder.CreateGround("grass", { width: 10, height: 50 }, scene);
    grass.position.set(x, 0, i * -50);
    grass.material = createGrassMaterial();
    ground.push(grass);
}
function createGrassMaterial() {
    const mat = new BABYLON.StandardMaterial("grassMat", scene);
    mat.diffuseColor = new BABYLON.Color3(0.2, 0.8, 0.2);
    return mat;
}

// Materials
function createRoadMaterial() {
    const mat = new BABYLON.StandardMaterial("roadMat", scene);
    mat.diffuseTexture = new BABYLON.Texture("assets/road.jpg", scene);
    mat.diffuseTexture.vScale = 5;
    return mat;
}

function moveGroundAndRoad() {
    roadSegments.forEach(segment => {
        if (segment && segment.position) {
            segment.position.z += carSpeed * speedMultiplier;

            if (segment.position.z > playerCar.position.z + 50) {
                segment.position.z -= 500;
            }
        }
    });

    ground.forEach(grass => {
        if (grass && grass.position) {
            grass.position.z += carSpeed * speedMultiplier;

            if (grass.position.z > playerCar.position.z + 50) {
                grass.position.z -= 500;
            }
        }
    });
}

// Spawn Obstacles
function spawnObstacle() {
    if (isGameOver) return;

    const obstacleNames = ["police.glb", "truck.glb", "ambulance.glb","delivery.glb","firetruck.glb","garbage-truck.glb","tractor.glb","tractor-shovel.glb",];
    const randomLaneIndex = Math.floor(Math.random() * lanes.length);
    const selectedLane = lanes[randomLaneIndex];
    const randomObstacleName = obstacleNames[Math.floor(Math.random() * obstacleNames.length)];

    BABYLON.SceneLoader.ImportMesh(
        "",
        "assets/",
        randomObstacleName,
        scene,
        function (meshes) {
            const obstacle = meshes[0];
            obstacle.scaling.setAll(1); // Adjust scale as needed
            obstacle.position = new BABYLON.Vector3(selectedLane, 0.5, playerCar.position.z - 150); // Spawn ahead
            obstacle.physicsImpostor = new BABYLON.PhysicsImpostor(
                obstacle,
                BABYLON.PhysicsImpostor.BoxImpostor,
                { mass: 0, restitution: 0.2 },
                scene
            );
        scene.registerBeforeRender(() => {
            obstacle.position.z += obstacleSpeed;

            // Handle obstacle going out of bounds
            if (obstacle.position.z > playerCar.position.z + 20) {
                obstacle.dispose();
            }

            // Optional: Add dynamic lane-switching behavior
            if (Math.random() < 0.01 && obstacle.position.z < playerCar.position.z - 20) {
                const newLane = lanes[Math.floor(Math.random() * lanes.length)];
                obstacle.position.x = newLane;
            }
        });

        obstacles.push(obstacle);
    });
}
function shakeScreen() {
    const originalPosition = scene.activeCamera.position.clone();
    const shakeAnimation = new BABYLON.Animation("shake", "position", 30, BABYLON.Animation.ANIMATIONTYPE_VECTOR3, BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT);
    const keys = [];
    keys.push({ frame: 0, value: originalPosition });
    keys.push({ frame: 5, value: originalPosition.add(new BABYLON.Vector3(0.1, 0, 0)) });
    keys.push({ frame: 10, value: originalPosition.add(new BABYLON.Vector3(-0.1, 0, 0)) });
    keys.push({ frame: 15, value: originalPosition });
    shakeAnimation.setKeys(keys);
    scene.beginAnimation(scene.activeCamera, 0, 15, false);
}

// Update game elements
function updateGame() {
    // Move the player's car forward
    if (playerCar) {
        playerCar.position.z -= carSpeed;
    }
    // Move obstacles and check for collision
    obstacles.forEach((obstacle, i) => {
        obstacle.position.z += obstacleSpeed; // Move obstacle forward
        obstacle.position.y = Math.sin(obstacle.position.z * 0.1) * 0.1 + 0.5; // Bobbing effect
        if (BABYLON.Vector3.Distance(playerCar.position, obstacle.position) < 1.5) {
            isGameOver = true; // Trigger game over
            startSound.pause(); // Stop the sound
            startSound.currentTime = 0; // Reset the sound to the beginning
            shakeScreen(); // Shake screen on collision
            showGameOverScreen(); // Display game over screen
            playCrashSound(); // Play crash sound
        }
        moveGroundAndRoad();
    });

}
// Difficulty increase
function startDifficultyIncrease() {
    difficultyInterval = setInterval(() => {
        carSpeed += 0.1; // Increase car speed
        obstacleSpeed += 0.05; // Increase obstacle speed (less than car speed)
    }, 10000); // Every 10 seconds
}
// Function to reset difficulty
function resetDifficulty() {
    carSpeed = 0.2; // Reset car speed to initial value
    obstacleSpeed = 0.05; // Reset obstacle speed to initial value
    clearInterval(difficultyInterval); // Stop difficulty timer
}

// Stop face detection
function stopFaceDetection() {
    clearInterval(faceDetectionInterval);
}
function showMenu(menuId) {
    // Hide all menus first
    [mainMenu, pauseMenu, gameOverMenu, hud, garageMenu].forEach(menu => {
        menu.style.display = "none";
        menu.classList.remove('fade-in', 'fade-out'); // Reset animation classes
    });

    // Show the specified menu
    const menu = document.getElementById(menuId);
    menu.classList.add('fade-in'); // Add fade-in animation
    menu.style.display = "block";
    currentMenu = menuId; // Track the active menu
}

function hideMenu(menuId) {
    const menu = document.getElementById(menuId);
    menu.classList.add('fade-out');
    setTimeout(() => {
        menu.style.display = "none";
        menu.classList.remove('fade-out');
    }, 500); // Match the duration of the fade-out animation
}

// Variables for DOM elements
const mainMenu = document.getElementById('mainMenu');
const pauseMenu = document.getElementById('pauseMenu');
const gameOverMenu = document.getElementById('gameOverMenu');
const hud = document.getElementById('hud');
const garageMenu = document.getElementById('garageMenu');

const playButton = document.getElementById('playButton');
const garageButton = document.getElementById('garageButton');
const backButtonGarage = document.getElementById('backButtonGarage');
const homeButtonGarage = document.getElementById('homeButtonGarage');
const pauseButton = document.getElementById('pauseButton');
const resumeButton = document.getElementById('resumeButton');
const homeButtonPause = document.getElementById('homeButtonPause');
const restartButton = document.getElementById('restartButton');
const homeButtonGameOver = document.getElementById('homeButtonGameOver');

const carList = document.getElementById('carList');
const scoreDisplay = document.getElementById('scoreDisplay');

// Global variables
let currentMenu = 'mainMenu'; // Tracks the current active menu
let score = 0; // Game score
let isPaused = false;
// Car purchase and selection system
let availableCars = [
    { name: "taxi", file: "taxi.glb", scoreRequired: 0 },
    { name: "SUV", file: "suv-luxury.glb", scoreRequired: 50 },
    { name: "Sports Car", file: "sedan-sports.glb", scoreRequired: 100 },
    { name: "Race Car", file: "race-future.glb", scoreRequired: 150 }
];

let selectedCar = availableCars[0]; // Default car
let unlockedCars = [availableCars[0]]; // Start with the default car unlocked
let currentScore = 0; // Replace with the actual player's score

// Create car menu dynamically
function createCarMenu() {
    const carMenu = document.getElementById("carList");
    carMenu.innerHTML = ""; // Clear existing menu content

    availableCars.forEach((car, index) => {
        const carButton = document.createElement("button");
        carButton.innerText = `${car.name} (Score: ${car.scoreRequired})`;
        
        if (!unlockedCars.includes(car)) {
            carButton.disabled = true; // Disable button for locked cars
            carButton.style.opacity = "0.5"; // Dim for locked cars
        }

        carButton.addEventListener("click", () => {
            if (unlockedCars.includes(car)) {
                selectedCar = car;
                console.log(`Selected car: ${car.name}`);
                importPlayerCar(); // Load the selected car
                alert(`You have selected: ${car.name}`);
            }
        });

        carMenu.appendChild(carButton);
    });
}

// Example function to open the garage menu
function openGarageMenu() {
    updateHighScoreDisplay(); // Update high score display
    updateHighScore(); // Update high score if needed
    checkCarUnlocks(); // Ensure unlocked cars are updated
    createCarMenu(); // Populate the menu
    showMenu('garageMenu'); // Show the garage menu
}

// Check for new car unlocks based on the player's score
function checkCarUnlocks() {
    availableCars.forEach((car) => {
        if (!unlockedCars.includes(car) && highScore >= car.scoreRequired) {
            unlockedCars.push(car);
            createCarMenu(); // Update the menu to reflect the unlocked car
        }
    });
}
availableCars.forEach((car, index) => {
    const carButton = document.createElement("button"); // Defined here
    carButton.innerText = `${car.name} (Score: ${car.scoreRequired})`;

    if (!unlockedCars.includes(car)) {
        carButton.disabled = true; // Disable button for locked cars
        carButton.style.opacity = "0.5"; // Dim for locked cars
    }

    // Add click event listener
    carButton.addEventListener("click", () => {
        if (unlockedCars.includes(car)) {
            selectedCar = car;
            console.log(`Selected car: ${car.name}`);
            hideMenu("garageMenu"); // Hide the garage menu after selecting
            showMenu("mainMenu"); // Return to the main menu or other screen
        }
    });

    // Append button to the car menu
    document.getElementById("carList").appendChild(carButton);
});

// Updated car import function to use the selected car
function importPlayerCar() {
    if (!selectedCar || !selectedCar.file) {
        console.error("No car selected or car file missing!");
        return;
    }
    BABYLON.SceneLoader.ImportMesh("", "assets/", selectedCar.file, scene, (meshes) => {
        if (!meshes || meshes.length === 0) {
            console.error("Failed to load car mesh!");
            return;
        }
        car = meshes[0];
        playerCar = car;
        playerCar.position.z = 0; // Starting position
        car.position.set(0, 0.5, 0);
        car.scaling.set(1, 1, 1);
        car.rotation.y = Math.PI; // Rotate the car to face forward
        const randomLane = lanes[Math.floor(Math.random() * lanes.length)];
        playerCar.position.x = randomLane;

        // FollowCamera setup
        const followCamera = new BABYLON.FollowCamera(
            "followCamera",
            new BABYLON.Vector3(0, 10, -20),
            scene
        );
        followCamera.lockedTarget = car;
        followCamera.radius = 20;
        followCamera.heightOffset = 5;
        followCamera.rotationOffset = 180;
        followCamera.cameraAcceleration = 0.05;
        followCamera.maxCameraSpeed = 10;

        // Replace the temporary camera with the FollowCamera
        scene.activeCamera = followCamera;
        scene.activeCamera.inputs.clear();
        followCamera.attachControl(canvas, true); // Attach controls to the FollowCamera
    });
}

// Pause Button
function pauseGame() {
    isPaused = true;
    // Stop animations or game loop
    engine.stopRenderLoop();
    startSound.pause(); // Pause the sound
    // Show pause menu
    document.getElementById("pauseMenu").style.display = "block";
    document.getElementById("hud").style.display = "none";
}

// Resume Button
function resumeGame() {
    isPaused = false;
    if (isGameOver) return; // Do not resume if the game is over
    engine.runRenderLoop(() => {
        if (!isGameOver) {
            scene.render();
            updateGame();
        }
    });
    startSound.play(); // Play the sound
    // Hide pause menu
    document.getElementById("pauseMenu").style.display = "none";
    document.getElementById("hud").style.display = "block";
}
let scoreInterval; // To store the interval for score updates
let obstacleInterval; // To store the interval for obstacle spawning

// Clear Game State
async function clearGame() {
    isPaused = false; // Reset pause state
    isGameOver = false; // Reset game over state
    // Reset score
    score = 0;
    document.getElementById("score").innerText = `Score: ${score}`;
    // Clear intervals to stop previous logic
    clearInterval(scoreInterval);
    clearInterval(obstacleInterval);
    if (playerCar) {
        playerCar.position = new BABYLON.Vector3(0, 0, 0); // Reset car position
    }
    // Remove all obstacles
    obstacles.forEach((obstacle) => obstacle.dispose());
    obstacles = []; // Clear the array
    if (scene && scene.meshes) {
        scene.meshes.forEach((mesh) => {
            if (mesh.name !== "ground" && mesh.name !== "playerCar") {
                mesh.dispose(); // Remove non-essential meshes
            }
        });
    }
    clearInterval(spawnObstacle); // Replace with your obstacle spawn interval variable
    clearInterval(updateScore);// // Replace with your obstacle spawn interval variable
    resetDifficulty(); // Reset difficulty
}


// Event listeners
playButton.onclick = () => {
    clearGame();
    showMenu('hud'); // Show HUD for gameplay
    startGame(); // Start the game
};

garageButton.onclick = () => {
    openGarageMenu(); // Open the garage menu
};

homeButtonGarage.onclick = () => {
    clearGame();
    showMenu('mainMenu'); // Return to the main menu
};
// Pause and Resume Game
pauseButton.onclick = pauseGame;
resumeButton.onclick = resumeGame;

restartButton.onclick = () => {
    clearGame(); // Reset game state
    showMenu('hud'); // Show HUD for gameplay
    startGame(); // Start the game
};

homeButtonGameOver.onclick = () => {
    clearGame();
    engine.stopRenderLoop(); // Stop the render loop
    showMenu('mainMenu'); // Return to the main menu
};
homeButtonPause.onclick = () => {
    clearGame();
    engine.stopRenderLoop(); // Stop the render loop
    showMenu('mainMenu'); // Return to the main menu
}

function showGameOverScreen() {
    isGameOver = true;
    isGamePaused = true; // Automatically pause the game
    clearInterval(startGame); // Stop spawning new obstacles
    clearInterval(updateScore); // Stop updating the score
    clearInterval(spawnObstacle); // Stop spawning new obstacles
    resetDifficulty(); // Reset difficulty
    obstacles=[]; // Clear
    stopFaceDetection();
    updateHighScore(); // Update high score if needed
    engine.stopRenderLoop(); // Stop rendering
    showMenu('gameOverMenu'); // Show the game over screen
    document.getElementById("finalScore").innerText = `Score ${score}`;
}
// Create audio elements
const startSound = new Audio("assets/Muscle_Car_Gear3 (Loop).wav");
const crashSound = new Audio("assets/Crash_Hard-004.wav");

// Enable looping for startSound
startSound.loop = true;

// Play crash sound when the car touches an obstacle
function playCrashSound() {
    crashSound.play();
    console.log("Crash sound played!");
}
