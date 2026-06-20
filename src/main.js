import './style.css';
import * as Phaser from 'phaser';
import { config as gameConfig } from './game/GameConfig';
import { Camera } from './services/Camera';
import { HandTracker } from './services/HandTracker';
import { saveScore, getTopScores } from './firebase/leaderboard';

import { FilesetResolver } from "@mediapipe/tasks-vision";

// Initialize Phaser game immediately on load so it can attach its Audio Unlock listeners to the document
let game = new Phaser.Game(gameConfig);
let camera = null;
let handTracker = new HandTracker(null, null, null);

const startBtn = document.getElementById('startBtn');
const startScreen = document.getElementById('startScreen');
const uiLayer = document.getElementById('ui-layer');
const videoElement = document.getElementById('webcamVideo');
const faceCanvas = document.getElementById('faceCanvas');
const countdownOverlay = document.getElementById('countdownOverlay');
const countdownNumber = document.getElementById('countdownNumber');
const countdownStatus = document.getElementById('countdownStatus');

// Helper: run countdown 3-2-1-GO! with animation
function runCountdown() {
    return new Promise((resolve) => {
        const steps = ['3', '2', '1', 'GO!'];
        let i = 0;
        countdownOverlay.classList.remove('hidden');
        countdownOverlay.classList.add('flex');

        const tick = () => {
            if (i >= steps.length) {
                // Hide countdown after GO!
                setTimeout(() => {
                    countdownOverlay.classList.add('hidden');
                    countdownOverlay.classList.remove('flex');
                    resolve();
                }, 400);
                return;
            }
            countdownNumber.innerText = steps[i];
            if (steps[i] === 'GO!') {
                countdownNumber.style.animation = 'countdownGo 0.6s ease-out forwards';
                countdownNumber.classList.remove('text-sakego-green');
                countdownNumber.classList.add('text-yellow-400');
                countdownStatus.innerText = '';
            } else {
                countdownNumber.style.animation = 'none';
                // Force reflow to restart animation
                void countdownNumber.offsetWidth;
                countdownNumber.style.animation = 'countdownPulse 0.9s ease-in-out forwards';
            }
            i++;
            setTimeout(tick, i <= 3 ? 900 : 600);
        };
        tick();
    });
}

// Preload AI and Camera immediately on page load
const globalSetupPromise = (async () => {
    try {
        // Start camera
        camera = new Camera('webcamVideo');
        await camera.start();

        // Adjust canvas size to match video
        faceCanvas.width = videoElement.videoWidth;
        faceCanvas.height = videoElement.videoHeight;

        handTracker.videoElement = videoElement;
        handTracker.canvasElement = faceCanvas;
        handTracker.canvasCtx = faceCanvas.getContext('2d');
        handTracker.drawingUtils = new HandTracker(videoElement, null, faceCanvas).drawingUtils;
        handTracker.onHandMove = (x, y) => {
            if (game && game.scene.isActive('MainScene')) {
                const scene = game.scene.getScene('MainScene');
                scene.updateHandPosition(x, y);
            }
        };

        const vision = await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
        );
        await Promise.all([
            handTracker.loadModel(vision)
        ]);

        // Start tracking
        await Promise.all([
            handTracker.start()
        ]);
    } catch (err) {
        console.error("Lỗi khởi tạo AI/Camera:", err);
        throw err;
    }
})();

startBtn.addEventListener('click', async () => {
    // Immediately hide start screen
    startScreen.classList.add('hidden');
    
    // Show a small loading text
    countdownOverlay.classList.remove('hidden');
    countdownOverlay.classList.add('flex');
    countdownNumber.innerText = '';
    countdownStatus.innerText = 'Đang bật camera...';

    try {
        // Wait for background AI setup to finish
        await globalSetupPromise;

        // Signal MainScene that camera is ready to start gameplay
        window.__cameraReady = true;
        window.dispatchEvent(new CustomEvent('camera-ready'));

        // Hide overlay and reveal game
        countdownOverlay.classList.add('hidden');
        countdownOverlay.classList.remove('flex');
        
        document.getElementById('game-container').style.opacity = '1';
        uiLayer.classList.remove('hidden');
        uiLayer.classList.add('flex');

    } catch (err) {
        alert('Không thể khởi tạo camera hoặc AI. Vui lòng cho phép truy cập webcam và tải lại trang.');
        countdownOverlay.classList.add('hidden');
        countdownOverlay.classList.remove('flex');
        startScreen.classList.remove('hidden');
    }
});

