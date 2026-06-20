import * as Phaser from 'phaser';

export class MainScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MainScene' });
    }

    init() {
        this.handPos = { x: 0, y: 0 };
        this.prevHandPos = { x: 0, y: 0 };
        this.trailPoints = [];

        this.score = 0;
        this.lives = 3;
        this.timeLeft = 30; // Rút ngắn còn 30s
        this.combo = 0;
        this.maxCombo = 0;
        this.totalSliced = 0;
        this.isGameOver = false;

        this.isGoldenMode = false;
        this.isBossMode = false;
        this.hasTriggeredGolden = false;

        this.velocityThreshold = 15;
        this.comboTimer = null;
        this.comboTimer = null;

        // Types
        this.fruitTypes = [
            { key: 'sake', points: 10, color: 0x4ade80 },
            { key: 'apple', points: 3, color: 0xff4444 },
            { key: 'orange', points: 3, color: 0xffaa00 },
            { key: 'mango', points: 5, color: 0xffdd00 },
            { key: 'watermelon', points: 3, color: 0xff0000 },
            { key: 'pest_bug', points: -5, isBad: true, loseCombo: true, color: 0x000000 },
            { key: 'pesticide', points: -10, isBad: true, loseCombo: true, color: 0x000000 }
        ];

        this.sakegoMessages = [
            "Sa kê giàu chất xơ",
            "Nguyên liệu cho trà lá sa kê",
            "Sản phẩm xanh thân thiện môi trường",
            "Ăn xanh sống khỏe",
            "Sa kê Việt Nam"
        ];
    }

    preload() {
        // Load fruits
        this.fruitTypes.forEach(ft => {
            this.load.image(ft.key, `/assets/fruits/${ft.key}.png`);
            if (!ft.isBad) {
                // Sâu bệnh và thuốc hóa học không có nứt đôi
                this.load.image(ft.key + '_left', `/assets/fruits/${ft.key}_left.png`);
                this.load.image(ft.key + '_right', `/assets/fruits/${ft.key}_right.png`);
            }
        });

        // Golden sake
        this.load.image('golden_sake', '/assets/fruits/golden_sake.png');
        this.load.image('golden_sake_left', '/assets/fruits/golden_sake_left.png');
        this.load.image('golden_sake_right', '/assets/fruits/golden_sake_right.png');

        // Boss
        this.load.image('boss_bug', '/assets/fruits/boss_bug.png');

        // Background
        this.load.image('bg', '/assets/background.jpg');

        // Music
        this.load.audio('bgm', '/assets/bgm.mp3');
    }

    create() {
        this.width = this.cameras.main.width;
        this.height = this.cameras.main.height;

        // Background
        this.bgImage = this.add.image(this.width / 2, this.height / 2, 'bg').setDisplaySize(this.width, this.height).setDepth(-10);

        // Handle window resize (F11 Fullscreen)
        this.scale.on('resize', (gameSize) => {
            this.width = gameSize.width;
            this.height = gameSize.height;
            if (this.bgImage) {
                this.bgImage.setPosition(this.width / 2, this.height / 2);
                this.bgImage.setDisplaySize(this.width, this.height);
            }
        });

        // Music
        this.bgm = this.sound.add('bgm', { loop: true, volume: 0.5 });
        this.bgm.play();

        // Generate fallback emoji textures for missing images
        this.generateDemoTextures();

        // Trail graphics
        this.trailGraphics = this.add.graphics();
        this.trailGraphics.setDepth(100);

        this.fruitsGroup = this.physics.add.group();
        this.particles = this.add.particles();
        this.particles.setDepth(50);

        // Wait for camera to be ready before starting timer and spawning
        this.isGameOver = true;
        this.isStarting = false;

        const startGameLogic = () => {
            this.isGameOver = false;
            this.timeLeft = 30;
            document.getElementById('timeDisplay').innerText = this.timeLeft;

            if (this.timerInterval) clearInterval(this.timerInterval);
            this.timerInterval = setInterval(() => {
                this.updateTimer();
            }, 1000);

            // Bắt đầu tung trái cây sau một khoảng trễ nhỏ
            this.time.delayedCall(500, () => {
                if (!this.isGameOver) this.spawnFruit();
            });

            // Notify main.js that game has started
            window.dispatchEvent(new CustomEvent('sakego-gamestart'));
        };

        if (window.__cameraReady) {
            startGameLogic();
        } else {
            window.addEventListener('camera-ready', startGameLogic, { once: true });
        }
    }

    update(time, delta) {
        if (this.isGameOver) return;

        // Clean up out of bounds fruits
        let fallenFruits = [];
        this.fruitsGroup.children.iterate((fruit) => {
            if (fruit && fruit.y > this.height + 100) {
                fallenFruits.push(fruit);
            }
        });

        fallenFruits.forEach((fruit) => {
            if (!fruit.isBad && !fruit.sliced) {
                this.resetCombo();
            }
            fruit.destroy();
        });

        this.drawTrail();
        this.checkSlash();
    }

    updateHandPosition(nx, ny) {
        // nx, ny are normalized coordinates [0, 1]
        // mapped to screen coordinates
        let sx = nx * this.width;
        let sy = ny * this.height;

        this.prevHandPos = { x: this.handPos.x, y: this.handPos.y };
        this.handPos = { x: sx, y: sy };

        this.trailPoints.push({ x: sx, y: sy });
        if (this.trailPoints.length > 10) {
            this.trailPoints.shift();
        }
    }

    drawTrail() {
        this.trailGraphics.clear();
        if (this.trailPoints.length < 2) return;

        this.trailGraphics.lineStyle(8, 0x4ade80, 0.8);
        this.trailGraphics.beginPath();
        this.trailGraphics.moveTo(this.trailPoints[0].x, this.trailPoints[0].y);
        for (let i = 1; i < this.trailPoints.length; i++) {
            this.trailGraphics.lineTo(this.trailPoints[i].x, this.trailPoints[i].y);
        }
        this.trailGraphics.strokePath();
    }

    checkSlash() {
        if (this.trailPoints.length < 2) return;

        const p1 = this.prevHandPos;
        const p2 = this.handPos;

        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // velocity approx as dist (since it's called frequently)
        if (dist > this.velocityThreshold) {
            // Check intersection with fruits
            const line = new Phaser.Geom.Line(p1.x, p1.y, p2.x, p2.y);

            let fruitsToSlice = [];
            this.fruitsGroup.children.iterate((fruit) => {
                if (!fruit || fruit.sliced) return;

                const bounds = fruit.getBounds();
                if (Phaser.Geom.Intersects.LineToRectangle(line, bounds)) {
                    fruitsToSlice.push(fruit);
                }
            });

            fruitsToSlice.forEach(fruit => this.sliceFruit(fruit, dx, dy));

            // Check Boss
            if (this.isBossMode && this.boss && !this.boss.isDead) {
                const bounds = this.boss.getBounds();
                if (Phaser.Geom.Intersects.LineToRectangle(line, bounds)) {
                    this.damageBoss();
                }
            }
        }
    }

    sliceFruit(fruit, dx, dy) {
        fruit.sliced = true;

        let pts = fruit.points;
        if (this.isGoldenMode && pts > 0) pts *= 2;
        this.score += pts;

        if (fruit.loseCombo) {
            this.resetCombo();
            this.showFloatingText("Mất Combo!", fruit.x, fruit.y - 40, '#ff4444');
        }

        if (pts > 0) {
            this.totalSliced++;
            this.incrementCombo();
            this.showFloatingText('+' + pts, fruit.x, fruit.y, '#4ade80');

            // Sakego message
            if (fruit.texture.key === 'sake' || fruit.texture.key === 'golden_sake') {
                this.showSakegoMessage();
            }
        } else if (pts < 0) {
            this.showFloatingText(pts.toString(), fruit.x, fruit.y, '#ff4444');
        }
        this.updateUI();

        // Spawn halves
        let keyLeft = fruit.texture.key + '_left';
        let keyRight = fruit.texture.key + '_right';

        let size = (fruit.texture.key === 'sake' || fruit.texture.key === 'golden_sake') ? 300 : 150;
        let halfWidth = size / 2;

        let leftHalf = this.physics.add.sprite(fruit.x - (halfWidth / 2), fruit.y, keyLeft);
        let rightHalf = this.physics.add.sprite(fruit.x + (halfWidth / 2), fruit.y, keyRight);

        // Giữ lại màu vàng kim nếu là quả sake đặc biệt
        if (fruit.isGolden) {
            leftHalf.setTint(0xffd700);
            rightHalf.setTint(0xffd700);
        }

        // Scale halves down to roughly match
        leftHalf.setDisplaySize(halfWidth, size);
        rightHalf.setDisplaySize(halfWidth, size);

        // Add outward velocity
        leftHalf.setVelocity(-150 + dx * 2, fruit.body.velocity.y);
        rightHalf.setVelocity(150 + dx * 2, fruit.body.velocity.y);

        leftHalf.setAngularVelocity(-300);
        rightHalf.setAngularVelocity(300);

        // Juice effect
        let color = fruit.isBad ? 0x000000 : (fruit.texture.key === 'sake' ? 0xffffff : 0x4ade80);
        this.createSplash(fruit.x, fruit.y, color);

        fruit.destroy();

        // Check Golden Mode trigger
        if (this.score >= 50 && !this.isGoldenMode && !this.hasTriggeredGolden) {
            this.triggerGoldenMode();
        }
    }

    createSplash(x, y, color) {
        // Use a generated circle for particle
        if (!this.textures.exists('particle')) {
            let g = this.add.graphics();
            g.fillStyle(0xffffff, 1);
            g.fillCircle(10, 10, 10);
            g.generateTexture('particle', 20, 20);
            g.destroy();
        }

        let emitter = this.add.particles(x, y, 'particle', {
            speed: { min: 100, max: 300 },
            angle: { min: 0, max: 360 },
            scale: { start: 0.5, end: 0 },
            blendMode: 'ADD',
            lifespan: 600,
            gravityY: 800,
            quantity: 15,
            tint: color,
            emitting: false
        });

        emitter.explode(15);

        this.time.delayedCall(600, () => {
            emitter.destroy();
        });
    }

    spawnFruit() {
        if (this.isGameOver) return;

        let isEarlyGame = (this.timeLeft > 25); // 5 giây đầu tiên

        // Số lượng tung lên mỗi lần
        let count = this.isBossMode ? Phaser.Math.Between(3, 6) : (isEarlyGame ? Phaser.Math.Between(2, 3) : 1);
        if (this.isGoldenMode) count += 2;

        for (let i = 0; i < count; i++) {
            // Bắn từ dưới lên (Fruit Ninja style)
            let x = Phaser.Math.Between(100, this.width - 100);
            let y = this.height + 50;

            let type;
            if (this.isGoldenMode && Phaser.Math.Between(0, 100) < 30) {
                type = { key: 'sake', points: 20, color: 0xffd700, isGolden: true };
            } else {
                // Tăng tỉ lệ ra quả sake ở những giây đầu tiên (60% cơ hội)
                if (isEarlyGame && Phaser.Math.Between(0, 100) < 60) {
                    type = this.fruitTypes.find(f => f.key === 'sake');
                } else {
                    type = Phaser.Utils.Array.GetRandom(this.fruitTypes);
                }
            }

            let fruit = this.fruitsGroup.create(x, y, type.key);

            if (type.isGolden) {
                fruit.setTint(0xffd700); // Phủ màu vàng kim để biết là quả đặc biệt
                fruit.isGolden = true;
            }

            // Set fixed size in case user uploaded huge images
            let size = (type.key === 'sake' || type.key === 'golden_sake') ? 300 : 150;
            fruit.setDisplaySize(size, size);

            // Resize physics body to match visual size
            fruit.body.setSize(size, size);

            fruit.points = type.points;
            fruit.isBad = type.isBad || false;
            fruit.loseCombo = type.loseCombo || false;
            fruit.sliced = false;

            // Lực ném lên mạnh hơn để khớp với trọng lực mới
            let vx = (this.width / 2 - x) * 0.5 + Phaser.Math.Between(-80, 80);
            let vy = Phaser.Math.Between(-1400, -1100); 
            
            fruit.setVelocity(vx, vy);
            fruit.setAngularVelocity(Phaser.Math.Between(-200, 200));
        }

        // Lên lịch tung đợt tiếp theo với thời gian động
        let nextDelay = 1000;
        if (isEarlyGame) {
            nextDelay = Phaser.Math.Between(400, 600); // Đầu game tung nhanh hơn
        } else if (this.isBossMode) {
            nextDelay = 500;
        } else {
            nextDelay = Phaser.Math.Between(800, 1200); // Bình thường
        }

        this.spawnEvent = this.time.delayedCall(nextDelay, this.spawnFruit, [], this);
    }

    incrementCombo() {
        this.combo++;
        if (this.combo > this.maxCombo) this.maxCombo = this.combo;

        let comboUI = document.getElementById('comboContainer');
        comboUI.classList.remove('hidden');
        document.getElementById('comboDisplay').innerText = 'x' + this.combo;

        comboUI.classList.add('shake');
        setTimeout(() => comboUI.classList.remove('shake'), 200);

        if (this.comboTimer) this.comboTimer.remove();
        this.comboTimer = this.time.delayedCall(2000, this.resetCombo, [], this);

        if (this.combo === 10) {
            this.showCenterMessage("LEGENDARY!");
        } else if (this.combo === 5) {
            this.showCenterMessage("COMBO x5");
        } else if (this.combo === 3) {
            this.showCenterMessage("COMBO x3");
        }
    }

    resetCombo() {
        this.combo = 0;
        document.getElementById('comboContainer').classList.add('hidden');
    }

    triggerGoldenMode() {
        this.hasTriggeredGolden = true;
        this.isGoldenMode = true;
        this.showCenterMessage("GOLDEN SAKE MODE!");

        // Change background
        document.getElementById('game-container').classList.add('shadow-[inset_0_0_100px_#facc15]');

        this.time.delayedCall(10000, () => {
            this.isGoldenMode = false;
            document.getElementById('game-container').classList.remove('shadow-[inset_0_0_100px_#facc15]');
        });
    }

    triggerBossMode() {
        this.isBossMode = true;
        this.showCenterMessage("CẢNH BÁO: SÂU BỆNH KHỔNG LỒ!");

        this.boss = this.physics.add.sprite(this.width / 2, this.height / 2, 'boss_bug');
        this.boss.setDisplaySize(200, 200);
        this.boss.body.setSize(this.boss.width, this.boss.height);
        this.boss.body.allowGravity = false;
        // Giảm máu Boss xuống 10 cho dễ giết
        this.boss.health = 10;
        this.boss.maxHealth = 10;

        // Tween di chuyển Boss
        this.tweens.add({
            targets: this.boss,
            x: { value: '+=200', duration: 2000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' },
            y: { value: '+=100', duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }
        });
    }

    damageBoss() {
        this.boss.health--;
        this.createSplash(this.boss.x, this.boss.y, 0xff0000); // Red splash

        // Hiển thị text báo hiệu chém trúng Boss
        this.showFloatingText("Chém trúng!", this.boss.x, this.boss.y - 100, '#ffaa00');

        if (this.boss.health <= 0) {
            this.boss.isDead = true;
            this.score += 100;
            this.updateUI();
            this.showCenterMessage("TIÊU DIỆT TRÙM SÂU! +100 ĐIỂM", '#4ade80');
            this.boss.destroy();
            this.endGame();
        } else {
            // Push boss back slightly to simulate hit
            this.boss.y -= 10;
        }
    }

    loseLife() {
        this.lives--;
        this.updateUI();
        if (this.lives <= 0) {
            this.endGame();
        } else {
            this.showCenterMessage("MẤT MẠNG!", '#ff4444');
        }
    }

    generateDemoTextures() {
        const emojiMap = {
            'sake': '🍈',
            'apple': '🍎',
            'orange': '🍊',
            'mango': '🥭',
            'watermelon': '🍉',
            'pest_bug': '🐛',
            'pesticide': '🧪',
            'plastic_trash': '🥤',
            'golden_sake': '🌟',
            'boss_bug': '👹'
        };

        const createTex = (key, emoji, isHalf = false, side = 'left') => {
            const baseKey = isHalf ? key.replace('_left', '').replace('_right', '') : key;

            // Nếu là mảnh vỡ, kiểm tra xem có ảnh thật của mảnh vỡ không
            if (isHalf) {
                if (this.textures.exists(key) && this.textures.get(key).source[0].image.width > 32) {
                    return; // Đã có ảnh thật cắt sẵn
                }

                // CHƯA có ảnh mảnh vỡ, NHƯNG có ảnh quả nguyên vẹn -> Tự động cắt đôi ảnh nguyên vẹn!
                if (this.textures.exists(baseKey) && this.textures.get(baseKey).source[0].image.width > 32) {
                    let baseImg = this.textures.get(baseKey).getSourceImage();
                    let w = baseImg.width;
                    let h = baseImg.height;

                    if (this.textures.exists(key)) this.textures.remove(key);

                    let canvas = this.textures.createCanvas(key, w / 2, h);
                    let ctx = canvas.getContext();
                    if (side === 'left') {
                        ctx.drawImage(baseImg, 0, 0, w / 2, h, 0, 0, w / 2, h);
                    } else {
                        ctx.drawImage(baseImg, w / 2, 0, w / 2, h, 0, 0, w / 2, h);
                    }
                    canvas.refresh();
                    return; // Dừng lại, không dùng Emoji
                }
            } else {
                // Nếu là quả nguyên vẹn, kiểm tra xem có ảnh thật không
                if (this.textures.exists(key) && this.textures.get(key).source[0].image.width > 32) {
                    return; // Đã có ảnh thật
                }
            }

            if (this.textures.exists(key)) {
                return; // Prevent memory leak / lag on restart by reusing texture
            }

            let size = key.includes('sake') ? 300 : 150;
            let halfWidth = size / 2;
            let fontSize = key.includes('sake') ? '220px' : '110px';
            let emojiY = key.includes('sake') ? 155 : 80;

            let canvas = this.textures.createCanvas(key, size, size);
            let ctx = canvas.getContext();
            ctx.font = fontSize + ' Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            if (isHalf) {
                ctx.save();
                ctx.beginPath();
                if (side === 'left') {
                    ctx.rect(0, 0, halfWidth, size);
                } else {
                    ctx.rect(halfWidth, 0, halfWidth, size);
                }
                ctx.clip();
                ctx.fillText(emoji, halfWidth, emojiY);
                ctx.restore();
            } else {
                ctx.fillText(emoji, halfWidth, emojiY);
            }
            canvas.refresh();
        };

        for (const [key, emoji] of Object.entries(emojiMap)) {
            // Full fruit
            createTex(key, emoji);
            // Halves
            if (key !== 'boss_bug') {
                createTex(key + '_left', emoji, true, 'left');
                createTex(key + '_right', emoji, true, 'right');
            }
        }
    }

    updateTimer() {
        if (this.timeLeft > 0) {
            this.timeLeft--;
            document.getElementById('timeDisplay').innerText = this.timeLeft;

            if (this.timeLeft === 15 && !this.isBossMode) {
                this.triggerBossMode();
            }
        } else {
            this.endGame();
        }
    }

    updateUI() {
        document.getElementById('scoreDisplay').innerText = this.score;
    }

    showFloatingText(text, x, y, color) {
        let txt = this.add.text(x, y, text, {
            fontSize: '32px',
            fontFamily: 'sans-serif',
            fontStyle: 'bold',
            color: color,
            stroke: '#000000',
            strokeThickness: 4
        });
        txt.setOrigin(0.5);

        this.tweens.add({
            targets: txt,
            y: y - 100,
            alpha: 0,
            duration: 1000,
            onComplete: () => txt.destroy()
        });
    }

    showSakegoMessage() {
        let msg = Phaser.Utils.Array.GetRandom(this.sakegoMessages);
        let txt = this.add.text(this.width / 2, this.height - 100, msg, {
            fontSize: '28px',
            fontFamily: 'sans-serif',
            fontStyle: 'bold',
            color: '#4ade80',
            stroke: '#000000',
            strokeThickness: 6
        });
        txt.setOrigin(0.5);

        this.tweens.add({
            targets: txt,
            y: this.height - 150,
            alpha: 0,
            duration: 2000,
            onComplete: () => txt.destroy()
        });
    }

    showCenterMessage(text, duration = 2000) {
        const msgDiv = document.getElementById('centerMessage');
        const msgText = document.getElementById('messageText');
        msgText.innerText = text;
        msgDiv.classList.remove('hidden');
        msgDiv.classList.add('shake');

        if (this.centerMsgTimeout) {
            clearTimeout(this.centerMsgTimeout);
        }

        this.centerMsgTimeout = setTimeout(() => {
            msgDiv.classList.remove('shake');
            msgDiv.classList.add('hidden');
        }, duration);
    }

    endGame() {
        if (this.bgm) {
            this.bgm.stop();
        }
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
        }
        this.isGameOver = true;
        this.scene.pause();

        // Hide game UI
        document.getElementById('ui-layer').classList.add('hidden');

        // Determine Rank
        let rank = "Mầm Non Xanh";
        if (this.score >= 800) {
            rank = "Vua Sa Kê";
            // Trigger celebration effect
            window.dispatchEvent(new CustomEvent('sakego-vuasake'));
        }
        else if (this.score >= 500) rank = "Anh Hùng Sa Kê";
        else if (this.score >= 200) rank = "Đại Sứ Xanh";

        document.getElementById('goScore').innerText = this.score;
        document.getElementById('goCombo').innerText = this.maxCombo;
        document.getElementById('goTotal').innerText = this.totalSliced;
        document.getElementById('goRank').innerText = rank;

        const now = new Date();
        document.getElementById('goDate').innerText = now.toLocaleString('vi-VN');

        // Draw webcam to poster canvas
        const video = document.getElementById('webcamVideo');
        const posterCanvas = document.getElementById('posterPhoto');
        const ctx = posterCanvas.getContext('2d');
        // Because video is mirrored horizontally, mirror canvas context
        ctx.save();
        ctx.scale(-1, 1);
        ctx.drawImage(video, -posterCanvas.width, 0, posterCanvas.width, posterCanvas.height);
        ctx.restore();

        // Show Game Over Screen
        document.getElementById('gameOverScreen').classList.remove('hidden');
        document.getElementById('gameOverScreen').classList.add('flex');

        // Notify main.js to auto-save score and refresh leaderboard
        window.dispatchEvent(new CustomEvent('sakego-gameover', {
            detail: { score: this.score, maxCombo: this.maxCombo, totalSliced: this.totalSliced, rank }
        }));
    }
}
