// db.js
class DatabaseManager {
  constructor() {
    this.leaderboardList = document.getElementById('leaderboard-list');
    
    if (window.firebaseInitialized) {
      this.db = firebase.firestore();
      this.listenToAuth();
      this.fetchLeaderboard();
    }
  }

  listenToAuth() {
    window.addEventListener('auth-state-changed', async (e) => {
      const user = e.detail.user;
      if (user) {
        // User logged in, fetch their balance or initialize it
        await this.syncUserBalance(user);
      }
    });
  }

  async isUsernameTaken(username) {
    if (!window.firebaseInitialized) return false;
    try {
      const snapshot = await this.db.collection('users')
        .where('username', '==', username)
        .limit(1)
        .get();
      return !snapshot.empty;
    } catch (e) {
      console.error("Error checking username:", e);
      return true; // fail safe
    }
  }

  async syncUserBalance(user, desiredUsername = null) {
    try {
      const docRef = this.db.collection('users').doc(user.uid);
      const doc = await docRef.get();
      
      if (doc.exists) {
        const data = doc.data();
        if (data.balance !== undefined) {
          // Update local game lobby balance
          if (window.lobby) {
            window.lobby.setBalance(data.balance);
          }
        }
      } else {
        // Initialize new user with default balance (e.g. 1000)
        let startingBalance = window.lobby ? window.lobby.balance : 1000;
        let desiredUsername = window.pendingRegistrationUsername || null;
        let usernameToSet = desiredUsername || user.email.split('@')[0];
        
        await docRef.set({
          email: user.email,
          username: usernameToSet,
          balance: startingBalance,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        window.pendingRegistrationUsername = null; // clear it
      }
    } catch (e) {
      console.error("Error syncing user balance:", e);
    }
  }

  async updateBalance(amount) {
    if (!window.firebaseInitialized || !window.authManager || !window.authManager.user) {
      return; // Fallback to local storage only if not logged in
    }

    try {
      const user = window.authManager.user;
      const docRef = this.db.collection('users').doc(user.uid);
      await docRef.update({
        balance: amount,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      // Also refresh leaderboard periodically or instantly
      this.fetchLeaderboard();
    } catch (e) {
      console.error("Error updating balance in cloud:", e);
    }
  }

  async fetchLeaderboard() {
    if (!window.firebaseInitialized) return;
    
    try {
      const snapshot = await this.db.collection('users')
        .orderBy('balance', 'desc')
        .limit(10)
        .get();

      if (snapshot.empty) {
        this.leaderboardList.innerHTML = `<li class="leaderboard-empty">No players yet. Be the first!</li>`;
        return;
      }

      this.leaderboardList.innerHTML = '';
      snapshot.forEach(doc => {
        const data = doc.data();
        const li = document.createElement('li');
        
        const nameSpan = document.createElement('span');
        nameSpan.textContent = data.username || "Unknown";
        
        const balanceSpan = document.createElement('span');
        balanceSpan.textContent = "$" + parseFloat(data.balance).toFixed(2);
        
        li.appendChild(nameSpan);
        li.appendChild(balanceSpan);
        this.leaderboardList.appendChild(li);
      });
    } catch (e) {
      console.error("Error fetching leaderboard:", e);
      this.leaderboardList.innerHTML = `<li class="leaderboard-empty" style="color:var(--red-color)">Failed to load leaderboard.</li>`;
    }
  }
}

// Initialize DatabaseManager
document.addEventListener('DOMContentLoaded', () => {
  window.dbManager = new DatabaseManager();
});
