/**
 * Canvas Roulette Wheel Controller
 * Handles drawing and physical animation of the roulette wheel and ball.
 */

class RouletteWheel {
  constructor(canvasId, onSpinComplete) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.onSpinComplete = onSpinComplete;

    // European Roulette Wheel layout (clockwise starting from 0)
    this.pockets = [
      0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 
      10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26
    ];

    // Pocket colors mapping
    this.pocketColors = this.pockets.map(num => {
      if (num === 0) return '#2ec4b6'; // Emerald Green
      // Standard red numbers
      const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
      return redNumbers.includes(num) ? '#e63946' : '#1a1a1a'; // Red or Black
    });

    // Animation & Physics parameters
    this.wheelAngle = 0;
    this.wheelSpeed = 0;
    this.ballAngle = 0;
    this.ballSpeed = 0;
    this.ballRadius = 0.82; // Normalized relative to wheel size
    this.ballState = 'idle'; // 'idle' | 'orbit' | 'drop' | 'bounce' | 'settled'
    
    this.targetNumber = 0;
    this.bounceProgress = 0;
    this.bounceSequence = [];
    this.settledTime = 0;
    
    // Scale for high-resolution retina screens
    this.setupResize();
    this.render();
  }

  /**
   * Resizes canvas based on container and sets scale for HD screens
   */
  setupResize() {
    const resize = () => {
      const rect = this.canvas.parentElement.getBoundingClientRect();
      const size = Math.min(rect.width, rect.height, 600);
      
      const dpr = window.devicePixelRatio || 1;
      this.canvas.width = size * dpr;
      this.canvas.height = size * dpr;
      this.canvas.style.width = `${size}px`;
      this.canvas.style.height = `${size}px`;
      
      this.ctx.scale(dpr, dpr);
      this.drawSize = size;
      this.draw();
    };

    window.addEventListener('resize', resize);
    resize();
  }

  /**
   * Triggers the spin animation sequence
   * @param {number} targetNumber The pre-determined winning number
   */
  spin(targetNumber) {
    if (this.ballState === 'orbit' || this.ballState === 'drop' || this.ballState === 'bounce') return;

    this.targetNumber = targetNumber;
    
    // Set random initial speeds for physical variation
    this.wheelSpeed = 0.08 + Math.random() * 0.04; // Radians per frame
    this.ballSpeed = -0.25 - Math.random() * 0.08; // Orbit opposite direction
    
    this.ballAngle = Math.random() * Math.PI * 2;
    this.ballRadius = 0.82; // Start on outer track
    this.ballState = 'orbit';
    this.bounceProgress = 0;
    this.settledTime = 0;

    // Generate a believable bouncing sequence around the winning number
    const targetIdx = this.pockets.indexOf(targetNumber);
    
    // Construct simulated bounces: landing offset slots relative to the target index
    // e.g. ball hits a pin, hops 3 slots past, rebounds 1 slot back, then falls in target
    const offsets = [
      Math.random() > 0.5 ? 4 : -4,
      Math.random() > 0.5 ? 2 : -2,
      Math.random() > 0.5 ? -1 : 1,
      0 // Settle in the target pocket
    ];

    this.bounceSequence = offsets.map(offset => {
      let idx = (targetIdx + offset) % 37;
      if (idx < 0) idx += 37;
      return idx;
    });

    // Start tick audio loop if wheel spins
    this.lastTickAngle = 0;
  }

  /**
   * Internal render frame tick
   */
  render() {
    this.update();
    this.draw();
    requestAnimationFrame(() => this.render());
  }

  /**
   * Physics updates for each frame
   */
  update() {
    // 1. Decelerate the wheel slowly
    this.wheelAngle += this.wheelSpeed;
    this.wheelSpeed *= 0.995;
    if (this.wheelSpeed < 0.005) this.wheelSpeed = 0.005; // Keep a slow idle rotation

    // 2. Manage the ball states and physics
    if (this.ballState === 'orbit') {
      this.ballAngle += this.ballSpeed;
      this.ballSpeed *= 0.985; // Ball slows down on outer track
      
      // Play occasional tick sound as ball orbits past pocket dividers (frequency dependent on speed)
      if (Math.abs(this.ballAngle - this.lastTickAngle) > (Math.PI / 18)) {
        if (typeof window.audioEngine !== 'undefined') {
          window.audioEngine.playWheelTick(Math.min(0.08, Math.abs(this.ballSpeed) * 0.3));
        }
        this.lastTickAngle = this.ballAngle;
      }

      // Ball drops when speed falls below threshold
      if (Math.abs(this.ballSpeed) < 0.07) {
        this.ballState = 'drop';
      }
    } else if (this.ballState === 'drop') {
      // Ball spirals inward from outer track to pockets
      this.ballAngle += this.ballSpeed;
      this.ballSpeed *= 0.97;
      this.ballRadius -= 0.012; // Spiral in

      if (this.ballRadius <= 0.65) {
        this.ballState = 'bounce';
        this.bounceProgress = 0;
        this.bounceIndex = 0;
        if (typeof window.audioEngine !== 'undefined') {
          window.audioEngine.playBallBounce(0.25);
        }
      }
    } else if (this.ballState === 'bounce') {
      // Bounce through the pre-generated sequence
      const targetPocketIdx = this.bounceSequence[this.bounceIndex];
      const targetPocketAngle = this.wheelAngle + targetPocketIdx * (Math.PI * 2 / 37);
      
      // Interpolate ball coordinates to simulate bouncing
      this.ballRadius = 0.61 + Math.sin(this.bounceProgress * Math.PI) * 0.08; // Arc bounce height
      
      // Smoothly pull ball angle towards current target bounce pocket
      const diff = targetPocketAngle - this.ballAngle;
      this.ballAngle += diff * 0.25;

      this.bounceProgress += 0.12;
      
      if (this.bounceProgress >= 1) {
        this.bounceProgress = 0;
        this.bounceIndex++;
        
        if (typeof window.audioEngine !== 'undefined') {
          // Play a slightly softer bounce each time
          window.audioEngine.playBallBounce(0.25 - this.bounceIndex * 0.05);
        }

        if (this.bounceIndex >= this.bounceSequence.length) {
          this.ballState = 'settled';
          this.settledTime = Date.now();
        }
      }
    } else if (this.ballState === 'settled') {
      // Lock ball inside the target pocket relative to the rotating wheel
      const targetPocketIdx = this.pockets.indexOf(this.targetNumber);
      this.ballAngle = this.wheelAngle + targetPocketIdx * (Math.PI * 2 / 37);
      this.ballRadius = 0.60;
      
      // Delay briefly before reporting the outcome
      if (this.settledTime && Date.now() - this.settledTime > 800) {
        this.settledTime = 0; // Trigger once
        if (this.onSpinComplete) {
          this.onSpinComplete(this.targetNumber);
        }
      }
    } else {
      // 'idle' - lock to slot 0 or current position
      const targetPocketIdx = this.pockets.indexOf(this.targetNumber);
      this.ballAngle = this.wheelAngle + targetPocketIdx * (Math.PI * 2 / 37);
      this.ballRadius = 0.60;
    }
  }

  /**
   * Draws the wheel on the canvas context
   */
  draw() {
    if (!this.ctx || !this.drawSize) return;

    const ctx = this.ctx;
    const center = this.drawSize / 2;
    const radius = center * 0.95;

    ctx.clearRect(0, 0, this.drawSize, this.drawSize);

    // 1. Draw outer premium wooden bezel (gradient ring)
    const woodGrad = ctx.createRadialGradient(center, center, radius * 0.85, center, center, radius);
    woodGrad.addColorStop(0, '#2d1a10');
    woodGrad.addColorStop(0.3, '#4a2c1b');
    woodGrad.addColorStop(0.8, '#1e110a');
    woodGrad.addColorStop(1, '#0b0604');
    ctx.beginPath();
    ctx.arc(center, center, radius, 0, Math.PI * 2);
    ctx.fillStyle = woodGrad;
    ctx.fill();

    // Wood highlight/rim lines
    ctx.beginPath();
    ctx.arc(center, center, radius, 0, Math.PI * 2);
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#d4af37'; // Gold edge
    ctx.stroke();

    // Wood inner shadow border
    ctx.beginPath();
    ctx.arc(center, center, radius * 0.86, 0, Math.PI * 2);
    ctx.strokeStyle = '#050302';
    ctx.lineWidth = 4;
    ctx.stroke();

    // 2. Brass/Gold track slope
    const trackGrad = ctx.createRadialGradient(center, center, radius * 0.68, center, center, radius * 0.85);
    trackGrad.addColorStop(0, '#1a1d20');
    trackGrad.addColorStop(0.2, '#d4af37'); // Brass track reflection
    trackGrad.addColorStop(0.5, '#7a5f13');
    trackGrad.addColorStop(0.9, '#a37f1c');
    trackGrad.addColorStop(1, '#111');
    ctx.beginPath();
    ctx.arc(center, center, radius * 0.85, 0, Math.PI * 2);
    ctx.arc(center, center, radius * 0.68, 0, Math.PI * 2, true);
    ctx.fillStyle = trackGrad;
    ctx.fill();

    // Metal pins/deflectors along the track (8 brass diamond studs)
    ctx.fillStyle = '#fce293';
    ctx.shadowBlur = 4;
    ctx.shadowColor = '#000';
    for (let i = 0; i < 8; i++) {
      const pinAngle = (i * Math.PI / 4) + (this.wheelAngle * 0.1); // Slightly drifts/spins slow
      const pinX = center + Math.cos(pinAngle) * radius * 0.77;
      const pinY = center + Math.sin(pinAngle) * radius * 0.77;
      
      ctx.beginPath();
      ctx.arc(pinX, pinY, radius * 0.015, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0; // Reset shadow

    // 3. Inner wheel core - background of pockets
    ctx.beginPath();
    ctx.arc(center, center, radius * 0.68, 0, Math.PI * 2);
    ctx.fillStyle = '#0f1115';
    ctx.fill();

    // Draw pocket slices
    const numPockets = this.pockets.length;
    const sliceAngle = (Math.PI * 2) / numPockets;

    ctx.save();
    ctx.translate(center, center);
    ctx.rotate(this.wheelAngle);

    for (let i = 0; i < numPockets; i++) {
      const angle = i * sliceAngle;

      // Draw color sector slice
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, radius * 0.68, angle - sliceAngle / 2, angle + sliceAngle / 2);
      ctx.closePath();
      ctx.fillStyle = this.pocketColors[i];
      ctx.fill();

      // Divider lines (silver metal)
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(angle - sliceAngle / 2) * radius * 0.68, Math.sin(angle - sliceAngle / 2) * radius * 0.68);
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.stroke();

      // Number text
      ctx.save();
      ctx.rotate(angle);
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${radius * 0.05}px "Outfit", "Inter", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      // Rotate numbers outward to face outwards
      ctx.translate(0, -radius * 0.58);
      ctx.rotate(Math.PI);
      ctx.fillText(this.pockets[i].toString(), 0, 0);
      ctx.restore();
    }
    ctx.restore();

    // 4. Center turret assembly (brass spinner cone & handles)
    const turretGrad = ctx.createRadialGradient(center, center, 0, center, center, radius * 0.45);
    turretGrad.addColorStop(0, '#fff3cc');
    turretGrad.addColorStop(0.2, '#e0b83c');
    turretGrad.addColorStop(0.5, '#735712');
    turretGrad.addColorStop(0.9, '#a88523');
    turretGrad.addColorStop(1, '#2c1e05');

    ctx.beginPath();
    ctx.arc(center, center, radius * 0.45, 0, Math.PI * 2);
    ctx.fillStyle = turretGrad;
    ctx.fill();

    // Turret handles/spokes (spinning with the wheel)
    ctx.save();
    ctx.translate(center, center);
    ctx.rotate(this.wheelAngle * 1.25); // Spun slightly faster or standard

    // Draw 4 handles
    ctx.fillStyle = '#e8c458';
    ctx.shadowBlur = 6;
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    for (let i = 0; i < 4; i++) {
      const handleAngle = (i * Math.PI / 2);
      ctx.save();
      ctx.rotate(handleAngle);
      
      // Spoke shaft
      ctx.fillRect(-radius * 0.02, -radius * 0.35, radius * 0.04, radius * 0.35);
      
      // Spoke handle tip (brass ball)
      ctx.beginPath();
      ctx.arc(0, -radius * 0.35, radius * 0.035, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.restore();
    }
    
    // Central cap
    const capGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, radius * 0.08);
    capGrad.addColorStop(0, '#fff');
    capGrad.addColorStop(0.4, '#d4af37');
    capGrad.addColorStop(1, '#574208');
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.09, 0, Math.PI * 2);
    ctx.fillStyle = capGrad;
    ctx.fill();
    
    ctx.restore();

    // 5. Draw the spinning white ball
    if (this.ballState !== 'idle') {
      const ballX = center + Math.cos(this.ballAngle) * radius * this.ballRadius;
      const ballY = center + Math.sin(this.ballAngle) * radius * this.ballRadius;
      const ballSize = radius * 0.035;

      // Ball shadow
      ctx.beginPath();
      ctx.arc(ballX + radius * 0.01, ballY + radius * 0.01, ballSize, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.fill();

      // Ball 3D shine gradient
      const ballGrad = ctx.createRadialGradient(
        ballX - ballSize * 0.3, 
        ballY - ballSize * 0.3, 
        0, 
        ballX, 
        ballY, 
        ballSize
      );
      ballGrad.addColorStop(0, '#ffffff');
      ballGrad.addColorStop(0.7, '#e0e0e0');
      ballGrad.addColorStop(1, '#a8a8a8');

      ctx.beginPath();
      ctx.arc(ballX, ballY, ballSize, 0, Math.PI * 2);
      ctx.fillStyle = ballGrad;
      ctx.fill();
    }
  }
}

window.RouletteWheel = RouletteWheel;
