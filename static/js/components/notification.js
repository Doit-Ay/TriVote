/* ============================================================
   TriVote — Notification Toast System
   Slide-in toast notifications with auto-dismiss and stacking
   ============================================================ */

/**
 * SVG icons for notification types.
 */
const NOTIFICATION_ICONS = {
  info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>',
  success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>',
  warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>',
  error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>'
};

/**
 * Ensure the notification container exists in the DOM.
 * @returns {HTMLElement}
 */
function getNotificationContainer() {
  let container = document.getElementById('notification-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'notification-container';
    container.className = 'notification-container';
    document.body.appendChild(container);
  }
  return container;
}

let _lastNotification = { message: '', type: '', timestamp: 0 };

/**
 * Show a toast notification with duplicate suppression.
 * @param {string} message - The notification text.
 * @param {'info'|'success'|'warning'|'error'} [type='info'] - Notification type.
 * @param {number} [duration=3000] - Auto-dismiss duration in ms.
 */
function showNotification(message, type, duration) {
  type = type || 'info';
  duration = duration !== undefined ? duration : 3000;

  /* Suppress identical notifications triggered within 600ms (duplicate event protection) */
  const now = Date.now();
  if (
    _lastNotification.message === message &&
    _lastNotification.type === type &&
    (now - _lastNotification.timestamp) < 600
  ) {
    return;
  }
  _lastNotification = { message: message, type: type, timestamp: now };

  const container = getNotificationContainer();

  /* Build toast element */
  const toast = document.createElement('div');
  toast.className = 'notification-toast notification-toast--' + type;

  /* Icon */
  const iconEl = document.createElement('div');
  iconEl.className = 'notification-toast__icon';
  iconEl.innerHTML = NOTIFICATION_ICONS[type] || NOTIFICATION_ICONS.info;
  toast.appendChild(iconEl);

  /* Message */
  const msgEl = document.createElement('div');
  msgEl.className = 'notification-toast__message';
  msgEl.textContent = message;
  toast.appendChild(msgEl);

  container.appendChild(toast);

  /* Slide in (next frame) */
  requestAnimationFrame(() => {
    toast.classList.add('visible');
  });

  /* Auto-dismiss */
  const dismiss = function () {
    toast.classList.remove('visible');
    setTimeout(function () {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 350);
  };

  if (duration > 0) {
    setTimeout(dismiss, duration);
  }

  /* Allow manual dismiss via click */
  toast.addEventListener('click', dismiss);

  return { dismiss: dismiss };
}

/* Expose globally */
window.showNotification = showNotification;
