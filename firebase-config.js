// firebase-config.js
// Place your Firebase configuration here.
// You can get this from the Firebase Console when you add a Web App.

const firebaseConfig = {
  apiKey: "AIzaSyBVQ8tAYh_dvN6ai3MNVXmIUHXZ2RxZVw8",
  authDomain: "wogcasino.firebaseapp.com",
  projectId: "wogcasino",
  storageBucket: "wogcasino.firebasestorage.app",
  messagingSenderId: "414560692252",
  appId: "1:414560692252:web:f94fcb6df6a2f1f26bd7d9",
  measurementId: "G-1KCB3P55P6"
};

// Only initialize if the user has provided a real config
window.firebaseInitialized = false;

if (firebaseConfig.apiKey !== "YOUR_API_KEY" && typeof firebase !== 'undefined') {
  firebase.initializeApp(firebaseConfig);
  window.firebaseInitialized = true;
  console.log("Firebase initialized.");
} else {
  console.warn("Firebase config is missing. Authentication and Leaderboards will be disabled until you provide your config in firebase-config.js.");
}
