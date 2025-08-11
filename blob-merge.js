class BlobMergeGame {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Canvas setup
        this.canvas.width = Math.min(1400, window.innerWidth - 40);
        this.canvas.height = Math.min(800, window.innerHeight - 100);
        
        // Game state
        this.gameRunning = true;
        this.score = 0;
        this.gameSpeed = 2;
        
        // Player blob
        this.player = {
            x: 100,
            y: this.canvas.height / 2,
            baseRadius: 25,
            currentRadius: 25,
            targetRadius: 25,
            color: '#4fc3f7',
            velocityY: 0,
            velocityX: 0,
            maxSpeed: 5,
            sizeMultiplier: 1.0
        };
        
        // Game objects
        this.smallBlobs = [];
        this.obstacles = [];
        this.particles = [];
        this.floatingTexts = [];
        
        // Collision cooldown to prevent multiple hits
        this.invulnerable = false;
        this.invulnerabilityDuration = 60; // frames
        this.invulnerabilityTimer = 0;
        this.invulnerabilityTime = 0;
        
        // Timers
        this.blobSpawnTimer = 0;
        this.obstacleSpawnTimer = 0;
        
        // Audio context pour les sons
        this.audioContext = null;
        this.initAudio();
        
        // Controls
        this.keys = {};
        this.touchStartY = 0;
        this.touchCurrentY = 0;
        this.isTouching = false;
        
        this.init();
    }

    async initAudio() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.log('Web Audio API not supported');
        }
    }

    playPopSound(frequency = 800, duration = 0.1) {
        if (!this.audioContext) return;
        
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);
        
        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + duration);
    }

    init() {
        this.setupEventListeners();
        this.gameLoop();
        
        // Spawn initial blobs
        for (let i = 0; i < 3; i++) {
            this.spawnSmallBlob();
        }
    }

    setupEventListeners() {
        // Keyboard - Version ultra-simple
        document.addEventListener('keydown', (e) => {
            const key = e.key.toLowerCase();
            this.keys[key] = true;
            
            // R pour restart - fonctionne TOUJOURS
            if (key === 'r') {
                this.forceRestart();
                return;
            }
        });
        
        document.addEventListener('keyup', (e) => {
            this.keys[e.key.toLowerCase()] = false;
        });

        // Touch controls
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.isTouching = true;
            this.touchStartY = e.touches[0].clientY;
            this.touchCurrentY = e.touches[0].clientY;
        });
        
        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            if (this.isTouching) {
                this.touchCurrentY = e.touches[0].clientY;
            }
        });
        
        this.canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.isTouching = false;
        });

        // Mouse controls
        this.canvas.addEventListener('mousedown', (e) => {
            this.isTouching = true;
            this.touchStartY = e.clientY;
            this.touchCurrentY = e.clientY;
        });

        this.canvas.addEventListener('mousemove', (e) => {
            if (this.isTouching) {
                this.touchCurrentY = e.clientY;
            }
        });

        this.canvas.addEventListener('mouseup', () => {
            this.isTouching = false;
        });
        
        // Restart button - Simple
        document.getElementById('restart-btn').addEventListener('click', () => {
            this.forceRestart();
        });

        // Window resize
        window.addEventListener('resize', () => {
            this.canvas.width = Math.min(1400, window.innerWidth - 40);
            this.canvas.height = Math.min(800, window.innerHeight - 100);
        });
    }

    handleInput() {
        if (!this.gameRunning) return;
        
        // Keyboard input
        if (this.keys['arrowup'] || this.keys['z']) {
            this.player.velocityY = Math.max(this.player.velocityY - 0.5, -this.player.maxSpeed);
        }
        if (this.keys['arrowdown'] || this.keys['s']) {
            this.player.velocityY = Math.min(this.player.velocityY + 0.5, this.player.maxSpeed);
        }
        if (this.keys['arrowleft'] || this.keys['q']) {
            this.player.velocityX = Math.max(this.player.velocityX - 0.5, -this.player.maxSpeed);
        }
        if (this.keys['arrowright'] || this.keys['d']) {
            this.player.velocityX = Math.min(this.player.velocityX + 0.5, this.player.maxSpeed);
        }

        // Touch/Mouse input
        if (this.isTouching) {
            const deltaY = this.touchCurrentY - this.touchStartY;
            const sensitivity = 0.1;
            this.player.velocityY = Math.max(-this.player.maxSpeed, 
                Math.min(this.player.maxSpeed, deltaY * sensitivity));
        }
        
        // Apply movement
        this.player.y += this.player.velocityY;
        this.player.x += this.player.velocityX;
        
        // Friction
        this.player.velocityY *= 0.95;
        this.player.velocityX *= 0.95;
        
        // Boundaries
        const margin = this.player.currentRadius;
        this.player.y = Math.max(margin, Math.min(this.canvas.height - margin, this.player.y));
        this.player.x = Math.max(margin, Math.min(this.canvas.width - margin, this.player.x));
    }

    spawnSmallBlob() {
        if (!this.gameRunning) return;
        
        const blob = {
            x: this.canvas.width + 30,
            y: Math.random() * (this.canvas.height - 60) + 30,
            radius: Math.random() * 15 + 5,
            color: this.getRandomBlobColor(),
            velocityX: -this.gameSpeed + Math.random() - 0.5,
            velocityY: (Math.random() - 0.5) * 2,
            pulsePhase: Math.random() * Math.PI * 2
        };
        
        this.smallBlobs.push(blob);
    }

    getRandomBlobColor() {
        const colors = [
            '#4caf50', '#2196f3', '#ff9800', '#e91e63', 
            '#9c27b0', '#00bcd4', '#8bc34a', '#ffc107'
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    spawnObstacle() {
        if (!this.gameRunning || Math.random() > 0.4) return;
        
        const obstacle = {
            x: this.canvas.width + 30,
            y: Math.random() * (this.canvas.height * 0.6) + (this.canvas.height * 0.2),
            width: 20,
            height: Math.random() * 40 + 20,
            color: '#f44336',
            velocityX: -this.gameSpeed
        };
        
        this.obstacles.push(obstacle);
    }

    updateObjects() {
        // Update small blobs
        for (let i = this.smallBlobs.length - 1; i >= 0; i--) {
            const blob = this.smallBlobs[i];
            blob.x += blob.velocityX;
            blob.y += blob.velocityY;
            blob.pulsePhase += 0.1;
            
            // Remove if off screen
            if (blob.x < -50) {
                this.smallBlobs.splice(i, 1);
                continue;
            }
            
            // Check collision with player
            const dx = this.player.x - blob.x;
            const dy = this.player.y - blob.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < this.player.currentRadius + blob.radius) {
                if (blob.radius < this.player.currentRadius * 0.8) {
                    this.absorbBlob(blob, i);
                }
            }
        }
        
        // Update obstacles
        for (let i = this.obstacles.length - 1; i >= 0; i--) {
            const obstacle = this.obstacles[i];
            obstacle.x += obstacle.velocityX;
            
            // Remove if off screen
            if (obstacle.x < -50) {
                this.obstacles.splice(i, 1);
                continue;
            }
            
            // Check collision with player
            if (this.checkObstacleCollision(obstacle)) {
                this.hitObstacle();
                this.obstacles.splice(i, 1);
            }
        }

        // Update particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const particle = this.particles[i];
            particle.x += particle.velocityX;
            particle.y += particle.velocityY;
            particle.life -= particle.decay;
            particle.radius *= 0.98;
            
            if (particle.life <= 0 || particle.radius < 0.5) {
                this.particles.splice(i, 1);
            }
        }

        // Update floating texts
        for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
            const text = this.floatingTexts[i];
            text.y -= 1;
            text.life -= 0.02;
            
            if (text.life <= 0) {
                this.floatingTexts.splice(i, 1);
            }
        }
        
        // Update invulnerability
        if (this.invulnerable) {
            this.invulnerabilityTime--;
            if (this.invulnerabilityTime <= 0) {
                this.invulnerable = false;
            }
        }
    }

    absorbBlob(blob, index) {
        // Growth calculation
        const growth = blob.radius * 0.1;
        this.player.targetRadius += growth;
        this.player.sizeMultiplier += growth / this.player.baseRadius;
        
        // Effects
        this.createAbsorptionParticles(blob.x, blob.y, blob.color);
        this.createFloatingText('+' + Math.round(blob.radius), blob.x, blob.y, '#4caf50');
        
        // Sound effect
        const frequency = 400 + (blob.radius * 20);
        this.playPopSound(frequency, 0.15);
        
        // Score
        this.score += Math.round(blob.radius);
        
        // Remove blob
        this.smallBlobs.splice(index, 1);
        
        // Game speed increase
        this.gameSpeed = Math.min(this.gameSpeed + 0.02, 6);
    }

    checkObstacleCollision(obstacle) {
        // Traiter l'obstacle comme un cercle avec un rayon basé sur sa taille
        const obstacleRadius = Math.max(obstacle.width, obstacle.height) / 2;
        const obstacleCenterX = obstacle.x + obstacle.width / 2;
        const obstacleCenterY = obstacle.y + obstacle.height / 2;
        
        // Distance entre les centres
        const dx = this.player.x - obstacleCenterX;
        const dy = this.player.y - obstacleCenterY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Collision si la distance est inférieure à la somme des rayons
        return distance < (this.player.currentRadius + obstacleRadius);
    }

    hitObstacle() {
        // Toujours Game Over maintenant quand on touche un obstacle
        this.gameOver();
        
        // Effet visuel immédiat
        this.createImpactParticles(this.player.x, this.player.y);
        this.createFloatingText('AÏEEE!', this.player.x, this.player.y - 30, '#ff4444');
        
        // Son d'impact
        this.playPopSound(150, 0.4);
    }

    createAbsorptionParticles(x, y, color) {
        for (let i = 0; i < 8; i++) {
            const angle = (Math.PI * 2 * i) / 8;
            this.particles.push({
                x: x,
                y: y,
                velocityX: Math.cos(angle) * 3,
                velocityY: Math.sin(angle) * 3,
                radius: Math.random() * 3 + 1,
                color: color,
                life: 1,
                decay: 0.05
            });
        }
    }

    createImpactParticles(x, y) {
        for (let i = 0; i < 15; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 8 + 3;
            this.particles.push({
                x: x,
                y: y,
                velocityX: Math.cos(angle) * speed,
                velocityY: Math.sin(angle) * speed,
                radius: Math.random() * 4 + 2,
                color: ['#ff4444', '#ff6666', '#ff0000', '#cc0000'][Math.floor(Math.random() * 4)],
                life: 1,
                decay: 0.03
            });
        }
        
        // Effet d'onde de choc
        for (let i = 0; i < 8; i++) {
            const angle = (Math.PI * 2 * i) / 8;
            this.particles.push({
                x: x,
                y: y,
                velocityX: Math.cos(angle) * 12,
                velocityY: Math.sin(angle) * 12,
                radius: Math.random() * 2 + 1,
                color: '#ffaa00',
                life: 0.8,
                decay: 0.05
            });
        }
    }

    createFloatingText(text, x, y, color = '#4caf50') {
        this.floatingTexts.push({
            text: text,
            x: x,
            y: y,
            color: color,
            life: 1
        });
    }

    updatePlayer() {
        if (!this.gameRunning) return;
        
        // Smooth radius transitions
        if (Math.abs(this.player.currentRadius - this.player.targetRadius) > 0.1) {
            this.player.currentRadius += (this.player.targetRadius - this.player.currentRadius) * 0.1;
        }
    }

    spawnTimers() {
        this.blobSpawnTimer++;
        this.obstacleSpawnTimer++;
        
        if (this.blobSpawnTimer >= 120) { // Every 2 seconds at 60fps
            this.spawnSmallBlob();
            this.blobSpawnTimer = 0;
        }
        
        if (this.obstacleSpawnTimer >= 180) { // Every 3 seconds
            this.spawnObstacle();
            this.obstacleSpawnTimer = 0;
        }
    }

    render() {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.drawBackground();
        
        // Draw small blobs
        this.smallBlobs.forEach(blob => {
            const pulseSize = Math.sin(blob.pulsePhase) * 2;
            this.drawBlob(blob.x, blob.y, blob.radius + pulseSize, blob.color);
        });
        
        // Draw obstacles
        this.obstacles.forEach(obstacle => this.drawObstacle(obstacle));
        
        // Draw particles
        this.particles.forEach(particle => this.drawParticle(particle));
        
        // Draw floating texts
        this.floatingTexts.forEach(text => this.drawFloatingText(text));
        
        // Draw player
        this.drawPlayerBlob();
        
        // Update UI
        this.updateUI();
    }

    drawBackground() {
        // Fond sombre et subtil - tons neutres foncés
        const gradient = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
        gradient.addColorStop(0, '#373430');    // Gris-brun foncé
        gradient.addColorStop(0.3, '#2d2b27');  // Brun très sombre
        gradient.addColorStop(0.7, '#323029');  // Gris olive foncé
        gradient.addColorStop(1, '#38352f');    // Taupe foncé
        
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        const time = Date.now() * 0.00008; // Très lent et discret
        
        // Vagues ultra-subtiles (3 couches)
        this.ctx.globalAlpha = 0.03; // Très discret
        this.ctx.strokeStyle = '#4a4741';
        this.ctx.lineWidth = 1;
        
        for (let layer = 0; layer < 3; layer++) {
            this.ctx.beginPath();
            for (let x = 0; x <= this.canvas.width; x += 12) {
                const baseY = this.canvas.height * (0.15 + layer * 0.3);
                const wave1 = Math.sin((x + time * 25) * 0.005 + layer) * 10;
                const wave2 = Math.sin((x + time * 15) * 0.008 + layer * 2) * 5;
                const wave3 = Math.sin((x + time * 35) * 0.003 + layer * 1.5) * 3;
                const y = baseY + wave1 + wave2 + wave3;
                
                if (x === 0) {
                    this.ctx.moveTo(x, y);
                } else {
                    this.ctx.lineTo(x, y);
                }
            }
            this.ctx.stroke();
        }
        
        // Effet de brume très discret
        this.ctx.globalAlpha = 0.02;
        for (let i = 0; i < 6; i++) {
            const x = (i * 160 + time * 15) % (this.canvas.width + 120);
            const baseY = 80 + (i * 100) % (this.canvas.height - 160);
            const mistOffset = Math.sin(time * 1.0 + i * 0.3) * 12;
            const y = baseY + mistOffset;
            
            // Petites particules de brume
            const mistLength = 10 + Math.sin(time + i) * 3;
            
            this.ctx.strokeStyle = '#434039';
            this.ctx.lineWidth = 0.5;
            this.ctx.beginPath();
            this.ctx.moveTo(x, y);
            this.ctx.lineTo(x + mistLength, y - 1);
            this.ctx.stroke();
        }
        
        // Points très discrets pour texture minimale
        this.ctx.globalAlpha = 0.025;
        for (let i = 0; i < 5; i++) {
            const x = (i * 220 + time * 6) % (this.canvas.width + 80);
            const y = 120 + (i * 120) % (this.canvas.height - 240);
            const pulse = 0.3 + Math.sin(time * 2 + i) * 0.15;
            
            this.ctx.fillStyle = '#45423c';
            this.ctx.beginPath();
            this.ctx.arc(x, y, pulse, 0, Math.PI * 2);
            this.ctx.fill();
        }
        
        this.ctx.globalAlpha = 1.0;
    }

    drawBlob(x, y, radius, color, glow = true) {
        if (glow) {
            // Glow effect
            const glowGradient = this.ctx.createRadialGradient(x, y, 0, x, y, radius * 2);
            glowGradient.addColorStop(0, color + '40');
            glowGradient.addColorStop(0.5, color + '20');
            glowGradient.addColorStop(1, color + '00');
            
            this.ctx.fillStyle = glowGradient;
            this.ctx.beginPath();
            this.ctx.arc(x, y, radius * 2, 0, Math.PI * 2);
            this.ctx.fill();
        }
        
        // Main blob
        const blobGradient = this.ctx.createRadialGradient(
            x - radius * 0.3, y - radius * 0.3, 0,
            x, y, radius
        );
        blobGradient.addColorStop(0, color + 'ff');
        blobGradient.addColorStop(1, color + 'aa');
        
        this.ctx.fillStyle = blobGradient;
        this.ctx.beginPath();
        this.ctx.arc(x, y, radius, 0, Math.PI * 2);
        this.ctx.fill();
    }

    drawPlayerBlob() {
        const currentRadius = this.player.currentRadius;
        
        // Invulnerability effect
        if (this.invulnerable && Math.floor(Date.now() / 100) % 2) {
            this.ctx.globalAlpha = 0.5;
        }
        
        this.drawBlob(this.player.x, this.player.y, currentRadius, this.player.color, false);
        
        // Eyes
        const eyeSize = currentRadius * 0.12;
        const eyeOffset = currentRadius * 0.3;
        
        this.ctx.fillStyle = '#ffffff';
        this.ctx.beginPath();
        this.ctx.arc(this.player.x - eyeOffset, this.player.y - eyeOffset, eyeSize, 0, Math.PI * 2);
        this.ctx.arc(this.player.x + eyeOffset, this.player.y - eyeOffset, eyeSize, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Pupils
        this.ctx.fillStyle = '#000000';
        this.ctx.beginPath();
        this.ctx.arc(this.player.x - eyeOffset, this.player.y - eyeOffset, eyeSize * 0.6, 0, Math.PI * 2);
        this.ctx.arc(this.player.x + eyeOffset, this.player.y - eyeOffset, eyeSize * 0.6, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Smile
        this.ctx.strokeStyle = '#000000';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.arc(this.player.x, this.player.y + eyeOffset * 0.5, eyeOffset, 0.2, Math.PI - 0.2);
        this.ctx.stroke();
        
        this.ctx.globalAlpha = 1.0;
    }

    drawObstacle(obstacle) {
        // Calculer le centre et le rayon de l'obstacle
        const centerX = obstacle.x + obstacle.width / 2;
        const centerY = obstacle.y + obstacle.height / 2;
        const radius = Math.max(obstacle.width, obstacle.height) / 2;
        
        // Dessiner le cercle principal
        this.ctx.fillStyle = obstacle.color;
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Ajouter des pics autour du cercle
        this.ctx.fillStyle = '#d32f2f';
        const spikes = 8;
        for (let i = 0; i < spikes; i++) {
            const angle = (Math.PI * 2 * i) / spikes;
            const spikeLength = 8;
            
            this.ctx.beginPath();
            this.ctx.moveTo(centerX + Math.cos(angle) * radius, centerY + Math.sin(angle) * radius);
            this.ctx.lineTo(centerX + Math.cos(angle) * (radius + spikeLength), centerY + Math.sin(angle) * (radius + spikeLength));
            this.ctx.lineTo(centerX + Math.cos(angle + 0.3) * radius, centerY + Math.sin(angle + 0.3) * radius);
            this.ctx.fill();
        }
    }

    drawParticle(particle) {
        this.ctx.globalAlpha = particle.life;
        this.ctx.fillStyle = particle.color;
        this.ctx.beginPath();
        this.ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.globalAlpha = 1.0;
    }

    drawFloatingText(text) {
        this.ctx.globalAlpha = text.life;
        this.ctx.fillStyle = text.color;
        this.ctx.font = 'bold 20px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(text.text, text.x, text.y);
        this.ctx.globalAlpha = 1.0;
    }

    updateUI() {
        document.getElementById('score-value').textContent = this.score;
        document.getElementById('size-value').textContent = this.player.sizeMultiplier.toFixed(1) + 'x';
    }

    gameOver() {
        this.gameRunning = false;
        document.getElementById('final-score').textContent = this.score;
        document.getElementById('final-size').textContent = this.player.sizeMultiplier.toFixed(1) + 'x';
        document.getElementById('game-over').classList.remove('hidden');
        
        // Victory sound or game over sound
        if (this.player.sizeMultiplier >= 3.0) {
            this.playPopSound(800, 0.5);
        } else {
            this.playPopSound(200, 0.8);
        }
    }

    forceRestart() {
        // Reset complet du jeu
        this.gameRunning = true;
        this.score = 0;
        this.gameSpeed = 2;
        
        // Reset player
        this.player.x = 100;
        this.player.y = this.canvas.height / 2;
        this.player.currentRadius = this.player.baseRadius;
        this.player.targetRadius = this.player.baseRadius;
        this.player.sizeMultiplier = 1.0;
        this.player.velocityY = 0;
        this.player.velocityX = 0;
        
        // Clear everything
        this.smallBlobs = [];
        this.obstacles = [];
        this.particles = [];
        this.floatingTexts = [];
        
        // Reset states
        this.invulnerable = false;
        this.invulnerabilityTime = 0;
        this.invulnerabilityTimer = 0;
        this.blobSpawnTimer = 0;
        this.obstacleSpawnTimer = 0;
        
        // Hide game over screen
        document.getElementById('game-over').classList.add('hidden');
        
        // Spawn initial blobs
        for (let i = 0; i < 3; i++) {
            this.spawnSmallBlob();
        }
        
        this.updateUI();
    }

    gameLoop() {
        if (this.gameRunning) {
            this.handleInput();
            this.updateObjects();
            this.updatePlayer();
            this.spawnTimers();
        }
        
        this.render();
        requestAnimationFrame(() => this.gameLoop());
    }
}

// Start the game when page loads
window.addEventListener('load', () => {
    new BlobMergeGame();
});
