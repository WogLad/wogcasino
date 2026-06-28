// crash.js

class CrashGame {
  constructor() {
    this.gameState = 'idle'; // 'idle', 'running', 'cashed_out', 'crashed'
    this.multiplier = 1.00;
    this.crashPoint = 1.00;
    this.currentBet = 0;
    
    this.startTime = 0;
    this.lastTickTime = 0;
    this.animationFrame = null;
    
    this.points = []; // Stores path points for canvas rendering
  }

  init() {
    this.view = document.getElementById('crash-view');
    this.canvas = document.getElementById('crash-canvas');
    this.ctx = this.canvas.getContext('2d');
    
    this.betInput = document.getElementById('crash-bet-input');
    this.actionBtn = document.getElementById('crash-action-btn');
    this.multiplierText = document.getElementById('crash-multiplier-text');
    
    // Quick bet buttons
    this.btnHalf = document.getElementById('crash-half-btn');
    this.btnDouble = document.getElementById('crash-double-btn');
    this.btnMax = document.getElementById('crash-max-btn');

    this.initEventListeners();
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());
    this.drawIdle();
  }

  resizeCanvas() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    // High DPI scaling
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.scale(dpr, dpr);
    this.width = rect.width;
    this.height = rect.height;
    
    if (this.gameState === 'idle') {
      this.drawIdle();
    }
  }

  initEventListeners() {
    this.btnHalf.addEventListener('click', () => {
      let val = parseFloat(this.betInput.value) || 0;
      this.betInput.value = Math.max(0.1, (val / 2)).toFixed(2);
    });
    
    this.btnDouble.addEventListener('click', () => {
      let val = parseFloat(this.betInput.value) || 0;
      this.betInput.value = Math.min(10000, (val * 2)).toFixed(2);
    });
    
    this.btnMax.addEventListener('click', () => {
      if (window.lobby) {
        this.betInput.value = Math.min(10000, window.lobby.balance).toFixed(2);
      }
    });

    this.actionBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault(); // Stop click events from double firing
      if (this.gameState === 'idle' || this.gameState === 'crashed') {
        this.startGame();
      } else if (this.gameState === 'running') {
        this.cashOut();
      }
    });
  }

  startGame() {
    const bet = parseFloat(this.betInput.value);
    
    if (isNaN(bet) || bet <= 0) {
      if (window.showToast) window.showToast("Enter a valid bet amount", "error");
      return;
    }
    
    if (window.lobby) {
      if (bet > window.lobby.balance) {
        if (window.showToast) window.showToast("Insufficient balance", "error");
        return;
      }
      
      // Deduct bet and save to cloud
      window.lobby.setBalance(window.lobby.balance - bet);
      window.lobby.saveWalletState();
    }
    
    if (window.audioEngine) {
      window.audioEngine.playChipClick();
    }

    this.currentBet = bet;
    this.gameState = 'running';
    this.multiplier = 1.00;
    
    // Generate crash point (99% RTP logic)
    let rand;
    if (window.crypto && window.crypto.getRandomValues) {
      const e = 2 ** 52;
      const h = window.crypto.getRandomValues(new Uint32Array(2));
      rand = (h[0] * 2**20 + (h[1] >>> 12)) / e; 
    } else {
      rand = Math.random();
    }
    
    // Crash point math
    this.crashPoint = Math.max(1.00, 0.99 / (1 - rand));
    
    // Hard cap at 100,000x for sanity
    if (this.crashPoint > 100000) this.crashPoint = 100000;
    
    // Optional instant crash for exact 1.00 house edge mechanic
    if (this.crashPoint < 1.01) {
      this.crashPoint = 1.00;
    }

    this.points = [];
    this.startTime = performance.now();
    this.lastTickTime = this.startTime;
    
    // Reset UI
    this.multiplierText.className = '';
    this.actionBtn.className = 'btn btn-primary bet-btn-large action-cashout';
    this.actionBtn.innerHTML = `<span>Cash Out</span>`;
    this.betInput.disabled = true;

    // Start loop
    if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
    this.animationLoop();
  }

  cashOut() {
    if (this.gameState !== 'running') return;
    
    this.gameState = 'cashed_out';
    const winAmount = this.currentBet * this.multiplier;
    
    if (window.lobby) {
      window.lobby.setBalance(window.lobby.balance + winAmount);
      window.lobby.saveWalletState();
    }
    
    if (window.audioEngine) {
      window.audioEngine.playCashOutCoin();
      if (window.showToast) window.showToast(`Cashed out at ${this.multiplier.toFixed(2)}x for $${winAmount.toFixed(2)}!`, "success");
    }
    
    // Visually update button to show cash out amount, but leave main multiplier text running
    this.actionBtn.className = 'btn btn-secondary bet-btn-large cashed-out';
    this.actionBtn.innerHTML = `<span class="gold">Cashed Out @ ${this.multiplier.toFixed(2)}x</span>`;
    this.actionBtn.disabled = true;
  }

  triggerCrash() {
    this.gameState = 'crashed';
    this.multiplier = this.crashPoint;
    
    if (window.audioEngine) {
      window.audioEngine.playExplosion();
    }
    
    // Remove any extra classes and apply red crashing state
    this.multiplierText.className = 'crashing';
    this.multiplierText.textContent = `Crashed @ ${this.multiplier.toFixed(2)}x`;
    
    this.actionBtn.className = 'btn btn-primary bet-btn-large';
    this.actionBtn.innerHTML = `<span>Place Bet</span>`;
    this.actionBtn.disabled = false;
    this.betInput.disabled = false;
    
    this.drawCurve(true); // draw final red state
  }

  animationLoop() {
    if (this.gameState === 'idle') return;

    const now = performance.now();
    const timeElapsedSeconds = (now - this.startTime) / 1000;
    
    // Audio ticking
    if (now - this.lastTickTime > 150 && this.gameState === 'running') {
      if (window.audioEngine) window.audioEngine.playRisingTick(this.multiplier);
      this.lastTickTime = now;
    }

    if (this.gameState === 'running' || this.gameState === 'cashed_out') {
      // Exponential curve formula: y = e^(0.08 * x)
      this.multiplier = Math.pow(Math.E, 0.08 * timeElapsedSeconds);
      
      if (this.multiplier >= this.crashPoint) {
        this.triggerCrash();
        return; // exit loop
      }
      
      // Update UI: always tick the text up unless crashed!
      this.multiplierText.textContent = `${this.multiplier.toFixed(2)}x`;
      
      // Update button text only if still running
      if (this.gameState === 'running') {
        const currentWin = this.currentBet * this.multiplier;
        this.actionBtn.innerHTML = `<span>Cash Out ($${currentWin.toFixed(2)})</span>`;
      }
    }

    // Add current point to graph history
    this.points.push({ time: timeElapsedSeconds, multiplier: this.multiplier });
    
    this.drawCurve();
    
    if (this.gameState !== 'crashed') {
      this.animationFrame = requestAnimationFrame(() => this.animationLoop());
    }
  }

  drawIdle() {
    this.ctx.clearRect(0, 0, this.width, this.height);
    this.multiplierText.className = '';
    this.multiplierText.textContent = '1.00x';
    
    // Draw a flat line at the bottom
    this.ctx.beginPath();
    this.ctx.moveTo(0, this.height - 20);
    this.ctx.lineTo(this.width, this.height - 20);
    this.ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    this.ctx.lineWidth = 4;
    this.ctx.stroke();
  }

  drawCurve(isCrashed = false) {
    this.ctx.clearRect(0, 0, this.width, this.height);
    
    if (this.points.length < 2) return;

    const paddingX = 40;
    const paddingY = 40;
    
    const drawWidth = this.width - paddingX * 2;
    const drawHeight = this.height - paddingY * 2;

    const maxTime = Math.max(10, this.points[this.points.length - 1].time); // minimum 10 seconds x-axis scale
    const maxMult = Math.max(2.0, this.points[this.points.length - 1].multiplier); // minimum 2x y-axis scale

    this.ctx.beginPath();
    this.ctx.moveTo(paddingX, this.height - paddingY);

    for (let p of this.points) {
      // Normalize X (time) and Y (multiplier)
      const x = paddingX + (p.time / maxTime) * drawWidth;
      
      // Map multiplier linearly to height (y-axis inverted)
      const yNorm = (p.multiplier - 1) / (maxMult - 1); // 0 to 1
      const y = (this.height - paddingY) - (yNorm * drawHeight);
      
      this.ctx.lineTo(x, y);
    }

    // Styling
    if (isCrashed) {
      this.ctx.strokeStyle = '#ff4444';
      this.ctx.shadowColor = '#ff4444';
    } else {
      this.ctx.strokeStyle = '#9d4edd'; // Purple
      this.ctx.shadowColor = '#9d4edd';
    }
    
    this.ctx.lineWidth = 6;
    this.ctx.shadowBlur = 15;
    this.ctx.lineJoin = 'round';
    this.ctx.lineCap = 'round';
    this.ctx.stroke();
    
    // Fill under the curve with a gradient
    const gradient = this.ctx.createLinearGradient(0, 0, 0, this.height);
    if (isCrashed) {
      gradient.addColorStop(0, 'rgba(255, 68, 68, 0.4)');
      gradient.addColorStop(1, 'rgba(255, 68, 68, 0.0)');
    } else {
      gradient.addColorStop(0, 'rgba(157, 78, 221, 0.4)');
      gradient.addColorStop(1, 'rgba(157, 78, 221, 0.0)');
    }
    
    // Close path for fill
    const lastP = this.points[this.points.length - 1];
    const lastX = paddingX + (lastP.time / maxTime) * drawWidth;
    const lastY = (this.height - paddingY) - (((lastP.multiplier - 1) / (maxMult - 1)) * drawHeight);
    
    this.ctx.lineTo(lastX, this.height - paddingY);
    this.ctx.lineTo(paddingX, this.height - paddingY);
    this.ctx.fillStyle = gradient;
    this.ctx.fill();
    
    // Reset shadow
    this.ctx.shadowBlur = 0;
  }
}
