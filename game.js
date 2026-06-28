/**
 * Lobby & Shared Wallet Manager
 * Central state coordinator handling view routing, local storage wallet caching,
 * and instantiating individual game sub-engines (Roulette and Mines).
 */

class CasinoLobby {
  constructor() {
    // Read cached bankroll from localStorage or default to $1,000
    const cachedBalance = localStorage.getItem('casino_wallet_balance');
    this.balance = cachedBalance ? parseFloat(cachedBalance) : 1000.0;
    if (isNaN(this.balance) || this.balance <= 0) {
      this.balance = 1000.0;
      localStorage.setItem('casino_wallet_balance', '1000.00');
    }
    
    this.currentView = 'lobby'; // 'lobby' | 'roulette' | 'mines' | 'crash'
    
    this.rouletteInitialized = false;
    this.minesInitialized = false;
    this.crashInitialized = false;
    
    window.lobby = this;
  }

  init() {
    // Instantiate games with a back-reference to this lobby manager
    this.rouletteGame = new RouletteGame(this);
    this.minesGame = new MinesGame(this);
    this.crashGame = new CrashGame(this);

    this.bindGlobalUI();
    this.updateBalanceDisplay();
    
    // Export globally for auth and db scripts
    window.showToast = this.showToast.bind(this);
  }

  /**
   * Bind lobby routing and global icons
   */
  bindGlobalUI() {
    // Lobby Game Selection Cards
    document.getElementById('play-roulette-btn').addEventListener('click', () => {
      this.launchGame('roulette');
    });

    document.getElementById('play-mines-btn').addEventListener('click', () => {
      this.launchGame('mines');
    });

    document.getElementById('play-crash-btn').addEventListener('click', () => {
      this.launchGame('crash');
    });

    // Back to Lobby buttons
    const backBtns = document.querySelectorAll('.back-to-lobby-btn');
    backBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        // Prevent going back during active spin or active mines round
        if (this.rouletteGame.gameState === 'spinning') {
          this.showToast("Cannot leave during wheel spin!", "error");
          return;
        }
        if (this.minesGame && this.minesGame.gameActive) {
          this.showToast("Cannot leave during active Mines round! Cash out first.", "error");
          return;
        }
        if (this.crashGame && this.crashGame.gameState === 'running') {
          this.showToast("Cannot leave during active Crash round! Cash out first.", "error");
          return;
        }
        this.switchView('lobby');
      });
    });

    // Global audio toggle
    const audioBtn = document.getElementById('audio-toggle-btn');
    audioBtn.addEventListener('click', () => {
      if (window.audioEngine) {
        const isMuted = window.audioEngine.toggleMute();
        audioBtn.innerHTML = isMuted 
          ? '<i class="fas fa-volume-mute"></i>' 
          : '<i class="fas fa-volume-up"></i>';
        audioBtn.classList.toggle('muted', isMuted);
      }
    });

    // Global Info Modal toggles (Roulette Info)
    const infoBtn = document.getElementById('info-btn');
    const infoModal = document.getElementById('info-modal');
    const closeInfoBtn = document.getElementById('close-info-btn');

    infoBtn.addEventListener('click', () => {
      infoModal.classList.add('active');
    });
    closeInfoBtn.addEventListener('click', () => {
      infoModal.classList.remove('active');
    });
    infoModal.addEventListener('click', (e) => {
      if (e.target === infoModal) infoModal.classList.remove('active');
    });
  }

  /**
   * Handles starting a game and running its initialize hooks
   */
  launchGame(gameName) {
    if (gameName === 'roulette') {
      if (!this.rouletteInitialized) {
        this.rouletteGame.init();
        this.rouletteInitialized = true;
      }
      this.rouletteGame.updateUI();
      // Show info btn only for roulette rules
      document.getElementById('info-btn').style.display = 'flex';
      this.switchView('roulette');
    } else if (gameName === 'mines') {
      if (!this.minesInitialized) {
        this.minesGame.init();
        this.minesInitialized = true;
      }
      this.minesGame.updateNextMultipliers();
      // Hide roulette-only rules icon
      document.getElementById('info-btn').style.display = 'none';
      this.switchView('mines');
    } else if (gameName === 'crash') {
      if (!this.crashInitialized) {
        this.crashGame.init();
        this.crashInitialized = true;
      }
      document.getElementById('info-btn').style.display = 'none';
      this.switchView('crash');
    }
  }

  /**
   * Handles visual transitions between DOM containers
   */
  switchView(viewName) {
    this.currentView = viewName;
    
    const views = ['lobby-view', 'roulette-view', 'mines-view', 'crash-view'];
    views.forEach(v => {
      const el = document.getElementById(v);
      if (v === `${viewName}-view`) {
        el.classList.add('active-view');
      } else {
        el.classList.remove('active-view');
      }
    });

    this.updateBalanceDisplay();

    // Trigger window resize event to redraw/recalculate canvas layouts
    window.dispatchEvent(new Event('resize'));
  }

  /**
   * CENTRAL BALANCE OPERATIONS
   */
  deductBalance(amount) {
    if (this.balance < amount) {
      this.showToast("Insufficient Balance!", "error");
      return false;
    }
    this.balance -= amount;
    this.saveWalletState();
    this.updateBalanceDisplay();
    return true;
  }

  addBalance(amount) {
    this.balance += amount;
    this.saveWalletState();
    this.updateBalanceDisplay();
  }

  setBalance(amount) {
    this.balance = amount;
    localStorage.setItem('casino_wallet_balance', this.balance.toFixed(2));
    this.updateBalanceDisplay();
  }

  saveWalletState() {
    localStorage.setItem('casino_wallet_balance', this.balance.toFixed(2));
    
    // Sync with cloud database if initialized and logged in
    if (window.dbManager) {
      window.dbManager.updateBalance(this.balance);
    }
  }

  /**
   * Updates balance counters across all screens
   */
  updateBalanceDisplay() {
    const formatted = `$${this.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const displays = document.querySelectorAll('.balance-display-label');
    displays.forEach(el => {
      el.innerText = formatted;
    });
  }

  /**
   * Global Toast Notification Manager
   */
  showToast(message, type = 'info') {
    const toastContainer = document.getElementById('toast-container');
    if (!toastContainer) return;
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let icon = '<i class="fas fa-info-circle"></i>';
    if (type === 'success') icon = '<i class="fas fa-check-circle"></i>';
    if (type === 'error') icon = '<i class="fas fa-exclamation-circle"></i>';
    
    toast.innerHTML = `${icon} <span>${message}</span>`;
    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('active');
    }, 10);

    setTimeout(() => {
      toast.classList.remove('active');
      setTimeout(() => toast.remove(), 400);
    }, 3000);
  }
}

// Instantiate Lobby coordinator once content resolves
window.addEventListener('DOMContentLoaded', () => {
  window.lobbyManager = new CasinoLobby();
  window.lobbyManager.init();
});
