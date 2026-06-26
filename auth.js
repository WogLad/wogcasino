// auth.js
class AuthManager {
  constructor() {
    this.user = null;
    this.authModal = document.getElementById('auth-modal');
    this.authBtn = document.getElementById('auth-btn');
    this.closeAuthBtn = document.getElementById('close-auth-btn');
    
    // Form Elements
    this.authForm = document.getElementById('auth-form');
    this.emailInput = document.getElementById('auth-email');
    this.passwordInput = document.getElementById('auth-password');
    this.usernameInput = document.getElementById('auth-username');
    this.groupUsername = document.getElementById('group-username');
    this.submitBtn = document.getElementById('auth-submit-btn');
    this.authHint = document.getElementById('auth-hint');
    
    // Tabs
    this.tabLogin = document.getElementById('tab-login');
    this.tabRegister = document.getElementById('tab-register');
    
    if (window.firebaseInitialized) {
      this.auth = firebase.auth();
      this.initAuthListeners();
    } else {
      this.setupMockListeners();
    }
  }

  setupMockListeners() {
    this.authBtn.addEventListener('click', () => {
      if (window.showToast) {
        window.showToast("Firebase is not configured. Add your config to firebase-config.js to enable Login.", "error");
      } else {
        alert("Firebase is not configured. Add your config to firebase-config.js to enable Login.");
      }
    });
  }

  initAuthListeners() {
    // Open Modal
    this.authBtn.addEventListener('click', () => {
      if (this.user) {
        // Log out
        this.auth.signOut();
      } else {
        this.setMode('login'); // Default to login
        this.authModal.classList.add('active');
      }
    });

    // Close Modal
    this.closeAuthBtn.addEventListener('click', () => {
      this.authModal.classList.remove('active');
    });

    // Tab Switching
    this.tabLogin.addEventListener('click', () => this.setMode('login'));
    this.tabRegister.addEventListener('click', () => this.setMode('register'));

    // Form Submit (Login or Register)
    this.authForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const mode = this.authForm.dataset.mode;
      const email = this.emailInput.value;
      const password = this.passwordInput.value;
      const username = this.usernameInput.value.trim();
      
      this.submitBtn.disabled = true;
      this.submitBtn.textContent = "Processing...";

      try {
        if (mode === 'register') {
          // 1. Check Username Uniqueness
          if (!username) throw new Error("Username is required for registration.");
          
          if (window.dbManager) {
            const isTaken = await window.dbManager.isUsernameTaken(username);
            if (isTaken) {
              throw new Error("That username is already taken. Please choose another.");
            }
          }
          
          // 2. Set global variable so db.js knows which username to assign
          window.pendingRegistrationUsername = username;
          
          // 3. Create Account
          await this.auth.createUserWithEmailAndPassword(email, password);
          if (window.showToast) window.showToast("Account created successfully!", "success");
          
        } else {
          // Login
          await this.auth.signInWithEmailAndPassword(email, password);
          if (window.showToast) window.showToast("Successfully logged in!", "success");
        }
        
        // Success cleanup
        this.authModal.classList.remove('active');
        this.authForm.reset();
        
      } catch (error) {
        if (window.showToast) {
          let msg = error.message;
          if (error.code === 'auth/invalid-credential') msg = "Invalid email or password.";
          if (error.code === 'auth/email-already-in-use') msg = "That email is already registered. Please log in.";
          window.showToast(msg, "error");
        }
      } finally {
        this.submitBtn.disabled = false;
        this.submitBtn.textContent = mode === 'login' ? "Login" : "Register";
      }
    });

    // Firebase Auth State Listener
    this.auth.onAuthStateChanged((user) => {
      this.user = user;
      const btnSpan = this.authBtn.querySelector('span');
      
      if (user) {
        btnSpan.textContent = "Logout (" + user.email.split('@')[0] + ")";
        if (window.showToast) window.showToast(`Welcome back!`, "info");
        // Dispatch custom event to notify db.js and game.js
        window.dispatchEvent(new CustomEvent('auth-state-changed', { detail: { user } }));
      } else {
        btnSpan.textContent = "Login";
        window.dispatchEvent(new CustomEvent('auth-state-changed', { detail: { user: null } }));
      }
    });
  }

  setMode(mode) {
    this.authForm.dataset.mode = mode;
    this.authForm.reset();
    
    if (mode === 'login') {
      this.tabLogin.classList.add('active');
      this.tabRegister.classList.remove('active');
      this.groupUsername.style.display = 'none';
      this.usernameInput.removeAttribute('required');
      this.submitBtn.textContent = 'Login';
      this.authHint.textContent = 'Welcome back to Casino Elite.';
    } else {
      this.tabRegister.classList.add('active');
      this.tabLogin.classList.remove('active');
      this.groupUsername.style.display = 'flex';
      this.usernameInput.setAttribute('required', 'true');
      this.submitBtn.textContent = 'Register';
      this.authHint.textContent = 'Create a free account to join the leaderboard.';
    }
  }
}

// Initialize AuthManager once DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.authManager = new AuthManager();
});
