/* ============================================================
   TriVote — WebSocket Client
   Socket.IO wrapper for all real-time communication
   ============================================================ */

/**
 * TriVoteSocket — manages the Socket.IO connection and provides
 * a clean API for emitting and receiving biometric voting events.
 */
class TriVoteSocket {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.handlers = {};
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this._registeredSocketEvents = new Set();
  }

  /**
   * Connect to the Flask-SocketIO server.
   * @param {string} [url] - Server URL. Defaults to current origin.
   */
  connect(url) {
    if (this.socket && this.connected) {
      return;
    }

    const opts = {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000
    };

    this.socket = url ? io(url, opts) : io(opts);
    this._registeredSocketEvents.clear();

    /* System Lifecycle Events */
    ['connect', 'disconnect', 'connect_error'].forEach(evt => {
      this._registeredSocketEvents.add(evt);
    });

    this.socket.on('connect', () => {
      this.connected = true;
      this.reconnectAttempts = 0;
      this._updateHeaderStatus('system', true);
      this._dispatch('connect', {});
    });

    this.socket.on('disconnect', (reason) => {
      this.connected = false;
      this._updateHeaderStatus('system', false);
      this._dispatch('disconnect', { reason: reason });
    });

    this.socket.on('connect_error', (error) => {
      this.reconnectAttempts++;
      this._dispatch('connect_error', { error: error.message, attempt: this.reconnectAttempts });
    });

    /* Core Application Events - Register each only once */
    const coreEvents = [
      'voter_lookup_result',
      'registration_response',
      'face_capture_response',
      'fingerprint_status',
      'iris_status',
      'voter_verified',
      'face_match_result',
      'fingerprint_match_result',
      'iris_match_result',
      'auth_decision',
      'candidates_list',
      'vote_response',
      'admin_data',
      'admin_update',
      'error',
      'notification'
    ];

    coreEvents.forEach(evt => {
      this._registeredSocketEvents.add(evt);
      this.socket.on(evt, (data) => {
        this._dispatch(evt, data);
      });
    });
  }

  /**
   * Register an event handler (preventing duplicates).
   * @param {string} event - Event name.
   * @param {Function} callback - Handler function.
   */
  on(event, callback) {
    if (!this.handlers[event]) {
      this.handlers[event] = [];
    }
    if (!this.handlers[event].includes(callback)) {
      this.handlers[event].push(callback);
    }
    /* Dynamically bind to underlying socket if not already registered */
    if (this.socket && !this._registeredSocketEvents) {
      this._registeredSocketEvents = new Set();
    }
    if (this.socket && !this._registeredSocketEvents.has(event)) {
      this._registeredSocketEvents.add(event);
      this.socket.on(event, (data) => {
        this._dispatch(event, data);
      });
    }
  }

  /**
   * Clear all handlers for an event.
   * @param {string} event - Event name.
   */
  offAll(event) {
    if (this.handlers[event]) {
      this.handlers[event] = [];
    }
  }

  /**
   * Remove an event handler.
   * @param {string} event - Event name.
   * @param {Function} callback - Handler to remove.
   */
  off(event, callback) {
    if (this.handlers[event]) {
      this.handlers[event] = this.handlers[event].filter(h => h !== callback);
    }
  }

  /**
   * Emit an event to the server.
   * @param {string} event - Event name.
   * @param {*} data - Payload.
   */
  emit(event, data) {
    if (this.socket && this.connected) {
      this.socket.emit(event, data);
    } else {
      console.warn('[TriVoteSocket] Cannot emit: not connected.');
    }
  }

  /**
   * Disconnect from the server.
   */
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.connected = false;
    }
  }

  /**
   * Internal: dispatch event to registered handlers.
   * @param {string} event
   * @param {*} data
   */
  _dispatch(event, data) {
    const handlers = this.handlers[event];
    if (handlers) {
      handlers.forEach(fn => {
        try {
          fn(data);
        } catch (e) {
          console.error('[TriVoteSocket] Handler error for "' + event + '":', e);
        }
      });
    }
  }

  /**
   * Update header status indicators.
   * @param {string} type - 'system' or 'sensor'
   * @param {boolean} online
   */
  _updateHeaderStatus(type, online) {
    const dotEl = document.getElementById('status-dot-' + type);
    const textEl = document.getElementById('status-text-' + type);
    if (dotEl) {
      dotEl.className = 'status-dot ' + (online ? 'status-dot--green' : 'status-dot--red');
    }
    if (textEl) {
      textEl.textContent = online ? 'Online' : 'Offline';
    }
  }
}

/* Export as global singleton */
window.trivoteSocket = new TriVoteSocket();
