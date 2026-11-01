/* ============================================================
   TriVote — Modern Institutional Home Screen & Navigation Controller
   Matches the high-tech National Election Center UI
   ============================================================ */

(function () {
  'use strict';

  var navModalsBound = false;

  var infoContents = {
    about: {
      title: 'TRIVOTE PLATFORM SPECIFICATION',
      subtitle: 'Multi-Modal Biometric Voter Authentication & Verification Architecture',
      body: '<div class="nav-panel-fade">' +
            '<p class="mb-4 text-sm" style="color:#e2e8f0;line-height:1.65;"><strong>TriVote</strong> is an institutional-grade sovereign biometric authentication terminal engineered for national election authorities to guarantee democratic uncompromised integrity, fairness, and transparency at every polling precinct across the nation.</p>' +
            '<div class="grid-3 gap-3 mb-4">' +
            '<div class="nav-modal-card" style="border-color:rgba(59,130,246,0.3);">' +
            '<div style="color:#3b82f6;font-weight:700;font-size:12px;margin-bottom:4px;display:flex;align-items:center;gap:6px;">' +
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 14 14"></polyline></svg>' +
            '3-Way Biometric Fusion' +
            '</div>' +
            '<p class="text-xs mb-0 text-secondary">Simultaneously verifies Face geometry, Fingerprint minutiae, and Iris patterns into an ensemble score.</p>' +
            '</div>' +
            '<div class="nav-modal-card" style="border-color:rgba(16,185,129,0.3);">' +
            '<div style="color:#10b981;font-weight:700;font-size:12px;margin-bottom:4px;display:flex;align-items:center;gap:6px;">' +
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>' +
            'Zero Impostor Tolerance' +
            '</div>' +
            '<p class="text-xs mb-0 text-secondary">Mathematical threshold (&ge; 65%) with individual modality guard (&ge; 50%) stops spoofing dead in its tracks.</p>' +
            '</div>' +
            '<div class="nav-modal-card" style="border-color:rgba(245,158,11,0.3);">' +
            '<div style="color:#f59e0b;font-weight:700;font-size:12px;margin-bottom:4px;display:flex;align-items:center;gap:6px;">' +
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>' +
            'Offline Sovereign Vault' +
            '</div>' +
            '<p class="text-xs mb-0 text-secondary">Completely autonomous polling operation. All voter biometric templates remain strictly encrypted locally.</p>' +
            '</div>' +
            '</div>' +
            '<div class="p-3" style="background:rgba(15,23,42,0.6);border:1px solid rgba(255,255,255,0.08);border-radius:10px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;">' +
            '<span class="text-xs text-secondary">SYSTEM STANDARDS: ISO/IEC 19794-2 • NIST FIPS 201 • LOCAL SHA-256 LEDGER</span>' +
            '<span class="badge badge-blue text-xs font-semibold">TERMINAL V2.4</span>' +
            '</div>' +
            '</div>'
    },
    process: {
      title: 'BIOMETRIC VOTING PROCESS',
      subtitle: 'Standard 4-Stage Citizen Verification Lifecycle',
      body: '<div class="nav-panel-fade">' +
            '<p class="mb-3 text-xs text-secondary uppercase font-semibold" style="letter-spacing:1px;">Standard 4-Stage Citizen Verification Lifecycle</p>' +
            '<div class="flex-col gap-3">' +
            '<div class="nav-modal-card flex gap-3 items-center">' +
            '<div class="nav-modal-step-badge" style="background:rgba(59,130,246,0.2);color:#3b82f6;border:1px solid rgba(59,130,246,0.4);">1</div>' +
            '<div class="flex-1">' +
            '<div class="flex-between"><strong class="text-white text-sm">Facial Geometry Verification</strong><span class="badge badge-blue text-xs">Weight: 45%</span></div>' +
            '<p class="text-xs text-secondary mt-1 mb-0">High-speed OpenCV Haar Cascade + LBPH histogram analysis validates facial nodal points and rejects impostor frames.</p>' +
            '</div>' +
            '</div>' +
            '<div class="nav-modal-card flex gap-3 items-center">' +
            '<div class="nav-modal-step-badge" style="background:rgba(6,182,212,0.2);color:#06b6d4;border:1px solid rgba(6,182,212,0.4);">2</div>' +
            '<div class="flex-1">' +
            '<div class="flex-between"><strong class="text-white text-sm">Fingerprint Minutiae Matching</strong><span class="badge badge-cyan text-xs">Weight: 30%</span></div>' +
            '<p class="text-xs text-secondary mt-1 mb-0">Hardware biometric sensor (Windows Biometric Framework) or Minutiae Engine matches ridge endings and bifurcations.</p>' +
            '</div>' +
            '</div>' +
            '<div class="nav-modal-card flex gap-3 items-center">' +
            '<div class="nav-modal-step-badge" style="background:rgba(168,85,247,0.2);color:#a855f7;border:1px solid rgba(168,85,247,0.4);">3</div>' +
            '<div class="flex-1">' +
            '<div class="flex-between"><strong class="text-white text-sm">Iris Pattern Coding</strong><span class="badge text-xs" style="background:rgba(168,85,247,0.2);color:#c084fc;">Weight: 25%</span></div>' +
            '<p class="text-xs text-secondary mt-1 mb-0">Polar-coordinate Daugman algorithm computes 64x64 phase-quantized iris codes and checks Hamming distance.</p>' +
            '</div>' +
            '</div>' +
            '<div class="nav-modal-card flex gap-3 items-center">' +
            '<div class="nav-modal-step-badge" style="background:rgba(16,185,129,0.2);color:#10b981;border:1px solid rgba(16,185,129,0.4);">4</div>' +
            '<div class="flex-1">' +
            '<div class="flex-between"><strong class="text-white text-sm">Score Fusion & Ballot Unlock</strong><span class="badge badge-green text-xs">&ge; 65% Required</span></div>' +
            '<p class="text-xs text-secondary mt-1 mb-0">Unified decision engine authenticates the citizen, locks record against duplicate voting, and unlocks the electronic ballot.</p>' +
            '</div>' +
            '</div>' +
            '</div>' +
            '</div>'
    },
    benefits: {
      title: 'CORE SYSTEM INTEGRITY BENEFITS',
      subtitle: 'Constitutional Democratic Safeguards & High-Assurance Architecture',
      body: '<div class="nav-panel-fade">' +
            '<div class="grid-2 gap-3">' +
            '<div class="nav-modal-card">' +
            '<div class="flex items-center gap-2 mb-2">' +
            '<div style="width:28px;height:28px;border-radius:6px;background:rgba(59,130,246,0.2);color:#3b82f6;display:flex;align-items:center;justify-content:center;">' +
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>' +
            '</div>' +
            '<strong class="text-white text-sm">Impostor Elimination</strong>' +
            '</div>' +
            '<p class="text-xs text-secondary mb-0">Multi-modal biometric fusion renders impersonation statistically impossible. An attacker cannot spoof face, fingerprint, and iris simultaneously.</p>' +
            '</div>' +
            '<div class="nav-modal-card">' +
            '<div class="flex items-center gap-2 mb-2">' +
            '<div style="width:28px;height:28px;border-radius:6px;background:rgba(16,185,129,0.2);color:#10b981;display:flex;align-items:center;justify-content:center;">' +
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>' +
            '</div>' +
            '<strong class="text-white text-sm">Zero Duplicate Balloting</strong>' +
            '</div>' +
            '<p class="text-xs text-secondary mb-0">Instant cryptographic voter ledger locks records once a ballot is cast, strictly adhering to the sovereign One Citizen, One Vote doctrine.</p>' +
            '</div>' +
            '<div class="nav-modal-card">' +
            '<div class="flex items-center gap-2 mb-2">' +
            '<div style="width:28px;height:28px;border-radius:6px;background:rgba(245,158,11,0.2);color:#f59e0b;display:flex;align-items:center;justify-content:center;">' +
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line></svg>' +
            '</div>' +
            '<strong class="text-white text-sm">100% Offline Autonomy</strong>' +
            '</div>' +
            '<p class="text-xs text-secondary mb-0">Functions autonomously at remote and air-gapped polling booths without reliance on external servers or vulnerable internet channels.</p>' +
            '</div>' +
            '<div class="nav-modal-card">' +
            '<div class="flex items-center gap-2 mb-2">' +
            '<div style="width:28px;height:28px;border-radius:6px;background:rgba(6,182,212,0.2);color:#06b6d4;display:flex;align-items:center;justify-content:center;">' +
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>' +
            '</div>' +
            '<strong class="text-white text-sm">Auditable Receipt Ledger</strong>' +
            '</div>' +
            '<p class="text-xs text-secondary mb-0">Generates unique SHA-256 cryptographic receipt hashes for every ballot cast, guaranteeing complete post-election transparency.</p>' +
            '</div>' +
            '</div>' +
            '</div>'
    },
    contact: {
      title: 'PRECINCT TERMINAL SUPPORT',
      subtitle: 'National Election Commission Operations Desk',
      body: '<div class="nav-panel-fade">' +
            '<div class="flex-col gap-3">' +
            '<div class="nav-modal-card flex-between items-center">' +
            '<div>' +
            '<div class="text-xs text-secondary font-semibold uppercase">Terminal Serial Identifier</div>' +
            '<div class="mono text-sm text-white font-bold mt-1">TRIVOTE-SECURE-TERM-01</div>' +
            '</div>' +
            '<span class="badge badge-blue text-xs">AUTHORIZED SECURE UNIT</span>' +
            '</div>' +
            '<div class="nav-modal-card flex-between items-center">' +
            '<div>' +
            '<div class="text-xs text-secondary font-semibold uppercase">Precinct Hall & Location</div>' +
            '<div class="text-sm text-white font-medium mt-1">Constituency Central Hall, Polling Precinct #4</div>' +
            '</div>' +
            '<span class="badge badge-cyan text-xs">STATION ACTIVE</span>' +
            '</div>' +
            '<div class="nav-modal-card flex-between items-center">' +
            '<div>' +
            '<div class="text-xs text-secondary font-semibold uppercase">Hardware Sensor Self-Test</div>' +
            '<div class="text-sm text-white font-medium mt-1">Camera (Haar/LBPH) • WBF Fingerprint Sensor • Iris Engine</div>' +
            '</div>' +
            '<span class="badge badge-green text-xs">ALL SENSORS ONLINE</span>' +
            '</div>' +
            '<div class="p-3" style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:10px;">' +
            '<div class="text-xs font-bold" style="color:#f87171;margin-bottom:2px;">EMERGENCY ESCALATION PROTOCOL</div>' +
            '<p class="text-xs text-secondary mb-0">For biometric sensor recalibration, paper audit roll replacement, or citizen registration disputes, notify the presiding <strong>Returning Officer (RO)</strong> or <strong>Assistant Returning Officer (ARO)</strong> immediately.</p>' +
            '</div>' +
            '</div>' +
            '</div>'
    }
  };

  /**
   * Initialize the modern home screen buttons and modals.
   */
  function initHomeScreen() {
    bindHomeButtons();
    bindHeaderAndModals();
  }

  function bindHomeButtons() {
    /* 1. Center Glowing "Enter" button */
    var btnEnter = document.getElementById('btn-enter-voting');
    if (btnEnter) {
      btnEnter.onclick = function (e) {
        e.preventDefault();
        window.showScreen('screen-authenticate');
      };
    }

    /* 2. Top left Brand Logo -> Home */
    var brandLink = document.getElementById('brand-home-link');
    if (brandLink) {
      brandLink.onclick = function (e) {
        e.preventDefault();
        window.showScreen('screen-home');
      };
    }

    /* 3. Admin button in Admin screen header */
    var btnAdminAddVoter = document.getElementById('btn-admin-add-voter');
    if (btnAdminAddVoter) {
      btnAdminAddVoter.onclick = function (e) {
        e.preventDefault();
        window.showScreen('screen-register');
      };
    }
  }

  function bindHeaderAndModals() {
    if (navModalsBound) return;
    navModalsBound = true;

    /* Admin Login Pill Button */
    var btnAdminPill = document.getElementById('btn-admin-login-pill');
    var modalAdmin = document.getElementById('modal-admin-choice');
    var btnCloseAdminModal = document.getElementById('btn-close-admin-modal');

    if (btnAdminPill && modalAdmin) {
      btnAdminPill.onclick = function () {
        openModal(modalAdmin);
      };
    }

    if (btnCloseAdminModal && modalAdmin) {
      btnCloseAdminModal.onclick = function () {
        closeModal(modalAdmin);
      };
    }

    /* Admin Choice 1: Register New Voter */
    var choiceReg = document.getElementById('choice-admin-register');
    if (choiceReg) {
      choiceReg.onclick = function () {
        closeModal(modalAdmin);
        window.showScreen('screen-register');
      };
    }

    /* Admin Choice 2: Open Dashboard */
    var choiceDash = document.getElementById('choice-admin-dashboard');
    if (choiceDash) {
      choiceDash.onclick = function () {
        closeModal(modalAdmin);
        window.showScreen('screen-admin');
      };
    }

    /* Modal Info Elements */
    var modalInfo = document.getElementById('modal-nav-info');
    var infoTitle = document.getElementById('nav-info-title');
    var infoSubtitle = document.getElementById('nav-info-subtitle');
    var infoBody = document.getElementById('nav-info-body');
    var btnCloseNavModal = document.getElementById('btn-close-nav-modal');
    var btnCloseNavModalBtn = document.getElementById('btn-close-nav-modal-btn');
    var modalTabPills = document.querySelectorAll('.nav-info-tab-pill');
    var navButtons = document.querySelectorAll('.nav-pill-btn');

    /**
     * Switch tab inside the briefing modal
     */
    function selectTab(tabKey) {
      var content = infoContents[tabKey];
      if (!content || !modalInfo) return;

      if (infoTitle) infoTitle.textContent = content.title;
      if (infoSubtitle) infoSubtitle.textContent = content.subtitle;
      if (infoBody) infoBody.innerHTML = content.body;

      /* Update tab pill buttons inside modal */
      modalTabPills.forEach(function (pill) {
        if (pill.getAttribute('data-tab') === tabKey) {
          pill.classList.add('active');
        } else {
          pill.classList.remove('active');
        }
      });

      /* Update navbar pill buttons in header */
      navButtons.forEach(function (b) {
        if (b.getAttribute('data-nav') === tabKey) {
          b.classList.add('active');
        } else if (b.getAttribute('data-nav') !== 'home') {
          b.classList.remove('active');
        }
      });
    }

    /* Modal Internal Tab Clicks */
    modalTabPills.forEach(function (pill) {
      pill.onclick = function () {
        var tabKey = pill.getAttribute('data-tab');
        selectTab(tabKey);
      };
    });

    /* Header Navbar Pill Navigation Clicks */
    navButtons.forEach(function (btn) {
      btn.onclick = function () {
        var navKey = btn.getAttribute('data-nav');
        if (navKey === 'home') {
          navButtons.forEach(function (b) { b.classList.remove('active'); });
          btn.classList.add('active');
          window.showScreen('screen-home');
          return;
        }

        selectTab(navKey);
        openModal(modalInfo);
      };
    });

    if (btnCloseNavModal && modalInfo) {
      btnCloseNavModal.onclick = function () {
        closeModal(modalInfo);
      };
    }

    if (btnCloseNavModalBtn && modalInfo) {
      btnCloseNavModalBtn.onclick = function () {
        closeModal(modalInfo);
      };
    }

    /* Close on backdrop click */
    window.addEventListener('click', function (e) {
      if (modalAdmin && e.target === modalAdmin) {
        closeModal(modalAdmin);
      }
      if (modalInfo && e.target === modalInfo) {
        closeModal(modalInfo);
      }
    });

    /* Close on ESC key */
    window.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        if (modalAdmin && modalAdmin.classList.contains('active')) closeModal(modalAdmin);
        if (modalInfo && modalInfo.classList.contains('active')) closeModal(modalInfo);
      }
    });
  }

  function openModal(modal) {
    if (!modal) return;
    modal.classList.add('active');
  }

  function closeModal(modal) {
    if (!modal) return;
    modal.classList.remove('active');
  }

  function destroyHomeScreen() {
    /* No persistent heavy timers to clear */
  }

  /* Expose */
  window.initHomeScreen = initHomeScreen;
  window.destroyHomeScreen = destroyHomeScreen;
})();