// UI Button Handlers
const restartBtn = document.getElementById('restartBtn');
const liveLeaderboard = document.getElementById('liveLeaderboard');
const goLeaderboardList = document.getElementById('goLeaderboardList');
const saveStatusEl = document.getElementById('saveStatus');
const submitScoreBtn = document.getElementById('submitScoreBtn');
const playerNameInput = document.getElementById('playerNameInput');

let lastPlayerName = ''; // Track last saved name for highlight

restartBtn.addEventListener('click', async () => {
    // Hide game over screen
    document.getElementById('gameOverScreen').classList.add('hidden');
    document.getElementById('gameOverScreen').classList.remove('flex');

    // Show countdown 3-2-1 before restarting
    await runCountdown();

    // Reset UI
    document.getElementById('scoreDisplay').innerText = '0';
    document.getElementById('timeDisplay').innerText = '30';

    // Show UI layer
    uiLayer.classList.remove('hidden');
    uiLayer.classList.add('flex');

    // Restart the scene (resume first if paused)
    if (game) {
        const scene = game.scene.getScene('MainScene');
        if (scene) {
            scene.scene.resume();
            scene.scene.restart();
        }
    }

    // Refresh live leaderboard
    refreshLiveLeaderboard();
});

// State to hold the current top scores
let currentScores = [];

// ===== Leaderboard Functions =====

function renderLeaderboardRows(container, scores, options = {}) {
    const { compact = false, highlightName = '' } = options;
    container.innerHTML = '';

    if (scores.length === 0) {
        container.innerHTML = `<div class="text-gray-500 text-center py-${compact ? '2' : '4'} text-${compact ? 'xs' : 'sm'}">Chưa có dữ liệu.</div>`;
        return;
    }

    const medals = ['🥇', '🥈', '🥉'];

    scores.forEach((s, index) => {
        const row = document.createElement('div');
        const isHighlighted = highlightName && s.playerName === highlightName;
        
        if (compact) {
            row.className = `flex items-center gap-1.5 px-3 py-1.5 text-xs border-b border-white/5 ${isHighlighted ? 'bg-sakego-green/10' : 'hover:bg-white/5'} transition-colors`;
            row.innerHTML = `
                <span class="w-5 text-center">${index < 3 ? medals[index] : `<span class="text-gray-500">${index + 1}</span>`}</span>
                <span class="flex-1 truncate ${isHighlighted ? 'text-sakego-green font-bold' : 'text-gray-300'}">${s.playerName}</span>
                <span class="font-bold ${index === 0 ? 'text-yellow-400' : 'text-sakego-green'}">${s.score}</span>
            `;
        } else {
            row.className = `flex items-center gap-2 px-3 py-2 rounded-lg ${isHighlighted ? 'bg-sakego-green/15 border border-sakego-green/30' : 'bg-white/5'} transition-colors`;
            row.innerHTML = `
                <span class="w-7 text-center text-lg">${index < 3 ? medals[index] : `<span class="text-gray-500 text-sm">${index + 1}</span>`}</span>
                <span class="flex-1 truncate font-semibold ${isHighlighted ? 'text-sakego-green' : 'text-white'}">${s.playerName}</span>
                <span class="font-black text-lg ${index === 0 ? 'text-yellow-400' : 'text-sakego-green'}">${s.score}</span>
            `;
        }
        container.appendChild(row);
    });
}

