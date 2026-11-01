/* ============================================================
   TriVote — Registration Flow Controller
   Multi-step voter registration with biometric capture
   ============================================================ */

(function () {
  'use strict';

  var currentStep = 1;
  var totalSteps = 5; // Steps 1 to 4 capture, Step 5 is Credential Summary
  var captureCount = 0;
  var maxCaptures = 5;
  var fingerprintScene = null;
  var irisScene = null;
  var socketEventsBound = false;

  var registrationData = {
    fullName: '',
    dob: '',
    address: '',
    phone: '',
    faceCaptures: 0,
    fingerprintCaptured: false,
    irisCaptured: false,
    voterId: null
  };

  /**
   * Initialize the registration screen.
   */
  function initRegisterScreen() {
    currentStep = 1;
    captureCount = 0;
    registrationData.fullName = '';
    registrationData.dob = '';
    registrationData.address = '';
    registrationData.phone = '';
    registrationData.faceCaptures = 0;
    registrationData.fingerprintCaptured = false;
    registrationData.irisCaptured = false;
    registrationData.voterId = null;

    /* Reset form inputs */
    var name = document.getElementById('reg-name');
    var dob = document.getElementById('reg-dob');
    var addr = document.getElementById('reg-address');
    var phone = document.getElementById('reg-phone');
    if (name) name.value = '';
    if (dob) dob.value = '';
    if (addr) addr.value = '';
    if (phone) phone.value = '';

    var regLookupId = document.getElementById('reg-lookup-id');
    var regLookupBtn = document.getElementById('btn-reg-lookup');
    if (regLookupId) regLookupId.value = '';
    if (regLookupBtn) {
      regLookupBtn.disabled = false;
      regLookupBtn.textContent = 'RESUME PROGRESS';
    }

    var idEl = document.getElementById('reg-voter-id');
    if (idEl) idEl.textContent = 'Pending';

    updateRegisterStep();
    bindRegisterEvents();
    bindRegisterSocketEvents();
  }

  /**
   * Bind button click events.
   */
  function bindRegisterEvents() {
    var backBtn = document.getElementById('register-back');
    var nextBtn = document.getElementById('register-next');
    var prevBtn = document.getElementById('register-prev');
    var captureBtn = document.getElementById('btn-face-capture');
    var fpScanBtn = document.getElementById('btn-fp-scan');
    var irisScanBtn = document.getElementById('btn-iris-scan');
    var regHomeBtn = document.getElementById('btn-reg-home');
    var regAuthBtn = document.getElementById('btn-reg-authenticate');

    /* Resume / Lookup handler */
    var regLookupBtn = document.getElementById('btn-reg-lookup');
    var regLookupInput = document.getElementById('reg-lookup-id');
    if (regLookupBtn && regLookupInput) {
      function triggerLookup() {
        var vId = regLookupInput.value.trim().toUpperCase();
        if (!vId) {
          window.showNotification('Please enter a Voter ID to resume progress.', 'warning');
          return;
        }
        regLookupBtn.disabled = true;
        regLookupBtn.textContent = 'LOOKING UP...';
        
        /* 1. Emit via WebSocket */
        window.trivoteSocket.emit('lookup_voter', { voter_id: vId });

        /* 2. Direct REST fallback to ensure instant response */
        fetch('/api/voter/' + encodeURIComponent(vId))
          .then(function (res) { return res.json(); })
          .then(function (data) {
            handleLookupResult(data);
          })
          .catch(function () {
            /* Socket handler will report if error occurs */
          });
      }

      regLookupBtn.onclick = triggerLookup;
      regLookupInput.onkeydown = function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          triggerLookup();
        }
      };
    }

    if (backBtn) {
      backBtn.onclick = function () {
        cleanupRegister();
        window.showScreen('screen-home');
      };
    }

    if (regHomeBtn) {
      regHomeBtn.onclick = function () {
        cleanupRegister();
        window.showScreen('screen-home');
      };
    }

    if (regAuthBtn) {
      regAuthBtn.onclick = function () {
        var vId = registrationData.voterId;
        cleanupRegister();
        window.showScreen('screen-authenticate');
        if (vId) {
          setTimeout(function () {
            var input = document.getElementById('auth-voter-id');
            if (input) input.value = vId;
          }, 100);
        }
      };
    }

    if (prevBtn) {
      prevBtn.onclick = function () {
        if (currentStep > 1 && currentStep < 5) {
          if (currentStep === 2) {
            window.cameraManager.stop();
          }
          currentStep--;
          updateRegisterStep();
        }
      };
    }

    if (nextBtn) {
      nextBtn.onclick = function () {
        if (currentStep === 1) {
          /* Validate form */
          var name = document.getElementById('reg-name');
          var dob = document.getElementById('reg-dob');
          if (name && name.value.trim() === '') {
            window.showNotification('Please enter your full legal name.', 'warning');
            return;
          }
          if (dob && dob.value.trim() === '') {
            window.showNotification('Please enter your date of birth.', 'warning');
            return;
          }
          registrationData.fullName = name ? name.value.trim() : '';
          registrationData.dob = dob ? dob.value.trim() : '';
          var addr = document.getElementById('reg-address');
          var phone = document.getElementById('reg-phone');
          registrationData.address = addr ? addr.value.trim() : '';
          registrationData.phone = phone ? phone.value.trim() : '';

          /* Submit personal info to server (updating if voter_id already known) */
          var regPayload = {
            name: registrationData.fullName,
            dob: registrationData.dob,
            address: registrationData.address,
            phone: registrationData.phone
          };
          if (registrationData.voterId) {
            regPayload.voter_id = registrationData.voterId;
          }
          window.trivoteSocket.emit('register_voter', regPayload);

          /* If resuming and face is already captured, jump directly to first missing modality */
          if (registrationData.voterId && registrationData.faceCaptures >= maxCaptures) {
            if (!registrationData.fingerprintCaptured) {
              currentStep = 3;
            } else if (!registrationData.irisCaptured) {
              currentStep = 4;
            } else {
              currentStep = 5;
            }
            updateRegisterStep();
            return;
          }
        }

        if (currentStep === 2) {
          /* Validate face captures completed */
          if (captureCount < maxCaptures) {
            window.showNotification(
              'Please complete all ' + maxCaptures + ' face captures before proceeding. (' + captureCount + '/' + maxCaptures + ' done)',
              'warning'
            );
            return;
          }
          /* Stop camera before moving to fingerprint */
          window.cameraManager.stop();

          /* If resuming and fingerprint already captured, jump to next incomplete */
          if (registrationData.voterId && registrationData.fingerprintCaptured) {
            if (!registrationData.irisCaptured) {
              currentStep = 4;
            } else {
              currentStep = 5;
            }
            updateRegisterStep();
            return;
          }
        }

        if (currentStep === 3) {
          if (!registrationData.fingerprintCaptured) {
            window.showNotification('Please complete a successful fingerprint scan before proceeding.', 'warning');
            return;
          }
          /* If resuming and iris already captured, jump to summary */
          if (registrationData.voterId && registrationData.irisCaptured) {
            currentStep = 5;
            updateRegisterStep();
            return;
          }
        }

        if (currentStep === 4) {
          /* Final biometric step: complete registration */
          nextBtn.disabled = true;
          nextBtn.textContent = 'COMPLETING REGISTRATION...';
          window.trivoteSocket.emit('complete_registration', {
            voter_id: registrationData.voterId
          });
          currentStep = 5;
          updateRegisterStep();
          return;
        }

        if (currentStep < 4) {
          currentStep++;
          updateRegisterStep();
        }
      };
    }

    if (captureBtn) {
      captureBtn.onclick = function () {
        var frame = window.cameraManager.captureFrame();
        if (frame && registrationData.voterId) {
          window.trivoteSocket.emit('capture_face', {
            voter_id: registrationData.voterId,
            frame: frame,
            capture_index: captureCount
          });
          captureCount++;
          registrationData.faceCaptures = captureCount;
          updateCaptureCounter();

          if (captureCount >= maxCaptures) {
            captureBtn.disabled = true;
            captureBtn.textContent = 'VERIFYING CAPTURES...';
          }
        }
      };
    }

    if (fpScanBtn) {
      fpScanBtn.onclick = function () {
        if (fingerprintScene) fingerprintScene.setState('scanning');
        var status = document.getElementById('fp-status-text');
        if (status) status.textContent = 'Touch your laptop fingerprint sensor now (Windows Hello)...';
        fpScanBtn.disabled = true;
        fpScanBtn.textContent = 'SCANNING SENSOR...';
        var fpVirtualBtn = document.getElementById('btn-fp-virtual');
        if (fpVirtualBtn) fpVirtualBtn.disabled = true;

        window.trivoteSocket.emit('capture_fingerprint', {
          voter_id: registrationData.voterId,
          use_virtual: false
        });
      };
    }

    var fpVirtualBtn = document.getElementById('btn-fp-virtual');
    if (fpVirtualBtn) {
      fpVirtualBtn.onclick = function () {
        if (fingerprintScene) fingerprintScene.setState('scanning');
        var status = document.getElementById('fp-status-text');
        if (status) status.textContent = 'Extracting ridge minutiae via Biometric Engine...';
        fpVirtualBtn.disabled = true;
        fpVirtualBtn.textContent = 'ENROLLING BIOMETRICS...';
        if (fpScanBtn) fpScanBtn.disabled = true;

        window.trivoteSocket.emit('capture_fingerprint', {
          voter_id: registrationData.voterId,
          use_virtual: true
        });
      };
    }

    if (irisScanBtn) {
      irisScanBtn.onclick = function () {
        if (irisScene) irisScene.setState('scanning');
        var status = document.getElementById('iris-status-text');
        if (status) status.textContent = 'Scanning iris pattern...';
        irisScanBtn.disabled = true;
        irisScanBtn.textContent = 'ANALYZING IRIS...';

        window.trivoteSocket.emit('capture_iris', {
          voter_id: registrationData.voterId
        });
      };
    }
  }

  /**
   * Handle parsed voter record from lookup (via socket or REST).
   */
  function handleLookupResult(data) {
    var regLookupBtn = document.getElementById('btn-reg-lookup');
    if (regLookupBtn) {
      regLookupBtn.disabled = false;
      regLookupBtn.textContent = 'RESUME PROGRESS';
    }

    if (!data || !data.success || !data.voter) {
      window.showNotification((data && data.message) ? data.message : 'Voter record not found.', 'error');
      return;
    }

    var voter = data.voter;
    /* Prevent duplicate processing if already loaded */
    if (registrationData.voterId === voter.voter_id && currentStep > 1) {
      return;
    }

    registrationData.voterId = voter.voter_id;
    registrationData.fullName = voter.name || '';
    registrationData.dob = voter.dob || '';
    registrationData.address = voter.address || '';
    registrationData.phone = voter.phone || '';
    registrationData.faceCaptures = voter.face_count || (voter.has_face ? maxCaptures : 0);
    captureCount = registrationData.faceCaptures;
    registrationData.fingerprintCaptured = Boolean(voter.has_fingerprint);
    registrationData.irisCaptured = Boolean(voter.has_iris);

    /* Populate inputs */
    var nameEl = document.getElementById('reg-name');
    var dobEl = document.getElementById('reg-dob');
    var addrEl = document.getElementById('reg-address');
    var phoneEl = document.getElementById('reg-phone');
    if (nameEl) nameEl.value = registrationData.fullName;
    if (dobEl) dobEl.value = registrationData.dob;
    if (addrEl) addrEl.value = registrationData.address;
    if (phoneEl) phoneEl.value = registrationData.phone;

    /* Update ID labels */
    var idEl = document.getElementById('reg-voter-id');
    if (idEl) idEl.textContent = voter.voter_id;
    var summaryIdEl = document.getElementById('summary-reg-voter-id');
    if (summaryIdEl) summaryIdEl.textContent = voter.voter_id;
    var summaryNameEl = document.getElementById('summary-reg-name');
    if (summaryNameEl) summaryNameEl.textContent = registrationData.fullName || 'Voter';

    /* Smart jump to first incomplete step */
    if (!voter.has_face) {
      currentStep = 2;
    } else if (!voter.has_fingerprint) {
      currentStep = 3;
    } else if (!voter.has_iris) {
      currentStep = 4;
    } else {
      currentStep = 5;
    }

    updateRegisterStep();
    var stepLabel = currentStep === 5 ? 'Summary' : ('Step ' + currentStep);
    window.showNotification('Resumed registration for ' + voter.voter_id + ' at ' + stepLabel + '.', 'success');
  }

  /**
   * Bind WebSocket event handlers for registration responses (bound ONCE).
   */
  function bindRegisterSocketEvents() {
    if (socketEventsBound) return;
    socketEventsBound = true;

    /* Resume / Lookup handler */
    window.trivoteSocket.on('voter_lookup_result', handleLookupResult);

    window.trivoteSocket.on('registration_response', function (data) {
      if (data.complete) {
        window.showNotification('Registration completed successfully!', 'success');
        currentStep = 5;
        updateRegisterStep();
        return;
      }
      if (data.success && data.voter_id) {
        registrationData.voterId = data.voter_id;
        window.showNotification(data.message || ('Voter profile saved. ID: ' + data.voter_id), 'success');
        var idEl = document.getElementById('reg-voter-id');
        if (idEl) idEl.textContent = data.voter_id;
        var summaryIdEl = document.getElementById('summary-reg-voter-id');
        if (summaryIdEl) summaryIdEl.textContent = data.voter_id;
        var summaryNameEl = document.getElementById('summary-reg-name');
        if (summaryNameEl) summaryNameEl.textContent = registrationData.fullName || 'Voter';
      } else {
        window.showNotification(data.message || 'Registration failed.', 'error');
      }
    });

    window.trivoteSocket.on('face_capture_response', function (data) {
      if (data.success) {
        window.showNotification('Face capture ' + captureCount + '/' + maxCaptures + ' saved.', 'info');
        if (data.bbox) {
          var overlay = document.getElementById('reg-face-overlay');
          if (overlay) window.cameraManager.drawOverlay(overlay, data.bbox);
        }
        /* Check if all captures are confirmed by server */
        if (captureCount >= maxCaptures) {
          var captureBtn = document.getElementById('btn-face-capture');
          if (captureBtn) {
            captureBtn.disabled = true;
            captureBtn.textContent = 'CAPTURES COMPLETE';
          }
          window.cameraManager.stopStreaming();
          window.showNotification('All facial captures completed. Click NEXT STEP to continue.', 'success');
          var nextBtn = document.getElementById('register-next');
          if (nextBtn) nextBtn.disabled = false;
        }
      } else {
        window.showNotification(data.message || 'Face capture failed. Try again.', 'warning');
        captureCount--;
        if (captureCount < 0) captureCount = 0;
        registrationData.faceCaptures = captureCount;
        updateCaptureCounter();
        var captureBtn = document.getElementById('btn-face-capture');
        if (captureBtn) {
          captureBtn.disabled = false;
          captureBtn.textContent = 'CAPTURE';
        }
        var nextBtn = document.getElementById('register-next');
        if (nextBtn) nextBtn.disabled = true;
      }
    });

    window.trivoteSocket.on('fingerprint_status', function (data) {
      var status = document.getElementById('fp-status-text');
      var fpBtn = document.getElementById('btn-fp-scan');
      var fpVirtualBtn = document.getElementById('btn-fp-virtual');
      var nextBtn = document.getElementById('register-next');

      if (data.status === 'captured') {
        if (fingerprintScene) fingerprintScene.setState('success');
        if (status) status.textContent = withModePrefix(data, data.message || 'Fingerprint enrolled successfully.');
        if (fpBtn) {
          fpBtn.disabled = false;
          fpBtn.textContent = 'RE-SCAN (HARDWARE)';
        }
        if (fpVirtualBtn) {
          fpVirtualBtn.disabled = false;
          fpVirtualBtn.textContent = 'RE-ENROLL (BIOMETRIC ENGINE)';
          fpVirtualBtn.className = 'btn btn-outline btn-block mt-3';
        }
        registrationData.fingerprintCaptured = true;
        if (nextBtn && currentStep === 3) nextBtn.disabled = false;
        window.showNotification('Fingerprint enrolled.', 'success');
      } else if (data.status === 'error') {
        if (fingerprintScene) fingerprintScene.setState('error');
        var isNotEnrolled = data.reason === 'no_match' || data.reason === 'not_enrolled_windows' || String(data.message).indexOf('not recognized') !== -1;
        var displayMsg = isNotEnrolled
          ? 'Finger rejected by Windows Hello (not enrolled on this PC). Click the button below to enroll your friend via the Biometric Engine, or add their finger in Windows Settings.'
          : withModePrefix(data, data.message || 'Capture failed. Try again.');

        if (status) status.textContent = displayMsg;
        if (fpBtn) {
          fpBtn.disabled = false;
          fpBtn.textContent = 'RETRY SENSOR';
        }
        if (fpVirtualBtn) {
          fpVirtualBtn.disabled = false;
          fpVirtualBtn.textContent = 'ENROLL VIA BIOMETRIC ENGINE (GUEST / FRIEND)';
          fpVirtualBtn.className = 'btn btn-primary btn-block mt-3';
        }
        window.showNotification(
          isNotEnrolled
            ? 'Friend not enrolled in Windows Hello. Click [Enroll via Biometric Engine] below.'
            : (data.message || 'Fingerprint error.'),
          'warning'
        );
      } else {
        if (status) status.textContent = withModePrefix(data, data.message || 'Processing...');
      }
    });

    window.trivoteSocket.on('iris_status', function (data) {
      var status = document.getElementById('iris-status-text');
      var irisBtn = document.getElementById('btn-iris-scan');
      if (data.status === 'captured') {
        if (irisScene) irisScene.setState('success');
        if (status) status.textContent = 'Iris pattern enrolled successfully.';
        if (irisBtn) {
          irisBtn.disabled = false;
          irisBtn.textContent = 'SCAN AGAIN';
        }
        registrationData.irisCaptured = true;
        window.showNotification('Iris enrolled.', 'success');
      } else if (data.status === 'error') {
        if (irisScene) irisScene.setState('error');
        if (status) status.textContent = 'Scan failed. Try again.';
        if (irisBtn) {
          irisBtn.disabled = false;
          irisBtn.textContent = 'SCAN AGAIN';
        }
        window.showNotification(data.message || 'Iris scan error.', 'error');
      } else if (data.progress !== undefined) {
        if (irisScene) {
          irisScene.setState('analyzing');
          irisScene.setProgress(data.progress);
        }
        if (status) status.textContent = 'Analyzing... ' + Math.round(data.progress * 100) + '%';
      }
    });
  }

  /**
   * Update the UI to reflect the current step.
   */
  function updateRegisterStep() {
    var stepIndicator = document.getElementById('register-step-indicator');
    if (stepIndicator) {
      stepIndicator.textContent = currentStep === 5 ? 'Summary' : 'Step ' + currentStep + ' of 4';
    }

    /* Hide all step panels */
    var panels = document.querySelectorAll('.register-step-panel');
    panels.forEach(function (panel) {
      panel.classList.remove('active');
      panel.style.display = 'none';
    });

    /* Show current panel */
    var activePanel = document.getElementById('register-step-' + currentStep);
    if (activePanel) {
      activePanel.style.display = 'block';
      activePanel.classList.add('active');
      activePanel.classList.add('page-enter');
    }

    var navButtons = document.getElementById('register-nav-buttons');
    if (currentStep === 5) {
      if (navButtons) navButtons.style.display = 'none';
      var summaryIdEl = document.getElementById('summary-reg-voter-id');
      if (summaryIdEl && registrationData.voterId) summaryIdEl.textContent = registrationData.voterId;
      var summaryNameEl = document.getElementById('summary-reg-name');
      if (summaryNameEl) summaryNameEl.textContent = registrationData.fullName || 'Voter';

      var faceBadge = document.getElementById('summary-reg-face');
      if (faceBadge) {
        if (registrationData.faceCaptures >= maxCaptures) {
          faceBadge.className = 'badge badge-success';
          faceBadge.textContent = 'Enrolled (' + registrationData.faceCaptures + ' Frames)';
        } else {
          faceBadge.className = 'badge badge-amber';
          faceBadge.textContent = 'Incomplete (' + registrationData.faceCaptures + '/' + maxCaptures + ')';
        }
      }

      var fpBadge = document.getElementById('summary-reg-fp');
      if (fpBadge) {
        if (registrationData.fingerprintCaptured) {
          fpBadge.className = 'badge badge-success';
          fpBadge.textContent = 'Enrolled (Hardware Sensor)';
        } else {
          fpBadge.className = 'badge badge-amber';
          fpBadge.textContent = 'Pending Enrollment';
        }
      }

      var irisBadge = document.getElementById('summary-reg-iris');
      if (irisBadge) {
        if (registrationData.irisCaptured) {
          irisBadge.className = 'badge badge-success';
          irisBadge.textContent = 'Enrolled (Daugman Code)';
        } else {
          irisBadge.className = 'badge badge-amber';
          irisBadge.textContent = 'Pending Enrollment';
        }
      }
      return;
    } else {
      if (navButtons) navButtons.style.display = 'flex';
    }

    /* Initialize step-specific features */
    switch (currentStep) {
      case 2:
        initFaceCapture();
        break;
      case 3:
        initFingerprintCapture();
        break;
      case 4:
        initIrisCapture();
        break;
    }

    /* Update nav buttons */
    var prevBtn = document.getElementById('register-prev');
    var nextBtn = document.getElementById('register-next');
    if (prevBtn) prevBtn.style.visibility = currentStep === 1 ? 'hidden' : 'visible';
    if (nextBtn) {
      nextBtn.textContent = currentStep === 4 ? 'COMPLETE REGISTRATION' : 'NEXT STEP';
      if (currentStep === 2) {
        nextBtn.disabled = captureCount < maxCaptures;
      } else if (currentStep === 3) {
        nextBtn.disabled = !registrationData.fingerprintCaptured;
      } else {
        nextBtn.disabled = false;
      }
    }
  }

  function initFaceCapture() {
    captureCount = registrationData.faceCaptures;
    updateCaptureCounter();

    var video = document.getElementById('reg-face-video');
    if (video) {
      window.cameraManager.init(video).catch(function () {
        window.showNotification('Could not access camera.', 'error');
      });
    }

    var captureBtn = document.getElementById('btn-face-capture');
    if (captureBtn) {
      if (captureCount >= maxCaptures) {
        captureBtn.disabled = true;
        captureBtn.textContent = 'CAPTURES COMPLETE';
      } else {
        captureBtn.disabled = false;
        captureBtn.textContent = 'CAPTURE';
      }
    }
  }

  function initFingerprintCapture() {
    if (!fingerprintScene) {
      fingerprintScene = new window.FingerprintScene('reg-fp-canvas');
      fingerprintScene.init();
    }

    var status = document.getElementById('fp-status-text');
    var fpScanBtn = document.getElementById('btn-fp-scan');
    var fpVirtualBtn = document.getElementById('btn-fp-virtual');
    var nextBtn = document.getElementById('register-next');

    if (registrationData.fingerprintCaptured) {
      fingerprintScene.setState('success');
      if (status) status.textContent = 'Fingerprint enrolled previously. You may re-scan or proceed to the next step.';
      if (fpScanBtn) {
        fpScanBtn.disabled = false;
        fpScanBtn.textContent = 'RE-SCAN (HARDWARE)';
      }
      if (fpVirtualBtn) {
        fpVirtualBtn.disabled = false;
        fpVirtualBtn.textContent = 'RE-ENROLL (BIOMETRIC ENGINE)';
        fpVirtualBtn.className = 'btn btn-outline btn-block mt-3';
      }
      if (nextBtn) nextBtn.disabled = false;
    } else {
      fingerprintScene.setState('idle');
      if (status) status.textContent = 'Touch the hardware sensor for laptop owner, or use the Biometric Engine for friends.';
      if (fpScanBtn) {
        fpScanBtn.disabled = false;
        fpScanBtn.textContent = 'BEGIN SCAN (HARDWARE SENSOR)';
      }
      if (fpVirtualBtn) {
        fpVirtualBtn.disabled = false;
        fpVirtualBtn.textContent = 'ENROLL VIA BIOMETRIC ENGINE (GUEST / FRIEND)';
        fpVirtualBtn.className = 'btn btn-outline btn-block mt-3';
      }
      if (nextBtn) nextBtn.disabled = true;
    }
  }

  function initIrisCapture() {
    if (!irisScene) {
      irisScene = new window.IrisScene('reg-iris-canvas');
      irisScene.init();
    }

    var status = document.getElementById('iris-status-text');
    var irisScanBtn = document.getElementById('btn-iris-scan');
    var nextBtn = document.getElementById('register-next');

    if (registrationData.irisCaptured) {
      irisScene.setState('success');
      if (status) status.textContent = 'Iris pattern enrolled previously. Click COMPLETE REGISTRATION to finalize.';
      if (irisScanBtn) {
        irisScanBtn.disabled = false;
        irisScanBtn.textContent = 'RE-SCAN IRIS';
      }
      if (nextBtn) nextBtn.disabled = false;
    } else {
      irisScene.setState('scanning');
      if (status) status.textContent = 'Scanning iris pattern...';
      if (irisScanBtn) {
        irisScanBtn.disabled = true;
        irisScanBtn.textContent = 'ANALYZING IRIS...';
      }
      setTimeout(function () {
        if (registrationData.voterId) {
          window.trivoteSocket.emit('capture_iris', {
            voter_id: registrationData.voterId
          });
        }
      }, 500);
    }
  }

  /**
   * Prefix fingerprint status text when the server is not using the real sensor.
   */
  function withModePrefix(data, text) {
    if (data && (data.mode === 'simulation' || data.mode === 'simulation_fallback') &&
        String(text).indexOf('[Simulation mode]') === -1) {
      return '[Simulation mode] ' + text;
    }
    return text;
  }

  function updateCaptureCounter() {
    var counter = document.getElementById('face-capture-count');
    if (counter) {
      counter.textContent = 'Captures: ' + captureCount + '/' + maxCaptures;
    }
  }

  function cleanupRegister() {
    window.cameraManager.stop();
    if (fingerprintScene) {
      fingerprintScene.dispose();
      fingerprintScene = null;
    }
    if (irisScene) {
      irisScene.dispose();
      irisScene = null;
    }
  }

  /**
   * Resume/Update registration helper exposed globally.
   */
  window.resumeRegistration = function (voterId) {
    if (!voterId) return;
    window.showScreen('screen-register');
    var input = document.getElementById('reg-lookup-id');
    if (input) input.value = voterId;
    var btn = document.getElementById('btn-reg-lookup');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'LOOKING UP...';
    }
    window.trivoteSocket.emit('lookup_voter', { voter_id: voterId });
    fetch('/api/voter/' + encodeURIComponent(voterId))
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (typeof handleLookupResult === 'function') handleLookupResult(data);
      })
      .catch(function () {});
  };

  /* Expose */
  window.initRegisterScreen = initRegisterScreen;
  window.destroyRegisterScreen = cleanupRegister;
})();
