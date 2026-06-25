/**
 * Mines Game Controller
 * Implements Stake.com-style Mines game logic on a 5x5 grid.
 */

class MinesGame {
  constructor(lobby) {
    this.lobby = lobby;
    this.minesCount = 3;
    this.betAmount = 10;
    
    this.grid = []; // Array of 25 tiles
    this.gemsRevealed = 0;
    this.gameActive = false;
    this.currentMultiplier = 1.0;
  }

  init() {
    this.renderEmptyGrid();
    this.bindUI();
    this.updateNextMultipliers();
  }

  /**
   * Helper to calculate combinations nCr
   */
  nCr(n, r) {
    if (r < 0 || r > n) return 0;
    if (r === 0 || r === n) return 1;
    let res = 1;
    for (let i = 1; i <= r; i++) {
      res = res * (n - i + 1) / i;
    }
    return res;
  }

  /**
   * Computes the multiplier based on prob of selecting k safe tiles in a row
   */
  getMultiplier(k) {
    if (k <= 0) return 1.0;
    const totalWays = this.nCr(25, k);
    const safeWays = this.nCr(25 - this.minesCount, k);
    if (safeWays === 0) return 0;
    const prob = safeWays / totalWays;
    // Apply 1% house edge (99% RTP)
    return 0.99 / prob;
  }

  /**
   * Renders a blank board grid on launch
   */
  renderEmptyGrid() {
    const gridContainer = document.getElementById('mines-grid');
    gridContainer.innerHTML = '';
    
    for (let i = 0; i < 25; i++) {
      const tile = document.createElement('div');
      tile.className = 'mines-tile';
      tile.setAttribute('data-index', i);
      tile.innerHTML = '<div class="tile-inner"></div>';
      gridContainer.appendChild(tile);
    }
  }

  /**
   * Links event listeners for Mines controls
   */
  bindUI() {
    // Mines count select dropdown
    const minesSelect = document.getElementById('mines-count-select');
    minesSelect.addEventListener('change', (e) => {
      if (this.gameActive) return;
      this.minesCount = parseInt(e.target.value, 10);
      this.updateNextMultipliers();
    });

    // Bet Input
    const betInput = document.getElementById('mines-bet-input');
    betInput.addEventListener('change', (e) => {
      if (this.gameActive) return;
      let val = parseFloat(e.target.value);
      if (isNaN(val) || val <= 0) val = 10;
      this.betAmount = val;
      betInput.value = val.toFixed(2);
    });

    // Quick multiplier buttons
    document.getElementById('mines-half-btn').addEventListener('click', () => {
      if (this.gameActive) return;
      this.betAmount = Math.max(0.1, this.betAmount / 2);
      betInput.value = this.betAmount.toFixed(2);
    });

    document.getElementById('mines-double-btn').addEventListener('click', () => {
      if (this.gameActive) return;
      this.betAmount = this.betAmount * 2;
      betInput.value = this.betAmount.toFixed(2);
    });

    document.getElementById('mines-max-btn').addEventListener('click', () => {
      if (this.gameActive) return;
      this.betAmount = this.lobby.balance;
      betInput.value = this.betAmount.toFixed(2);
    });

    // Main action button (Bet / Cash out)
    const actionBtn = document.getElementById('mines-action-btn');
    actionBtn.addEventListener('click', () => {
      if (!this.gameActive) {
        this.startGame();
      } else {
        this.cashOut();
      }
    });

    // Grid interaction
    const gridContainer = document.getElementById('mines-grid');
    gridContainer.addEventListener('click', (e) => {
      const tile = e.target.closest('.mines-tile');
      if (!tile || !this.gameActive) return;

      const idx = parseInt(tile.getAttribute('data-index'), 10);
      this.revealTile(idx, tile);
    });
  }

  /**
   * Starts a new round
   */
  startGame() {
    // Validate bet amount
    const betInput = document.getElementById('mines-bet-input');
    let val = parseFloat(betInput.value);
    if (isNaN(val) || val <= 0) {
      this.lobby.showToast("Invalid bet amount!", "error");
      return;
    }
    this.betAmount = val;

    if (!this.lobby.deductBalance(this.betAmount)) {
      return; // Toast handled by lobby
    }

    this.gameActive = true;
    this.gemsRevealed = 0;
    this.currentMultiplier = 1.0;
    
    // Clear outcome highlight classes
    document.getElementById('mines-grid-wrapper').classList.remove('shake-grid');

    // Create randomized grid containing M mines and 25-M gems
    const tilesList = Array(25).fill(null).map((_, i) => ({
      index: i,
      type: 'gem',
      revealed: false
    }));

    // Randomize mine positions
    let minesAssigned = 0;
    while (minesAssigned < this.minesCount) {
      const randomIdx = Math.floor(Math.random() * 25);
      if (tilesList[randomIdx].type !== 'mine') {
        tilesList[randomIdx].type = 'mine';
        minesAssigned++;
      }
    }
    this.grid = tilesList;

    // Reset tile DOM visuals
    const tiles = document.querySelectorAll('.mines-tile');
    tiles.forEach(tile => {
      tile.className = 'mines-tile active';
      tile.innerHTML = '<div class="tile-inner"></div>';
    });

    // Disable input options
    this.toggleInputsDisabled(true);

    // Update Action Button
    const actionBtn = document.getElementById('mines-action-btn');
    actionBtn.className = 'btn btn-primary mines-cashout-btn';
    actionBtn.innerHTML = `<i class="fa-solid fa-coins"></i> Start clicking tiles...`;
    
    this.updateNextMultipliers();
    this.lobby.updateBalanceDisplay();
    this.lobby.showToast("Mines game started. Good luck!", "success");

    if (window.audioEngine) {
      window.audioEngine.playChipClick();
    }
  }