async function refreshLiveLeaderboard() {
    try {
        currentScores = await getTopScores(3); // Chỉ lấy Top 3
        renderLeaderboardRows(liveLeaderboard, currentScores, { compact: true, highlightName: lastPlayerName });
    } catch (e) {
        liveLeaderboard.innerHTML = '<div class="text-xs text-gray-500 text-center py-2">Không tải được</div>';
    }
}

async function refreshGameOverLeaderboard() {
    try {
        currentScores = await getTopScores(3); // Chỉ lấy Top 3
        renderLeaderboardRows(goLeaderboardList, currentScores, { compact: false, highlightName: lastPlayerName });
    } catch (e) {
        goLeaderboardList.innerHTML = '<div class="text-gray-500 text-center py-4">Không tải được bảng xếp hạng.</div>';
    }
}

// Submit score button handler
submitScoreBtn.addEventListener('click', () => {
    const name = playerNameInput.value.trim();
    if (!name) {
        playerNameInput.style.borderColor = '#ef4444';
        playerNameInput.placeholder = 'Vui lòng nhập tên!';
        setTimeout(() => {
            playerNameInput.style.borderColor = 'rgba(74,222,128,0.3)';
            playerNameInput.placeholder = 'Nhập tên...';
        }, 2000);
        return;
    }

    lastPlayerName = name;
    const score = parseInt(document.getElementById('goScore').innerText, 10);

    // Optimistic UI Update: Hiển thị lưu thành công ngay lập tức
    submitScoreBtn.disabled = true;
    submitScoreBtn.innerText = '✅ Đã lưu';
    playerNameInput.disabled = true;
    
    saveStatusEl.classList.remove('hidden');
    saveStatusEl.innerText = `✅ Đã lưu ${score} điểm cho "${name}"`;
    saveStatusEl.className = 'mt-2 text-center text-xs font-bold text-sakego-green';

    // Optimistically update the currentScores array immediately
    currentScores.push({ playerName: name, score: score });
    currentScores.sort((a, b) => b.score - a.score); // Sort descending
    currentScores = currentScores.slice(0, 3); // Keep only top 3

    // Render immediately without waiting for Firebase
    renderLeaderboardRows(goLeaderboardList, currentScores, { compact: false, highlightName: lastPlayerName });
    renderLeaderboardRows(liveLeaderboard, currentScores, { compact: true, highlightName: lastPlayerName });

    // Thực hiện lưu ngầm vào Firebase
    saveScore(name, score).then(() => {
        // Có thể không cần refresh lại ngay vì đã tự cập nhật local chính xác
    }).catch(err => {
        console.error("Lỗi lưu điểm:", err);
    });
});

// When game ends: load leaderboard and reset save form
window.addEventListener('sakego-gameover', async () => {
    playerNameInput.value = '';
    playerNameInput.disabled = false;
    submitScoreBtn.disabled = false;
    submitScoreBtn.innerText = '💾 Lưu';
    saveStatusEl.classList.add('hidden');

    await refreshGameOverLeaderboard();
});

// Load live leaderboard on first game start
window.addEventListener('sakego-gamestart', () => {
    refreshLiveLeaderboard();
});

// Celebration effect for Vua Sa Kê
window.addEventListener('sakego-vuasake', () => {
    // Fire confetti continuously for a few seconds
    const duration = 3 * 1000;
    const end = Date.now() + duration;

    (function frame() {
        if (typeof confetti !== 'undefined') {
            confetti({
                particleCount: 10,
                angle: 60,
                spread: 55,
                origin: { x: 0 },
                colors: ['#facc15', '#4ade80', '#ffffff'] // Gold, Green, White
            });
            confetti({
                particleCount: 10,
                angle: 120,
                spread: 55,
                origin: { x: 1 },
                colors: ['#facc15', '#4ade80', '#ffffff']
            });
        }

        if (Date.now() < end) {
            requestAnimationFrame(frame);
        }
    }());
});
