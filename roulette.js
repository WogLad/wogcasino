/**
 * Roulette Game Controller
 * Manages the roulette view, betting board actions, spin physics, and payout calculations.
 */

class RouletteGame {
  constructor(lobby) {
    this.lobby = lobby; // Reference to central lobby manager
    this.currentBets = new Map(); // Key: zoneKey, Value: { type, numbers, amount }
    this.lastBets = null; // Saves a copy of bets for "Rebet"
    this.spinHistory = [];
    this.gameState = 'betting'; // 'betting' | 'spinning' | 'payout'
    this.activeChipValue = 5;

    // Red numbers reference
    this.redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
    
    this.prepopulateHistory();
  }

  init() {
    // 1. Initialize Board
    this.board = new RouletteBoard('betting-board-container', (key, type, numbers, chipValue) => {
      this.handleBetPlacement(key, type, numbers, chipValue);
    });

    // 2. Initialize Wheel
    this.wheel = new RouletteWheel('wheel-canvas', (winningNum) => {
      this.resolveSpin(winningNum);
    });

    // 3. Setup UI bindings
    this.bindUI();
    this.updateUI();
  }

  /**
   * Generates a starter list of numbers so statistics are populated on launch
   */
  prepopulateHistory() {
    for (let i = 0; i < 15; i++) {
      this.spinHistory.push(Math.floor(Math.random() * 37));
    }
  }

