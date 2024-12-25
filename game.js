class Fighter {
    constructor(x, y, color, controls, facingRight = true, name, playerNumber) {
        this.x = x;
        this.y = y;
        this.width = 50;
        this.height = 100;
        this.color = color;
        this.speed = 5;
        this.jumping = false;
        this.health = 100;
        this.controls = controls;
        this.attacking = false;
        this.energy = 0;
        this.maxEnergy = 100;
        this.isSuper = false;
        this.facingRight = facingRight;
        this.punchState = 0;
        this.kickState = 0;
        this.walkState = 0;
        this.animationSpeed = 0.15;
        this.name = name;
        this.isDead = false;
        this.punchProgress = 0;
        this.lastPunchTime = 0;
        this.punchCooldown = 300; // 攻擊冷卻時間（毫秒）
        this.sprites = {
            walk: document.getElementById(`player${playerNumber}Walk`),
            attack: document.getElementById(`player${playerNumber}Attack`),
            jump: document.getElementById(`player${playerNumber}Jump`)
        };
        
        // 等待所有圖片載入後獲取尺寸
        this.loadSprites().then(() => {
            this.frameWidth = this.sprites.walk.width / 7;  // 假設走路動作有7幀
            this.frameHeight = this.sprites.walk.height;
        });

        this.currentFrame = 0;
        this.animationState = 'walk';
        this.animationFrames = {
            walk: { 
                frames: playerNumber === "1" ? 8 : 7,  // player1: 8幀, player2: 7幀
                speed: 0.15 
            },
            attack: { 
                frames: playerNumber === "1" ? 9 : 7,  // player1: 9幀, player2: 7幀
                speed: 0.25 
            },
            jump: { 
                frames: playerNumber === "1" ? 8 : 7,  // player1: 8幀, player2: 7幀
                speed: 0.2 
            }
        };

        // 攻擊相關屬性
        this.attackBox = {
            width: 60,   // 攻擊範圍寬度
            height: 50,  // 攻擊範圍高度
            offsetX: 30, // 攻擊框的X軸偏移
            offsetY: 20  // 攻擊框的Y軸偏移
        };
        this.attackCooldown = 500;  // 攻擊冷卻時間（毫秒）
        this.lastAttackTime = 0;
        this.attackDamage = 10;     // 基礎攻擊傷害
        this.attackFrame = 0;       // 當前攻擊動畫幀
        this.isAttackActive = false; // 攻擊判定是否生效
        this.playerNumber = playerNumber;  // 添���玩家編號以區分不同玩家
        
        // 基本縮放
        this.scale = {
            x: playerNumber === "2" ? 0.8 : 1,
            y: 1
        };

        // 為 player2 的不同動作設置特別的縮放
        this.actionScales = {
            walk: { x: playerNumber === "2" ? 0.6 : 1, y: 1 },    // walk 更窄
            attack: { x: playerNumber === "2" ? 0.8 : 1, y: 1 },  // 保持原有縮放
            jump: { x: playerNumber === "2" ? 0.8 : 1, y: 1 }     // 保持原有縮放
        };
    }

    async loadSprites() {
        const promises = Object.values(this.sprites).map(sprite => {
            return new Promise((resolve) => {
                if (sprite.complete) {
                    resolve();
                } else {
                    sprite.onload = () => {
                        // 根據不同的玩家和動作計算幀寬度
                        if (this.playerNumber === "1") {
                            if (sprite === this.sprites.walk) {
                                this.frameWidth = sprite.width / 8;  // 走路 8 幀
                            } else if (sprite === this.sprites.attack) {
                                this.frameWidth = sprite.width / 9;  // 攻擊 9 幀
                            } else if (sprite === this.sprites.jump) {
                                this.frameWidth = sprite.width / 8;  // 跳躍 8 幀
                            }
                        } else {
                            this.frameWidth = sprite.width / 7;  // player2 都是 7 幀
                        }
                        this.frameHeight = sprite.height;
                        resolve();
                    };
                }
            });
        });
        await Promise.all(promises);
    }

    drawLimb(ctx, x, y, width, height, angle) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.fillRect(-width/2, -height/2, width, height);
        ctx.restore();
    }

    draw(ctx) {
        if (!this.frameWidth) return;
        
        this.updateAnimation();
        
        ctx.save();
        
        // 獲取當前動作的縮放比例
        const currentScale = this.actionScales[this.animationState];
        
        if (!this.facingRight) {
            ctx.translate(this.x + this.width, this.y);
            ctx.scale(-1 * currentScale.x, currentScale.y);
            ctx.drawImage(
                this.sprites[this.animationState],
                Math.floor(this.currentFrame) * this.frameWidth,
                0,
                this.frameWidth,
                this.frameHeight,
                0,
                0,
                this.width / currentScale.x,
                this.height
            );
        } else {
            ctx.translate(this.x, this.y);
            ctx.scale(currentScale.x, currentScale.y);
            ctx.drawImage(
                this.sprites[this.animationState],
                Math.floor(this.currentFrame) * this.frameWidth,
                0,
                this.frameWidth,
                this.frameHeight,
                0,
                0,
                this.width / currentScale.x,
                this.height
            );
        }

        ctx.restore();
        
        // 繪製血條和能量條
        this.drawBars(ctx);

        // 如果需要，繪製攻擊碰撞框（用於調試）
        if (this.isAttackActive) {
            const attackBox = this.getAttackBox();
            ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
            ctx.strokeRect(attackBox.x, attackBox.y, attackBox.width, attackBox.height);
        }

        // 在最後添加特效的繪製
        this.drawEffects(ctx);
    }

    drawCharacter(ctx) {
        ctx.save();
        
        // 身體各部位的基本位置
        const bodyX = this.x + this.width/2;
        const bodyY = this.y + this.height/2;

        // 腿部
        const legAngle = this.walking ? Math.sin(this.walkState) * 0.3 : 0;
        ctx.fillStyle = this.color;
        this.drawLimb(ctx, bodyX - 10, bodyY + 30, 15, 40, legAngle);  // 左腿
        this.drawLimb(ctx, bodyX + 10, bodyY + 30, 15, 40, -legAngle); // 右腿

        // 身體
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x + 10, this.y + 20, 30, 40);

        // 頭部
        ctx.beginPath();
        ctx.arc(bodyX, this.y + 10, 15, 0, Math.PI * 2);
        ctx.fill();

        // 改進的手部動畫
        let leftArmAngle = 0;
        let rightArmAngle = 0;

        if (this.attacking) {
            // 攻擊動作
            const punchPhase = Math.sin(this.punchProgress * Math.PI);
            if (this.facingRight) {
                rightArmAngle = -1.5 * punchPhase;
            } else {
                leftArmAngle = 1.5 * punchPhase;
            }
        } else if (this.walking) {
            // 走路動作
            leftArmAngle = Math.sin(this.walkState) * 0.3;
            rightArmAngle = -Math.sin(this.walkState) * 0.3;
        }

        // 繪製手臂
        this.drawLimb(ctx, bodyX - 15, bodyY, 10, 30, leftArmAngle);
        this.drawLimb(ctx, bodyX + 15, bodyY, 10, 30, rightArmAngle);

        ctx.restore();
    }

    drawBars(ctx) {
        // 使用基本縮放的寬度來繪製血條
        const barWidth = this.width;
        
        // 血條背景
        ctx.fillStyle = "#500";
        ctx.fillRect(this.x - 5, this.y - 25, barWidth + 10, 15);
        
        // 血條
        ctx.fillStyle = `rgb(${255 * (1 - this.health/100)}, ${255 * (this.health/100)}, 0)`;
        ctx.fillRect(this.x, this.y - 20, barWidth * (this.health/100), 10);
        
        // 能量條背景
        ctx.fillStyle = "#440";
        ctx.fillRect(this.x - 5, this.y - 40, barWidth + 10, 10);
        
        // 能量條
        ctx.fillStyle = "yellow";
        ctx.fillRect(this.x, this.y - 35, barWidth * (this.energy/this.maxEnergy), 5);
        
        // 顯示角色名稱
        ctx.fillStyle = "white";
        ctx.font = "14px Arial";
        ctx.textAlign = "center";
        ctx.fillText(this.name, this.x + barWidth/2, this.y - 45);
    }

    move(keys) {
        const prevX = this.x;
        
        // 更新面向方向
        if (keys[this.controls.left]) {
            this.x -= this.speed;
            this.facingRight = false;
            this.walking = true;
        } else if (keys[this.controls.right]) {
            this.x += this.speed;
            this.facingRight = true;
            this.walking = true;
        } else {
            this.walking = false;
        }

        // 跳躍動畫
        if (keys[this.controls.up] && !this.jumping) {
            this.jumping = true;
            this.currentFrame = 0;  // 重置跳躍動畫
            this.jumpVelocity = -15;

            // 跳躍動畫
            const jumpAnimation = () => {
                if (this.jumping) {
                    this.currentFrame += this.animationFrames.jump.speed;
                    if (this.currentFrame < 7) {
                        setTimeout(jumpAnimation, 50);
                    }
                }
            };
            jumpAnimation();
        }

        // 跳躍物理
        if (this.jumping) {
            this.y += this.jumpVelocity;
            this.jumpVelocity += 0.8;

            if (this.y >= 250) {
                this.y = 250;
                this.jumping = false;
                this.currentFrame = 0;
            }
        }

        // 改進的攻擊判定
        const currentTime = Date.now();
        if (keys[this.controls.attack] && currentTime - this.lastPunchTime > this.punchCooldown) {
            this.attacking = true;
            this.punchProgress = 0;
            this.lastPunchTime = currentTime;
            
            // 攻擊動畫
            const animateAttack = () => {
                this.punchProgress += 0.15;
                if (this.punchProgress >= 1) {
                    this.attacking = false;
                    this.punchProgress = 0;
                } else {
                    requestAnimationFrame(animateAttack);
                }
            };
            animateAttack();
        }

        // 必殺技
        if (keys[this.controls.super] && this.energy >= this.maxEnergy) {
            this.isSuper = true;
            this.energy = 0;
            // 必殺技特效
            for (let i = 0; i < 10; i++) {
                setTimeout(() => {
                    this.createHitEffect(
                        this.x + Math.random() * this.width,
                        this.y + Math.random() * this.height
                    );
                }, i * 100);
            }
            setTimeout(() => this.isSuper = false, 3000);
        }

        // 邊界檢查
        this.x = Math.max(0, Math.min(this.x, 750));

        // 能量恢復
        if (!this.attacking && !this.isSuper) {
            this.energy = Math.min(this.maxEnergy, this.energy + 0.1);
        }

        // 更新攻擊觸發
        if (keys[this.controls.attack]) {
            this.attack();
        }
    }

    createHitEffect(x, y) {
        const effect = document.createElement('div');
        effect.className = 'effect';
        effect.style.left = x + 'px';
        effect.style.top = y + 'px';
        effect.style.width = '50px';
        effect.style.height = '50px';
        effect.style.backgroundColor = this.isSuper ? '#fff' : this.color;
        effect.style.borderRadius = '50%';
        document.body.appendChild(effect);
        
        setTimeout(() => effect.remove(), 500);
    }

    updateAnimation() {
        if (this.attacking) {
            this.animationState = 'attack';
            // 攻擊動畫使用對應的幀數
            const maxAttackFrames = this.playerNumber === "1" ? 9 : 7;
            this.currentFrame = (this.currentFrame + this.animationFrames.attack.speed) % maxAttackFrames;
        } else if (this.jumping) {
            this.animationState = 'jump';
            // 跳躍動畫使用對應的幀數
            const maxJumpFrames = this.playerNumber === "1" ? 8 : 7;
            this.currentFrame = (this.currentFrame + this.animationFrames.jump.speed) % maxJumpFrames;
        } else if (this.walking) {
            this.animationState = 'walk';
            // 走路動畫使用對應的幀數
            const maxWalkFrames = this.playerNumber === "1" ? 8 : 7;
            this.currentFrame = (this.currentFrame + this.animationFrames.walk.speed) % maxWalkFrames;
        } else {
            this.animationState = 'walk';
            this.currentFrame = 0;
        }
    }

    attack() {
        const currentTime = Date.now();
        if (currentTime - this.lastAttackTime >= this.attackCooldown && !this.attacking) {
            this.attacking = true;
            this.isAttackActive = false;
            this.attackFrame = 0;
            this.lastAttackTime = currentTime;
            this.currentFrame = 0;

            // 攻擊動畫和判定時序控制
            const attackAnimation = () => {
                this.currentFrame += this.animationFrames.attack.speed;
                const maxFrames = this.playerNumber === "1" ? 9 : 7;
                
                // 在第3幀啟動攻擊判定（對兩個玩家都一樣）
                if (Math.floor(this.currentFrame) === 3) {
                    this.isAttackActive = true;
                    this.createAttackEffect();
                }
                
                // 在第5幀結束攻擊判定（對兩個玩家都一樣）
                if (Math.floor(this.currentFrame) === 5) {
                    this.isAttackActive = false;
                }
                
                // 結束攻擊
                if (this.currentFrame >= maxFrames) {
                    this.attacking = false;
                    this.isAttackActive = false;
                    this.currentFrame = 0;
                } else {
                    setTimeout(attackAnimation, 50);
                }
            };
            
            attackAnimation();
        }
    }

    createAttackEffect() {
        // 不再創建 DOM 元素，改為在 canvas 上繪製
        const effectX = this.facingRight ? 
            this.x + this.width + 10 : 
            this.x - 40;
            
        this.attackEffect = {
            x: effectX,
            y: this.y + 30,
            width: 40,
            height: 40,
            opacity: 0.7,
            color: this.isSuper ? '#ff0' : '#fff',
            startTime: Date.now()
        };
    }

    getAttackBox() {
        // 使用攻擊動作的縮放來計算攻擊範圍
        const attackScale = this.actionScales.attack;
        const attackWidth = this.attackBox.width * attackScale.x;
        const attackOffsetX = this.attackBox.offsetX * attackScale.x;

        return {
            x: this.facingRight ? 
                this.x + this.width + attackOffsetX : 
                this.x - attackWidth - attackOffsetX,
            y: this.y + this.attackBox.offsetY,
            width: attackWidth,
            height: this.attackBox.height
        };
    }

    onHit() {
        // 不再創建 DOM 元素，改為在 canvas 上繪製
        this.hitEffect = {
            x: this.x + this.width/2,
            y: this.y,
            text: '-' + this.attackDamage,
            startTime: Date.now(),
            moveUp: 0
        };
    }

    drawEffects(ctx) {
        // 繪製攻擊特效
        if (this.attackEffect) {
            const elapsed = Date.now() - this.attackEffect.startTime;
            if (elapsed < 200) {
                ctx.save();
                ctx.globalAlpha = 0.7 * (1 - elapsed/200);
                ctx.fillStyle = this.attackEffect.color;
                ctx.beginPath();
                ctx.arc(
                    this.attackEffect.x + this.attackEffect.width/2,
                    this.attackEffect.y + this.attackEffect.height/2,
                    this.attackEffect.width/2,
                    0,
                    Math.PI * 2
                );
                ctx.fill();
                ctx.strokeStyle = this.color;
                ctx.lineWidth = 2;
                ctx.stroke();
                ctx.restore();
            } else {
                this.attackEffect = null;
            }
        }

        // 繪製傷害數字
        if (this.hitEffect) {
            const elapsed = Date.now() - this.hitEffect.startTime;
            if (elapsed < 500) {
                this.hitEffect.moveUp = elapsed / 10;
                ctx.save();
                ctx.fillStyle = 'white';
                ctx.font = '20px Arial';
                ctx.textAlign = 'center';
                ctx.globalAlpha = 1 - elapsed/500;
                ctx.fillText(
                    this.hitEffect.text,
                    this.hitEffect.x,
                    this.hitEffect.y - this.hitEffect.moveUp
                );
                ctx.restore();
            } else {
                this.hitEffect = null;
            }
        }
    }
}

