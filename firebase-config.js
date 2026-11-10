const firebaseConfig = {
  apiKey: "AIzaSyDk6oifinfo6_Vvy7NXaW5xfZlSKCRnKq4",
  authDomain: "kuwait-zoo.firebaseapp.com",
  projectId: "kuwait-zoo",
  storageBucket: "kuwait-zoo.firebasestorage.app",
  messagingSenderId: "296982948036",
  appId: "1:296982948036:web:e60b438155ed30295f8191",
  measurementId: "G-JVKZM8038T"
};

// Admin species add/delete support. This module safely no-ops on pages without the report table.
import './admin-species.js';
// Correct mobile spacing so the fixed header does not cover the control-panel toggle.
import './mobile-layout-fix.js';

export { firebaseConfig };