  /**
   * Listeners for buttons and chip selectors inside roulette screen
   */
  bindUI() {
    // Chip selection clicks
    const chipButtons = document.querySelectorAll('#roulette-view .chip-select-btn');
    chipButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        if (this.gameState !== 'betting') return;
        
        chipButtons.forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        
        const val = parseInt(btn.getAttribute('data-value'), 10);
        this.activeChipValue = val;
        this.board.setChipValue(val);

        if (window.audioEngine) {
          window.audioEngine.playChipClick();
        }
      });
    });

    // Control buttons
    document.getElementById('spin-btn').addEventListener('click', () => this.startSpin());
    document.getElementById('clear-btn').addEventListener('click', () => this.clearBets());
    document.getElementById('double-btn').addEventListener('click', () => this.doubleBets());
    document.getElementById('rebet-btn').addEventListener('click', () => this.repeatLastBet());
  }

  /**
   * Handle placement of chips from RouletteBoard callbacks
   */
  handleBetPlacement(key, type, numbers, amount) {
    if (this.gameState !== 'betting') return;

    // सेंट्रल लॉबी वॉलेट से कटौती
    if (!this.lobby.deductBalance(amount)) {
      return; // Insufficient balance (toast already triggered by lobby)
    }

    if (this.currentBets.has(key)) {
      const existing = this.currentBets.get(key);
      existing.amount += amount;
    } else {
      this.currentBets.set(key, { type, numbers, amount });
    }

    // Refresh visuals on board
    const totalBetForZone = this.currentBets.get(key).amount;
    this.board.placeChipVisual(key, totalBetForZone);
    
    this.updateUI();
  }

  /**
   * Clear active bets, refunding the user
   */
  clearBets() {
    if (this.gameState !== 'betting') return;
    if (this.currentBets.size === 0) return;

    // Refund bets
    let refund = 0;
    this.currentBets.forEach(bet => {
      refund += bet.amount;
    });

    this.lobby.addBalance(refund);
    this.currentBets.clear();
    this.board.clearAllChips();
    
    this.updateUI();
    this.lobby.showToast("Bets Cleared & Refunded", "info");
  }

  /**
   * Doubles all active bets if balance permits
   */
  doubleBets() {
    if (this.gameState !== 'betting') return;
    if (this.currentBets.size === 0) return;

    let extraCost = 0;
    this.currentBets.forEach(bet => {
      extraCost += bet.amount;
    });

    if (!this.lobby.deductBalance(extraCost)) {
      return; // Insufficient balance (toast handled by lobby)
    }

    this.currentBets.forEach(bet => {
      bet.amount *= 2;
    });

    // Re-draw board chips
    this.currentBets.forEach((bet, key) => {
      this.board.placeChipVisual(key, bet.amount);
    });

    this.updateUI();
    this.lobby.showToast("Bets Doubled!", "success");
  }

  /**
   * Re-places the chips from the previous spin
   */
  repeatLastBet() {
    if (this.gameState !== 'betting') return;
    if (!this.lastBets || this.lastBets.size === 0) {
      this.lobby.showToast("No previous bets to repeat!", "info");
      return;
    }

    let cost = 0;
    this.lastBets.forEach(bet => {
      cost += bet.amount;
    });

    if (!this.lobby.deductBalance(cost)) {
      return; // Insufficient balance (toast handled by lobby)
    }

    // Clear active first
    this.clearBets();

    this.lastBets.forEach((bet, key) => {
      this.currentBets.set(key, { ...bet });
      this.board.placeChipVisual(key, bet.amount);
    });

    this.updateUI();
    this.lobby.showToast("Previous Bets Placed", "success");
  }

  /**
   * Launches the spin
   */
  startSpin() {
    if (this.gameState !== 'betting') return;
    
    if (this.currentBets.size === 0) {
      this.lobby.showToast("Place a bet first!", "info");
      return;
    }

    this.gameState = 'spinning';
    this.board.clearWinningHighlight();
    this.hideOutcomeModal();

    // Disable board buttons
    this.toggleControlsDisabled(true);

    // Roll random winner
    const winningNum = Math.floor(Math.random() * 37);
    this.wheel.spin(winningNum);
  }

  /**
   * Resolves payouts and shows results modal
   */
  resolveSpin(winningNum) {
    this.gameState = 'payout';

    // Highlight cell on board
    this.board.highlightWinningNumber(winningNum);

    // Calculate payouts
    let totalWinAmount = 0;
    let totalBetAmount = 0;

    this.currentBets.forEach((bet) => {
      totalBetAmount += bet.amount;
      if (bet.numbers.includes(winningNum)) {
        const payoutMultiplier = this.getPayoutMultiplier(bet.type);
        const winReward = bet.amount * payoutMultiplier;
        totalWinAmount += (winReward + bet.amount); // Profit + Returned Bet
      }
    });

    // Credit balance to central wallet
    this.lobby.addBalance(totalWinAmount);

    // UI Toast and banner outcomes
    const netChange = totalWinAmount - totalBetAmount;
    this.showOutcomeModal(winningNum, totalWinAmount, netChange);

    // Sound effect trigger
    if (window.audioEngine) {
      if (totalWinAmount > 0) {
        window.audioEngine.playWinJingle();
      } else if (totalBetAmount > 0) {
        window.audioEngine.playLoseJingle();
      }
    }

    // Save bets as "last bets" copy for Rebet
    this.lastBets = new Map(this.currentBets);

    // Reset layout
    this.currentBets.clear();
    this.board.clearAllChips();

    // Update spin history
    this.spinHistory.push(winningNum);
    if (this.spinHistory.length > 50) this.spinHistory.shift();

    this.gameState = 'betting';
    this.toggleControlsDisabled(false);
    this.updateUI();
  }

  /**
   * Standard roulette payout odds multiplier
   */
  getPayoutMultiplier(type) {
    switch (type) {
      case 'straight': return 35;
      case 'split': return 17;
      case 'street': return 11;
      case 'corner': return 8;
      case 'line': return 5;
      case 'dozen': return 2;
      case 'column': return 2;
      case 'even_odd': return 1;
      case 'red_black': return 1;
      case 'low_high': return 1;
      default: return 0;
    }
  }

  /**
   * Enable/Disable game dashboard buttons
   */
  toggleControlsDisabled(disable) {
    document.getElementById('spin-btn').disabled = disable;
    document.getElementById('clear-btn').disabled = disable;
    document.getElementById('double-btn').disabled = disable;
    document.getElementById('rebet-btn').disabled = disable;
    
    const chipBtns = document.querySelectorAll('#roulette-view .chip-select-btn');
    chipBtns.forEach(btn => {
      btn.disabled = disable;
      btn.style.opacity = disable ? '0.4' : '1';
    });
  }

  /**
   * Update text labels, dashboard metrics, and stats diagrams
   */
  updateUI() {
    // Update central bankroll HUD fields
    this.lobby.updateBalanceDisplay();
    
    let totalBet = 0;
    this.currentBets.forEach(bet => {
      totalBet += bet.amount;
    });
    document.getElementById('roulette-total-bet').innerText = `$${totalBet}`;

    // Enable/disable repeat bets button based on history availability
    document.getElementById('rebet-btn').disabled = !this.lastBets || this.gameState !== 'betting';

    // 2. Render history queue
    const historyList = document.getElementById('history-list');
    historyList.innerHTML = '';
    
    // Show last 10 in reverse order
    const displayHistory = [...this.spinHistory].reverse().slice(0, 10);
    displayHistory.forEach(num => {
      const bubble = document.createElement('div');
      const color = this.getNumberColor(num);
      bubble.className = `history-bubble ${color}`;
      bubble.innerText = num;
      historyList.appendChild(bubble);
    });

    // 3. Render stats panel
    this.updateStatsPanel();
  }

  /**
   * Color mapping for numbers
   */
  getNumberColor(num) {
    if (num === 0) return 'green';
    return this.redNumbers.includes(num) ? 'red' : 'black';
  }

  /**
   * Updates stats panel with hot/cold lists and ratios
   */
  updateStatsPanel() {
    if (this.spinHistory.length === 0) return;

    // Calculate Hot/Cold frequencies
    const counts = {};
    for (let i = 0; i <= 36; i++) counts[i] = 0;
    this.spinHistory.forEach(num => {
      counts[num]++;
    });

    // Sort numbers by frequency
    const sorted = Object.keys(counts).map(num => ({
      num: parseInt(num, 10),
      count: counts[num]
    })).sort((a, b) => b.count - a.count);

    // Hot numbers = top 4
    const hotContainer = document.getElementById('hot-numbers');
    hotContainer.innerHTML = '';
    sorted.slice(0, 4).forEach(item => {
      const chip = document.createElement('div');
      chip.className = `stat-chip ${this.getNumberColor(item.num)}`;
      chip.innerHTML = `${item.num} <span class="stat-count">(${item.count}x)</span>`;
      hotContainer.appendChild(chip);
    });

    // Cold numbers = bottom 4
    const coldContainer = document.getElementById('cold-numbers');
    coldContainer.innerHTML = '';
    const coldSorted = [...sorted].reverse();
    coldSorted.slice(0, 4).forEach(item => {
      const chip = document.createElement('div');
      chip.className = `stat-chip ${this.getNumberColor(item.num)}`;
      chip.innerHTML = `${item.num} <span class="stat-count">(${item.count}x)</span>`;
      coldContainer.appendChild(chip);
    });

    // Color Ratio Bar Graph
    let redCount = 0, blackCount = 0, greenCount = 0;
    this.spinHistory.forEach(num => {
      const color = this.getNumberColor(num);
      if (color === 'red') redCount++;
      else if (color === 'black') blackCount++;
      else greenCount++;
    });

    const total = this.spinHistory.length;
    const redPct = Math.round((redCount / total) * 100);
    const blackPct = Math.round((blackCount / total) * 100);
    const greenPct = 100 - redPct - blackPct;

    const redBar = document.getElementById('ratio-red');
    const blackBar = document.getElementById('ratio-black');
    const greenBar = document.getElementById('ratio-green');

    redBar.style.width = `${redPct}%`;
    redBar.querySelector('span').innerText = redPct > 10 ? `${redPct}%` : '';
    
    blackBar.style.width = `${blackPct}%`;
    blackBar.querySelector('span').innerText = blackPct > 10 ? `${blackPct}%` : '';
    
    greenBar.style.width = `${greenPct}%`;
    greenBar.querySelector('span').innerText = greenPct > 10 ? `${greenPct}%` : '';
  }

  /**
   * Helper to display an overlay notification modal for spin results
   */
  showOutcomeModal(winningNum, wonAmt, netChange) {
    const modal = document.getElementById('outcome-overlay');
    const numberDisplay = document.getElementById('outcome-number');
    const textDisplay = document.getElementById('outcome-text');
    const subtextDisplay = document.getElementById('outcome-subtext');

    numberDisplay.innerText = winningNum;
    numberDisplay.className = `outcome-num-circle ${this.getNumberColor(winningNum)}`;

    if (wonAmt > 0) {
      textDisplay.innerText = `WIN $${wonAmt}!`;
      textDisplay.className = 'outcome-win-title';
      subtextDisplay.innerText = `Net Profit: +$${netChange}`;
    } else if (netChange < 0) {
      textDisplay.innerText = "NO WIN";
      textDisplay.className = 'outcome-lose-title';
      subtextDisplay.innerText = `Loss: -$${Math.abs(netChange)}`;
    } else {
      textDisplay.innerText = "SPIN RESOLVED";
      textDisplay.className = 'outcome-neutral-title';
      subtextDisplay.innerText = "No bets active.";
    }

    modal.classList.add('active');

    if (this.modalTimeout) clearTimeout(this.modalTimeout);
    this.modalTimeout = setTimeout(() => {
      this.hideOutcomeModal();
    }, 3200);
  }

  hideOutcomeModal() {
    const modal = document.getElementById('outcome-overlay');
    if (modal) modal.classList.remove('active');
  }
}

window.RouletteGame = RouletteGame;