class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.gameOver = false;
        this.winner = null;
        this.keys = {};

        // 載入背景圖片
        this.background = document.getElementById('backgroundImage');
        
        // 確保背景圖片載入
        this.background.onload = () => {
            this.draw();
        };
        
        // 初始化玩家
        this.initializePlayers();
        this.setupEventListeners();
    }

    initializePlayers() {
        this.player1 = new Fighter(100, 250, 'blue', {
            left: 'KeyA',
            right: 'KeyD',
            up: 'KeyW',
            attack: 'KeyF',
            super: 'KeyR'
        }, true, "玩家一", "1");

        this.player2 = new Fighter(650, 250, 'red', {
            left: 'ArrowLeft',
            right: 'ArrowRight',
            up: 'ArrowUp',
            attack: 'Slash',
            super: 'Period'
        }, false, "玩家二", "2");
    }

    setupEventListeners() {
        window.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;
            
            // 空白鍵重新開始
            if (e.code === 'Space' && this.gameOver) {
                this.resetGame();
            }
        });

        window.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
        });
    }

    resetGame() {
        // 重新初始化玩家
        this.initializePlayers();
        
        // 重置遊戲狀態
        this.gameOver = false;
        this.winner = null;

        // 清空所有特效
        const effects = document.querySelectorAll('.effect');
        effects.forEach(effect => effect.remove());
    }

    checkWinner() {
        if (this.player1.health <= 0) {
            this.gameOver = true;
            this.winner = this.player2;
            this.player1.isDead = true;
        } else if (this.player2.health <= 0) {
            this.gameOver = true;
            this.winner = this.player1;
            this.player2.isDead = true;
        }
    }

    drawGameOver() {
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.ctx.fillStyle = 'white';
        this.ctx.font = 'bold 48px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('遊戲束!', this.canvas.width/2, this.canvas.height/2 - 50);
        
        this.ctx.font = 'bold 36px Arial';
        this.ctx.fillText(`${this.winner.name} 獲勝!`, this.canvas.width/2, this.canvas.height/2 + 20);
        
        this.ctx.font = '24px Arial';
        this.ctx.fillText('按空白鍵重新開始', this.canvas.width/2, this.canvas.height/2 + 80);
    }

    update() {
        if (!this.gameOver) {
            this.player1.move(this.keys);
            this.player2.move(this.keys);
            checkCollision(this.player1, this.player2);
            checkCollision(this.player2, this.player1);
            this.checkWinner();
        }
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // 繪製背景
        if (this.background.complete) {
            this.ctx.drawImage(this.background, 0, 0, this.canvas.width, this.canvas.height);
        }

        // 繪製玩家
        this.player1.draw(this.ctx);
        this.player2.draw(this.ctx);

        // 繪製頂部生命條
        this.drawTopBars();
    }

    drawTopBars() {
        const barWidth = 300;
        const barHeight = 20;
        const margin = 10;
        
        // 玩家1生命條（左側）
        this.ctx.fillStyle = "#500";
        this.ctx.fillRect(margin, margin, barWidth, barHeight);
        this.ctx.fillStyle = `rgb(${255 * (1 - this.player1.health/100)}, ${255 * (this.player1.health/100)}, 0)`;
        this.ctx.fillRect(margin, margin, barWidth * (this.player1.health/100), barHeight);
        
        // 玩家1能量條
        this.ctx.fillStyle = "#440";
        this.ctx.fillRect(margin, margin + barHeight + 5, barWidth, barHeight/2);
        this.ctx.fillStyle = "yellow";
        this.ctx.fillRect(margin, margin + barHeight + 5, barWidth * (this.player1.energy/this.player1.maxEnergy), barHeight/2);
        
        // 玩家2生命條（右側）
        this.ctx.fillStyle = "#500";
        this.ctx.fillRect(this.canvas.width - margin - barWidth, margin, barWidth, barHeight);
        this.ctx.fillStyle = `rgb(${255 * (1 - this.player2.health/100)}, ${255 * (this.player2.health/100)}, 0)`;
        this.ctx.fillRect(this.canvas.width - margin - barWidth * (this.player2.health/100), margin, barWidth * (this.player2.health/100), barHeight);
        
        // 玩家2能量條
        this.ctx.fillStyle = "#440";
        this.ctx.fillRect(this.canvas.width - margin - barWidth, margin + barHeight + 5, barWidth, barHeight/2);
        this.ctx.fillStyle = "yellow";
        this.ctx.fillRect(this.canvas.width - margin - barWidth * (this.player2.energy/this.player2.maxEnergy), margin + barHeight + 5, barWidth * (this.player2.energy/this.player2.maxEnergy), barHeight/2);
        
        // 玩家名稱
        this.ctx.fillStyle = "white";
        this.ctx.font = "20px Arial";
        this.ctx.textAlign = "left";
        this.ctx.fillText(this.player1.name, margin, margin + barHeight * 2 + 10);
        this.ctx.textAlign = "right";
        this.ctx.fillText(this.player2.name, this.canvas.width - margin, margin + barHeight * 2 + 10);
    }

    gameLoop() {
        this.update();
        this.draw();
        requestAnimationFrame(() => this.gameLoop());
    }

    start() {
        this.gameLoop();
    }
}

