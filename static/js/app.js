/* ============================================================
   TriVote — Main SPA Controller
   Screen management, state, initialization
   ============================================================ */

(function () {
  'use strict';

  /* ---- Global Application State ---- */
  window.appState = {
    currentScreen: 'screen-home',
    authenticatedVoterId: null,
    systemOnline: false
  };

  /* ---- Screen Management ---- */
  var screenInitializers = {
    'screen-home': 'initHomeScreen',
    'screen-register': 'initRegisterScreen',
    'screen-authenticate': 'initAuthenticateScreen',
    'screen-vote': 'initVoteScreen',
    'screen-admin': 'initAdminScreen'
  };

  var screenDestructors = {
    'screen-home': 'destroyHomeScreen',
    'screen-register': 'destroyRegisterScreen',
    'screen-authenticate': 'destroyAuthenticateScreen',
    'screen-vote': 'destroyVoteScreen',
    'screen-admin': 'destroyAdminScreen'
  };

  /**
   * Show a screen by its element ID. Handles exit animations on
   * the current screen and enter animations on the new one.
   * @param {string} screenId - Target screen element ID.
   */
  function showScreen(screenId) {
    var allScreens = document.querySelectorAll('.screen');
    var currentId = window.appState.currentScreen;

    /* Destroy outgoing screen */
    if (currentId && screenDestructors[currentId] && window[screenDestructors[currentId]]) {
      try {
        window[screenDestructors[currentId]]();
      } catch (e) {
        console.error('[App] Error destroying screen:', e);
      }
    }

    /* Hide all screens */
    allScreens.forEach(function (screen) {
      screen.classList.remove('active', 'page-enter', 'page-exit');
    });

    /* Show target */
    var target = document.getElementById(screenId);
    if (target) {
      target.classList.add('active', 'page-enter');
      window.appState.currentScreen = screenId;

      /* Update home-screen-active and admin-screen-active classes on body */
      if (screenId === 'screen-home') {
        document.body.classList.add('home-screen-active');
      } else {
        document.body.classList.remove('home-screen-active');
      }

      if (screenId === 'screen-admin') {
        document.body.classList.add('admin-screen-active');
      } else {
        document.body.classList.remove('admin-screen-active');
      }

      /* Remove animation class after it plays */
      target.addEventListener('animationend', function handler() {
        target.classList.remove('page-enter');
        target.removeEventListener('animationend', handler);
      });
    }

    /* Initialize incoming screen */
    if (screenInitializers[screenId] && window[screenInitializers[screenId]]) {
      try {
        window[screenInitializers[screenId]]();
      } catch (e) {
        console.error('[App] Error initializing screen:', e);
      }
    }
  }

  /* ---- Helpers ---- */

  /**
   * Format a Date object to a display string.
   * @param {Date} date
   * @returns {string}
   */
  function formatTimestamp(date) {
    if (!date) date = new Date();
    var y = date.getFullYear();
    var m = String(date.getMonth() + 1).padStart(2, '0');
    var d = String(date.getDate()).padStart(2, '0');
    var h = String(date.getHours()).padStart(2, '0');
    var min = String(date.getMinutes()).padStart(2, '0');
    var s = String(date.getSeconds()).padStart(2, '0');
    return y + '-' + m + '-' + d + ' ' + h + ':' + min + ':' + s;
  }

  /**
   * Generate a random hex hash string for receipts.
   * @returns {string}
   */
  function generateReceiptHash() {
    var chars = 'abcdef0123456789';
    var hash = '';
    for (var i = 0; i < 64; i++) {
      hash += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return hash.substring(0, 8) + '...' + hash.substring(hash.length - 4);
  }

  /**
   * Update the footer timestamp.
   */
  function updateStatusBar() {
    var tsEl = document.getElementById('footer-timestamp');
    if (tsEl) {
      tsEl.textContent = formatTimestamp(new Date());
    }
  }

  /* ---- Initialization ---- */

  document.addEventListener('DOMContentLoaded', function () {
    /* Connect WebSocket */
    window.trivoteSocket.connect();

    /* Set up socket status handlers */
    window.trivoteSocket.on('connect', function () {
      window.appState.systemOnline = true;
      window.showNotification('Connected to server.', 'success', 2000);
    });

    window.trivoteSocket.on('disconnect', function () {
      window.appState.systemOnline = false;
      window.showNotification('Disconnected from server.', 'error');
    });

    window.trivoteSocket.on('connect_error', function (data) {
      window.showNotification('Connection error (attempt ' + data.attempt + ').', 'warning');
    });

    window.trivoteSocket.on('error', function (data) {
      window.showNotification(data.message || 'Server error.', 'error');
    });

    window.trivoteSocket.on('notification', function (data) {
      window.showNotification(data.message || '', data.type || 'info');
    });

    /* Start footer clock */
    updateStatusBar();
    setInterval(updateStatusBar, 1000);

    /* Show home screen */
    showScreen('screen-home');

    /* Check for query parameters in URL */
    try {
      var params = new URLSearchParams(window.location.search);
      var resumeId = params.get('resume');
      var screenParam = params.get('screen');

      if (screenParam) {
        var screenElemId = 'screen-' + screenParam.replace('screen-', '');
        if (document.getElementById(screenElemId)) {
          showScreen(screenElemId);
        }
      }

      if (resumeId) {
        setTimeout(function () {
          if (window.resumeRegistration) {
            window.resumeRegistration(resumeId);
          }
        }, 300);
      }
    } catch (e) {
      console.warn('[App] Error parsing query params:', e);
    }
  });

  /* ---- Expose Globals ---- */
  window.showScreen = showScreen;
  window.formatTimestamp = formatTimestamp;
  window.generateReceiptHash = generateReceiptHash;
  window.updateStatusBar = updateStatusBar;
})();
