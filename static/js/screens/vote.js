/* ============================================================
   TriVote — Voting Screen Logic
   Candidate selection, vote casting, and receipt display
   ============================================================ */

(function () {
  'use strict';

  var selectedCandidate = null;
  var candidates = [];

  function initVoteScreen() {
    selectedCandidate = null;
    candidates = [];

    updateCastButton();
    bindVoteEvents();
    bindVoteSocketEvents();

    /* Request candidates from server */
    window.trivoteSocket.emit('get_candidates', {});
  }

  function bindVoteEvents() {
    var castBtn = document.getElementById('btn-cast-vote');
    var confirmBtn = document.getElementById('btn-confirm-vote');
    var reviewBtn = document.getElementById('btn-review-choices');
    var homeBtn = document.getElementById('btn-vote-home');

    if (castBtn) {
      castBtn.onclick = function () {
        if (!selectedCandidate) {
          window.showNotification('Please select a candidate.', 'warning');
          return;
        }
        showConfirmationModal();
      };
    }

    if (reviewBtn) {
      reviewBtn.onclick = function () {
        hideConfirmationModal();
      };
    }

    if (confirmBtn) {
      confirmBtn.onclick = function () {
        hideConfirmationModal();
        submitVote();
      };
    }

    if (homeBtn) {
      homeBtn.onclick = function () {
        window.appState.authenticatedVoterId = null;
        window.showScreen('screen-home');
      };
    }
  }

  function bindVoteSocketEvents() {
    window.trivoteSocket.on('candidates_list', function (data) {
      candidates = data.candidates || [];
      renderCandidates();
    });

    window.trivoteSocket.on('vote_response', function (data) {
      if (data.success) {
        showReceipt(data);
        window.showNotification('Your vote has been recorded.', 'success');
      } else {
        window.showNotification(data.message || 'Vote submission failed.', 'error');
      }
    });
  }

  function renderCandidates() {
    var container = document.getElementById('candidates-list');
    if (!container) return;

    container.innerHTML = '';

    if (candidates.length === 0) {
      container.innerHTML = '<p class="text-secondary text-center">Loading candidates...</p>';
      return;
    }

    candidates.forEach(function (candidate, index) {
      var card = document.createElement('div');
      card.className = 'candidate-card';
      card.setAttribute('tabindex', '0');
      card.setAttribute('role', 'radio');
      card.setAttribute('aria-checked', 'false');
      card.setAttribute('data-candidate-id', candidate.id || index);

      card.innerHTML =
        '<div class="candidate-card__radio">' +
          '<div class="candidate-card__radio-dot"></div>' +
        '</div>' +
        '<div class="candidate-card__info">' +
          '<div class="candidate-card__name">' + escapeHtml(candidate.name) + '</div>' +
          '<div class="candidate-card__party">' + escapeHtml(candidate.party || '') + '</div>' +
        '</div>';

      card.addEventListener('click', function () {
        selectCandidate(card, candidate);
      });

      card.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          selectCandidate(card, candidate);
        }
      });

      container.appendChild(card);
    });
  }

  function selectCandidate(cardEl, candidate) {
    /* Deselect all */
    var allCards = document.querySelectorAll('.candidate-card');
    allCards.forEach(function (c) {
      c.classList.remove('selected');
      c.setAttribute('aria-checked', 'false');
    });

    /* Select this one */
    cardEl.classList.add('selected');
    cardEl.setAttribute('aria-checked', 'true');
    selectedCandidate = candidate;

    updateCastButton();
  }

  function updateCastButton() {
    var castBtn = document.getElementById('btn-cast-vote');
    if (castBtn) {
      castBtn.disabled = !selectedCandidate;
    }
  }

  function showConfirmationModal() {
    var modal = document.getElementById('vote-confirm-modal');
    var summaryEl = document.getElementById('confirm-candidate-name');

    if (summaryEl && selectedCandidate) {
      summaryEl.textContent = selectedCandidate.name + (selectedCandidate.party ? ' (' + selectedCandidate.party + ')' : '');
    }

    if (modal) {
      modal.classList.add('active');
    }
  }

  function hideConfirmationModal() {
    var modal = document.getElementById('vote-confirm-modal');
    if (modal) {
      modal.classList.remove('active');
    }
  }

  function submitVote() {
    if (!selectedCandidate) return;

    var castBtn = document.getElementById('btn-cast-vote');
    if (castBtn) {
      castBtn.disabled = true;
      castBtn.textContent = 'SUBMITTING...';
    }

    window.trivoteSocket.emit('cast_vote', {
      voter_id: window.appState.authenticatedVoterId,
      candidate_id: selectedCandidate.id
    });
  }

  function showReceipt(data) {
    /* Hide ballot, show receipt */
    var ballotSection = document.getElementById('vote-ballot-section');
    var receiptSection = document.getElementById('vote-receipt-section');

    if (ballotSection) ballotSection.style.display = 'none';
    if (receiptSection) {
      receiptSection.style.display = 'block';
      receiptSection.classList.add('page-enter');
    }

    var hashEl = document.getElementById('receipt-hash');
    var timeEl = document.getElementById('receipt-time');
    var idEl = document.getElementById('receipt-voter-id');

    if (hashEl) hashEl.textContent = 'Receipt: ' + (data.receipt_hash || generateReceiptHash());
    if (timeEl) timeEl.textContent = formatTimestamp(new Date());
    if (idEl) idEl.textContent = window.appState.authenticatedVoterId || 'N/A';
  }

  function generateReceiptHash() {
    var chars = 'abcdef0123456789';
    var hash = '';
    for (var i = 0; i < 64; i++) {
      hash += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return hash.substring(0, 8) + '...' + hash.substring(hash.length - 4);
  }

  function formatTimestamp(date) {
    var y = date.getFullYear();
    var m = String(date.getMonth() + 1).padStart(2, '0');
    var d = String(date.getDate()).padStart(2, '0');
    var h = String(date.getHours()).padStart(2, '0');
    var min = String(date.getMinutes()).padStart(2, '0');
    var s = String(date.getSeconds()).padStart(2, '0');
    return y + '-' + m + '-' + d + ' ' + h + ':' + min + ':' + s;
  }

  function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  window.initVoteScreen = initVoteScreen;
  window.destroyVoteScreen = function () {
    selectedCandidate = null;
  };
})();
