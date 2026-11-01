/* ============================================================
   TriVote — Admin Dashboard Logic
   Stats, auth log, election results, voter status
   ============================================================ */

(function () {
  'use strict';

  var adminData = {
    registeredVoters: 0,
    votesCast: 0,
    authSuccessRate: 0,
    authFailures: 0,
    authLog: [],
    voteTally: [],
    voters: []
  };

  function initAdminScreen() {
    bindAdminSocketEvents();

    /* Request admin data */
    window.trivoteSocket.emit('get_admin_data', {});

    /* Back button */
    var backBtn = document.getElementById('admin-back');
    if (backBtn) {
      backBtn.onclick = function () {
        window.showScreen('screen-home');
      };
    }

    /* Register New Voter button */
    var addVoterBtn = document.getElementById('btn-admin-add-voter');
    if (addVoterBtn) {
      addVoterBtn.onclick = function () {
        window.showScreen('screen-register');
      };
    }
  }

  function bindAdminSocketEvents() {
    window.trivoteSocket.on('admin_data', function (data) {
      adminData = Object.assign(adminData, data);
      renderAdminDashboard();
    });

    window.trivoteSocket.on('admin_update', function (data) {
      adminData = Object.assign(adminData, data);
      renderAdminDashboard();
    });

    window.trivoteSocket.on('voter_deleted', function (data) {
      if (data.success) {
        window.showNotification('Voter ' + data.voter_id + ' deleted.', 'success');
        /* Refresh admin data */
        window.trivoteSocket.emit('get_admin_data', {});
      } else {
        window.showNotification(data.message || 'Failed to delete voter.', 'error');
      }
    });
  }

  function renderAdminDashboard() {
    renderStatCards();
    renderAuthLog();
    renderVoteTally();
    renderVoterStatus();
  }

  function renderStatCards() {
    setStatValue('stat-registered', adminData.registeredVoters);
    setStatValue('stat-votes', adminData.votesCast);
    setStatValue('stat-success-rate', adminData.authSuccessRate + '%');
    setStatValue('stat-failures', adminData.authFailures);
  }

  function setStatValue(id, value) {
    var el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function renderAuthLog() {
    var tbody = document.getElementById('auth-log-body');
    if (!tbody) return;

    tbody.innerHTML = '';

    var log = adminData.authLog || [];
    if (log.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center text-secondary" style="padding:24px;">No authentication records.</td></tr>';
      return;
    }

    log.forEach(function (entry) {
      var tr = document.createElement('tr');

      var decisionClass = entry.decision === 'AUTHENTICATED' ? 'text-green' : 'text-red';

      tr.innerHTML =
        '<td>' + escapeHtml(entry.time || '--') + '</td>' +
        '<td class="mono">' + escapeHtml(entry.voter_id || '--') + '</td>' +
        '<td class="mono">' + formatScore(entry.face_score) + '</td>' +
        '<td class="mono">' + formatScore(entry.fingerprint_score) + '</td>' +
        '<td class="mono">' + formatScore(entry.iris_score) + '</td>' +
        '<td class="mono">' + formatScore(entry.fusion_score) + '</td>' +
        '<td class="' + decisionClass + ' font-semibold">' + escapeHtml(entry.decision || '--') + '</td>';

      tbody.appendChild(tr);
    });
  }

  function renderVoteTally() {
    var container = document.getElementById('vote-tally-chart');
    if (!container) return;

    container.innerHTML = '';

    var tally = adminData.voteTally || [];
    if (tally.length === 0) {
      container.innerHTML = '<p class="text-secondary">No votes recorded.</p>';
      return;
    }

    /* Find max for percentage */
    var maxVotes = 0;
    tally.forEach(function (item) {
      if (item.count > maxVotes) maxVotes = item.count;
    });

    var chart = document.createElement('div');
    chart.className = 'bar-chart';

    tally.forEach(function (item) {
      var row = document.createElement('div');
      row.className = 'bar-chart__row';

      var label = document.createElement('div');
      label.className = 'bar-chart__label';
      label.textContent = item.name || 'Unknown';

      var track = document.createElement('div');
      track.className = 'bar-chart__track';

      var fill = document.createElement('div');
      fill.className = 'bar-chart__fill';
      var pct = maxVotes > 0 ? (item.count / maxVotes) * 100 : 0;
      /* Animate fill */
      setTimeout(function () {
        fill.style.width = pct + '%';
      }, 100);

      track.appendChild(fill);

      var count = document.createElement('div');
      count.className = 'bar-chart__count';
      count.textContent = item.count;

      row.appendChild(label);
      row.appendChild(track);
      row.appendChild(count);
      chart.appendChild(row);
    });

    container.appendChild(chart);
  }

  function renderVoterStatus() {
    var tbody = document.getElementById('voter-status-body');
    if (!tbody) return;

    tbody.innerHTML = '';

    var voters = adminData.voters || [];
    if (voters.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center text-secondary" style="padding:24px;">No voters registered.</td></tr>';
      return;
    }

    voters.forEach(function (voter) {
      var tr = document.createElement('tr');
      var statusBadge = voter.status === 'Voted'
        ? '<span class="badge badge-green">Voted</span>'
        : '<span class="badge badge-amber">Pending</span>';

      tr.innerHTML =
        '<td class="mono">' + escapeHtml(voter.voter_id || '--') + '</td>' +
        '<td>' + escapeHtml(voter.name || '--') + '</td>' +
        '<td>' + statusBadge + '</td>' +
        '<td>' + escapeHtml(voter.time || '--') + '</td>' +
        '<td></td>';

      /* Action buttons in the last cell */
      var actionCell = tr.querySelector('td:last-child');
      actionCell.style.display = 'flex';
      actionCell.style.gap = '6px';
      actionCell.style.alignItems = 'center';

      /* If voter hasn't voted yet, allow updating / resuming registration */
      if (voter.status !== 'Voted') {
        var updateBtn = document.createElement('button');
        updateBtn.className = 'btn btn-outline btn-sm';
        updateBtn.textContent = 'UPDATE';
        updateBtn.setAttribute('data-voter-id', voter.voter_id);
        updateBtn.onclick = function () {
          var vid = this.getAttribute('data-voter-id');
          if (window.resumeRegistration) {
            window.resumeRegistration(vid);
          }
        };
        actionCell.appendChild(updateBtn);
      }

      var deleteBtn = document.createElement('button');
      deleteBtn.className = 'btn btn-danger btn-sm';
      deleteBtn.textContent = 'DELETE';
      deleteBtn.setAttribute('data-voter-id', voter.voter_id);
      deleteBtn.onclick = function () {
        var vid = this.getAttribute('data-voter-id');
        if (confirm('Remove voter ' + vid + ' and all associated records? This cannot be undone.')) {
          this.disabled = true;
          this.textContent = 'DELETING...';
          window.trivoteSocket.emit('delete_voter', { voter_id: vid });
        }
      };
      actionCell.appendChild(deleteBtn);

      tbody.appendChild(tr);
    });
  }

  function formatScore(score) {
    if (score === null || score === undefined) return '--';
    return Number(score).toFixed(1);
  }

  function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  window.initAdminScreen = initAdminScreen;
  window.destroyAdminScreen = function () {};
})();