// 確保 checkCollision 函數在 Game 類外部定義
function checkCollision(attacker, defender) {
    if (!attacker.isAttackActive) return;

    const attackBox = attacker.getAttackBox();
    const defenderBox = {
        x: defender.x,
        y: defender.y,
        width: defender.width,
        height: defender.height
    };

    if (attackBox.x < defenderBox.x + defenderBox.width &&
        attackBox.x + attackBox.width > defenderBox.x &&
        attackBox.y < defenderBox.y + defenderBox.height &&
        attackBox.y + attackBox.height > defenderBox.y) {
        
        // 計算傷害
        const damage = attacker.isSuper ? attacker.attackDamage * 2 : attacker.attackDamage;
        defender.health = Math.max(0, defender.health - damage);
        
        // 增加攻擊者能量
        attacker.energy = Math.min(attacker.maxEnergy, attacker.energy + 15);
        
        // 擊中效果
        defender.onHit();
    }
}

// 添加受傷效果
Fighter.prototype.onHit = function() {
    this.element = document.createElement('div');
    this.element.style.position = 'absolute';
    this.element.style.left = (this.x + this.width/2) + 'px';
    this.element.style.top = this.y + 'px';
    this.element.style.color = 'white';
    this.element.style.fontSize = '20px';
    this.element.textContent = '-' + this.attackDamage;
    document.body.appendChild(this.element);

    // 傷害數字動畫
    let moveUp = 0;
    const animateDamage = () => {
        moveUp += 1;
        this.element.style.top = (this.y - moveUp) + 'px';
        this.element.style.opacity = 1 - moveUp/50;
        
        if (moveUp < 50) {
            requestAnimationFrame(animateDamage);
        } else {
            this.element.remove();
        }
    };
    animateDamage();
};

// 初始化遊戲
const game = new Game();
game.start(); 