  /**
   * Reveal clicked card
   */
  revealTile(index, tileElement) {
    if (this.grid[index].revealed) return;
    this.grid[index].revealed = true;

    const tileObj = this.grid[index];
    tileElement.classList.remove('active');

    if (tileObj.type === 'gem') {
      this.gemsRevealed++;
      this.currentMultiplier = this.getMultiplier(this.gemsRevealed);

      // Gem Flip Animation CSS
      tileElement.classList.add('revealed-gem');
      tileElement.innerHTML = `
        <div class="tile-inner font-icon">
          <i class="fa-solid fa-gem"></i>
        </div>
      `;

      // Play customized pentatonic progression sound based on gems hit
      if (window.audioEngine) {
        window.audioEngine.playGemReveal(this.gemsRevealed);
      }

      // Update cashout button
      const winAmount = this.betAmount * this.currentMultiplier;
      const actionBtn = document.getElementById('mines-action-btn');
      actionBtn.innerHTML = `<i class="fa-solid fa-coins"></i> Cash Out $${winAmount.toFixed(2)} (${this.currentMultiplier.toFixed(2)}x)`;

      this.updateNextMultipliers();

      // Check max win (all safe cells revealed)
      const maxGems = 25 - this.minesCount;
      if (this.gemsRevealed === maxGems) {
        this.cashOut(true);
      }
    } else {
      // Exploded on a mine!
      this.gameActive = false;
      tileElement.classList.add('revealed-mine');
      tileElement.innerHTML = `
        <div class="tile-inner font-icon">
          <i class="fa-solid fa-bomb"></i>
        </div>
      `;

      // Shake visual
      const gridWrapper = document.getElementById('mines-grid-wrapper');
      gridWrapper.classList.add('shake-grid');

      if (window.audioEngine) {
        window.audioEngine.playExplosion();
      }

      this.lobby.showToast(`BOOM! Hit a mine. Bet lost: -$${this.betAmount.toFixed(2)}`, "error");
      
      this.revealRemainingBoard(false);
      this.endGame();
    }
  }

  /**
   * Cash out current earnings
   */
  cashOut(isMaxWin = false) {
    if (!this.gameActive) return;
    this.gameActive = false;

    const finalMultiplier = this.getMultiplier(this.gemsRevealed);
    const winAmount = this.betAmount * finalMultiplier;
    this.lobby.addBalance(winAmount);

    if (window.audioEngine) {
      window.audioEngine.playCashOutCoin();
    }

    if (isMaxWin) {
      this.lobby.showToast(`🏆 MAX WIN! Cleared all gems! Won: +$${winAmount.toFixed(2)}`, "success");
    } else {
      this.lobby.showToast(`Cashed out! Won: +$${winAmount.toFixed(2)} (${finalMultiplier.toFixed(2)}x)`, "success");
    }

    this.revealRemainingBoard(true);
    this.endGame();
  }

  /**
   * End state cleanups
   */
  endGame() {
    this.toggleInputsDisabled(false);
    
    const actionBtn = document.getElementById('mines-action-btn');
    actionBtn.className = 'btn btn-primary';
    actionBtn.innerHTML = `<i class="fa-solid fa-play"></i> Bet`;
    
    this.updateNextMultipliers();
    this.lobby.updateBalanceDisplay();
  }

  /**
   * Reveal remaining cards translucent style at the end of the round
   */
  revealRemainingBoard(isWin) {
    const tiles = document.querySelectorAll('.mines-tile');
    
    this.grid.forEach((tileObj, i) => {
      if (tileObj.revealed) return; // already revealed
      
      const el = tiles[i];
      el.classList.remove('active');
      
      if (tileObj.type === 'mine') {
        el.classList.add('unrevealed-mine-ghost');
        el.innerHTML = `
          <div class="tile-inner font-icon">
            <i class="fa-solid fa-bomb"></i>
          </div>
        `;
      } else {
        el.classList.add('unrevealed-gem-ghost');
        el.innerHTML = `
          <div class="tile-inner font-icon">
            <i class="fa-solid fa-gem"></i>
          </div>
        `;
      }
    });
  }

  /**
   * Toggle bet configurations
   */
  toggleInputsDisabled(disable) {
    document.getElementById('mines-bet-input').disabled = disable;
    document.getElementById('mines-count-select').disabled = disable;
    document.getElementById('mines-half-btn').disabled = disable;
    document.getElementById('mines-double-btn').disabled = disable;
    document.getElementById('mines-max-btn').disabled = disable;
  }

  /**
   * Updates visual listing of upcoming payout multipliers
   */
  updateNextMultipliers() {
    const previewList = document.getElementById('mines-multipliers-preview');
    previewList.innerHTML = '';
    
    // Show next 5 multipliers
    const startGem = this.gameActive ? this.gemsRevealed + 1 : 1;
    const maxGems = 25 - this.minesCount;
    
    for (let k = startGem; k <= Math.min(startGem + 4, maxGems); k++) {
      const mult = this.getMultiplier(k);
      const card = document.createElement('div');
      card.className = `multiplier-badge ${k === startGem ? 'highlight' : ''}`;
      card.innerHTML = `
        <span class="mult-gems-label">${k} Gems</span>
        <span class="mult-value-label">${mult.toFixed(2)}x</span>
      `;
      previewList.appendChild(card);
    }
  }
}

window.MinesGame = MinesGame;
