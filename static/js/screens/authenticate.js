/* ============================================================
   TriVote — Authentication Flow Controller
   Multi-step biometric authentication for voting
   ============================================================ */

(function () {
  'use strict';

  var authStep = 0; /* 0=voter_id, 1=face, 2=fingerprint, 3=iris, 4=result */
  var stepper = null;
  var fingerprintScene = null;
  var irisScene = null;
  var socketEventsBound = false;
  var isFpScanning = false;

  /* Face auth accumulation: collect multiple frame results before deciding */
  var faceMatchCount = 0;
  var faceSuccessCount = 0;
  var faceBestScore = 0;
  var faceBestBbox = null;
  var faceDecided = false;
  var FACE_FRAMES_NEEDED = 8;  /* Analyze this many frames before deciding */
  var FACE_SUCCESS_THRESHOLD = 3;  /* Need at least this many matches to pass */

  var scores = {
    face: null,
    fingerprint: null,
    iris: null,
    fusion: null
  };
  var currentVoterId = null;
  var faceGauge = null;
  var fpGauge = null;
  var irisGauge = null;
  var fusionGauge = null;

  function initAuthenticateScreen() {
    authStep = 0;
    currentVoterId = null;
    isFpScanning = false;
    faceMatchCount = 0;
    faceSuccessCount = 0;
    faceBestScore = 0;
    faceBestBbox = null;
    faceDecided = false;
    scores = { face: null, fingerprint: null, iris: null, fusion: null };

    /* Init stepper */
    stepper = new window.ProgressStepper('auth-stepper', [
      'FACE', 'FINGERPRINT', 'IRIS', 'RESULT'
    ]);
    stepper.render();

    /* Score gauges */
    faceGauge = new window.ScoreGauge('gauge-face');
    faceGauge.label = 'Face';
    faceGauge.render();

    fpGauge = new window.ScoreGauge('gauge-fingerprint');
    fpGauge.label = 'Fingerprint';
    fpGauge.render();

    irisGauge = new window.ScoreGauge('gauge-iris');
    irisGauge.label = 'Iris';
    irisGauge.render();

    fusionGauge = new window.ScoreGauge('gauge-fusion');
    fusionGauge.label = 'Fusion';
    fusionGauge.render();

    showAuthStage(0);
    bindAuthEvents();
    bindAuthSocketEvents();
    updateScoreSummary();

    /* Reset verify button and input state */
    var verifyBtn = document.getElementById('btn-verify-voter');
    if (verifyBtn) {
      verifyBtn.disabled = false;
      verifyBtn.textContent = 'VERIFY';
    }
    var voterInput = document.getElementById('auth-voter-id');
    if (voterInput) {
      voterInput.disabled = false;
    }
  }

  function bindAuthEvents() {
    var backBtn = document.getElementById('auth-back');
    var verifyBtn = document.getElementById('btn-verify-voter');
    var voterInput = document.getElementById('auth-voter-id');
    var retryBtn = document.getElementById('btn-auth-retry');
    var homeBtn = document.getElementById('btn-auth-return-home');
    var impostorBtn = document.getElementById('btn-auth-fp-impostor');
    var fpScanBtn = document.getElementById('btn-auth-fp-scan');

    if (backBtn) {
      backBtn.onclick = function () {
        cleanupAuth();
        window.showScreen('screen-home');
      };
    }

    if (retryBtn) {
      retryBtn.onclick = function () {
        cleanupAuth();
        initAuthenticateScreen();
      };
    }

    if (homeBtn) {
      homeBtn.onclick = function () {
        cleanupAuth();
        window.showScreen('screen-home');
      };
    }

    if (verifyBtn) {
      verifyBtn.onclick = function () {
        var id = voterInput ? voterInput.value.trim() : '';
        if (id === '') {
          window.showNotification('Please enter a Voter ID.', 'warning');
          return;
        }
        currentVoterId = id;
        verifyBtn.disabled = true;
        verifyBtn.textContent = 'VERIFYING...';
        window.trivoteSocket.emit('verify_voter', { voter_id: id });
      };
    }

    if (voterInput) {
      voterInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          if (verifyBtn && !verifyBtn.disabled) {
            verifyBtn.click();
          }
        }
      });
    }

    if (fpScanBtn) {
      fpScanBtn.onclick = function () {
        startFingerprintAuth(false);
      };
    }

    if (impostorBtn) {
      impostorBtn.onclick = function () {
        startFingerprintAuth(true);
      };
    }
  }

  function startFingerprintAuth(isImpostor) {
    if (isFpScanning) return;
    isFpScanning = true;

    var statusEl = document.getElementById('auth-fp-status');
    var scanBtn = document.getElementById('btn-auth-fp-scan');
    var impostorBtn = document.getElementById('btn-auth-fp-impostor');

    if (fingerprintScene) fingerprintScene.setState('scanning');

    if (scanBtn) {
      scanBtn.disabled = true;
      scanBtn.textContent = isImpostor ? 'TESTING IMPOSTOR...' : 'TOUCH SENSOR NOW...';
    }
    if (impostorBtn) {
      impostorBtn.disabled = true;
    }

    if (statusEl) {
      statusEl.textContent = isImpostor
        ? 'Simulating un-enrolled finger touch (impostor test)...'
        : 'Touch your laptop fingerprint sensor now (Windows Hello prompt is opening)...';
    }

    window.trivoteSocket.emit('match_fingerprint', {
      voter_id: currentVoterId,
      test_impostor: isImpostor
    });
  }

  function bindAuthSocketEvents() {
    if (socketEventsBound) return;
    socketEventsBound = true;

    window.trivoteSocket.on('voter_verified', function (data) {
      var verifyBtn = document.getElementById('btn-verify-voter');
      if (data.success) {
        window.showNotification('Voter verified. Begin authentication.', 'success');
        authStep = 1;
        stepper.setActiveStep(0);
        showAuthStage(1);
      } else {
        window.showNotification(data.message || 'Voter not found.', 'error');
        if (verifyBtn) {
          verifyBtn.disabled = false;
          verifyBtn.textContent = 'VERIFY';
        }
      }
    });

    window.trivoteSocket.on('face_match_result', function (data) {
      /* If already decided, ignore further frames */
      if (faceDecided) return;

      /* Handle model-not-trained error (immediate reject) */
      if (data.message && data.message.indexOf('not trained') !== -1) {
        faceDecided = true;
        window.cameraManager.stopStreaming();
        window.cameraManager.stop();
        scores.face = 0.0;
        faceGauge.setValue(0.0, 'Face');
        updateScoreSummary();
        stepper.markError(0);
        window.showNotification('Face model not trained. Register biometrics first.', 'error');
        setTimeout(function () { proceedToResult(false, 'No face biometric data enrolled. Please register first.'); }, 1500);
        return;
      }

      /* Track overlay */
      if (data.bbox) {
        var overlay = document.getElementById('auth-face-overlay');
        if (overlay) window.cameraManager.drawOverlay(overlay, data.bbox);
      }

      /* Accumulate results */
      faceMatchCount++;
      if (data.success && data.score > 0) {
        faceSuccessCount++;
        if (data.score > faceBestScore) {
          faceBestScore = data.score;
          faceBestBbox = data.bbox;
        }
      }

      /* Update live score display */
      var liveScore = faceBestScore > 0 ? faceBestScore : (data.score || 0);
      faceGauge.setValue(liveScore, 'Face');

      /* Update status text */
      var statusEl = document.getElementById('auth-face-status');
      if (statusEl) {
        statusEl.textContent = 'Analyzing frame ' + faceMatchCount + '/' + FACE_FRAMES_NEEDED + '...';
      }

      /* Decide after enough frames */
      if (faceMatchCount >= FACE_FRAMES_NEEDED) {
        faceDecided = true;
        window.cameraManager.stopStreaming();
        window.cameraManager.stop();

        var passed = faceSuccessCount >= FACE_SUCCESS_THRESHOLD;
        var finalScore = passed ? faceBestScore : liveScore;

        scores.face = finalScore;
        faceGauge.setValue(finalScore, 'Face');
        updateScoreSummary();

        if (passed) {
          stepper.markCompleted(0);
          window.showNotification('Face verified. Score: ' + finalScore.toFixed(1) + '%', 'success');
          setTimeout(function () {
            authStep = 2;
            stepper.setActiveStep(1);
            showAuthStage(2);
          }, 1200);
        } else {
          stepper.markError(0);
          window.showNotification('Face verification failed. Identity not confirmed.', 'error');
          setTimeout(function () { proceedToResult(false, 'Facial biometric verification failed'); }, 1500);
        }
      }
    });

    window.trivoteSocket.on('fingerprint_status', function (data) {
      var statusEl = document.getElementById('auth-fp-status');
      var scanBtn = document.getElementById('btn-auth-fp-scan');
      var impostorBtn = document.getElementById('btn-auth-fp-impostor');

      if (statusEl && data.message) {
        statusEl.textContent = withModePrefix(data, data.message);
      }

      if (data.status === 'error') {
        if (fingerprintScene) fingerprintScene.setState('error');
        isFpScanning = false;
        if (scanBtn) {
          scanBtn.disabled = false;
          scanBtn.textContent = 'TOUCH SENSOR NOW';
        }
        if (impostorBtn) {
          impostorBtn.disabled = false;
        }
      } else if (data.status === 'captured') {
        if (fingerprintScene) fingerprintScene.setState('success');
      }
    });

    window.trivoteSocket.on('fingerprint_match_result', function (data) {
      var scanBtn = document.getElementById('btn-auth-fp-scan');
      var impostorBtn = document.getElementById('btn-auth-fp-impostor');
      isFpScanning = false;

      if (data.score !== undefined) {
        scores.fingerprint = data.score;
        fpGauge.setValue(data.score, 'Fingerprint');
        updateScoreSummary();
      }

      if (data.success) {
        if (fingerprintScene) fingerprintScene.setState('success');
        stepper.markCompleted(1);
        window.showNotification('Fingerprint matched! Score: ' + (data.score || 0).toFixed(1) + '%', 'success');
        setTimeout(function () {
          authStep = 3;
          stepper.setActiveStep(2);
          showAuthStage(3);
        }, 1200);
      } else {
        if (fingerprintScene) fingerprintScene.setState('error');
        stepper.markError(1);
        if (scanBtn) {
          scanBtn.disabled = false;
          scanBtn.textContent = 'RE-SCAN FINGER';
        }
        if (impostorBtn) {
          impostorBtn.disabled = false;
        }
        window.showNotification(data.message || 'Fingerprint match failed (Impostor/Unenrolled).', 'error');

        /* Transient / setup failures: stay on the fingerprint step and allow a re-scan */
        var retryStatuses = ['timeout', 'bad_capture', 'error', 'busy', 'legacy_template', 'not_enrolled'];
        if (retryStatuses.indexOf(data.status) !== -1) {
          var statusEl = document.getElementById('auth-fp-status');
          if (statusEl) statusEl.textContent = withModePrefix(data, data.message || 'Fingerprint scan failed. Please retry.');
          if (scanBtn) {
            scanBtn.disabled = false;
            scanBtn.textContent = 'RE-SCAN FINGER';
          }
          if (impostorBtn) impostorBtn.disabled = false;
          return;
        }

        /* Genuine mismatch (wrong finger / impostor test) */
        setTimeout(function () {
          proceedToResult(false, data.message || 'Fingerprint match failed (Impostor detected)');
        }, 1500);
      }
    });

    window.trivoteSocket.on('iris_match_result', function (data) {
      if (data.score !== undefined) {
        scores.iris = data.score;
        irisGauge.setValue(data.score, 'Iris');
        updateScoreSummary();
      }

      if (data.success) {
        if (irisScene) irisScene.setState('success');
        stepper.markCompleted(2);
        window.showNotification('Iris matched. Score: ' + (data.score || 0).toFixed(1) + '%', 'success');
        /* Request final auth decision */
        window.trivoteSocket.emit('request_auth_decision', {
          voter_id: currentVoterId,
          scores: scores
        });
      } else {
        if (irisScene) irisScene.setState('error');
        stepper.markError(2);
        window.showNotification('Iris match failed.', 'error');
        setTimeout(function () { proceedToResult(false, 'Iris pattern match failed'); }, 1500);
      }
    });

    window.trivoteSocket.on('auth_decision', function (data) {
      scores.fusion = data.fusion_score || null;
      if (fusionGauge && scores.fusion !== null) {
        fusionGauge.setValue(scores.fusion, 'Fusion');
      }
      updateScoreSummary();
      proceedToResult(data.authenticated, data.rejection_reason);
    });
  }

  function showAuthStage(stage) {
    /* Hide all stages */
    var stages = document.querySelectorAll('.auth-stage');
    stages.forEach(function (el) {
      el.style.display = 'none';
    });

    /* Show target stage */
    var target = document.getElementById('auth-stage-' + stage);
    if (target) {
      target.style.display = 'flex';
      target.classList.add('page-enter');
    }

    /* Initialize stage-specific elements */
    switch (stage) {
      case 1:
        initAuthFace();
        break;
      case 2:
        initAuthFingerprint();
        break;
      case 3:
        initAuthIris();
        break;
      case 4:
        break;
    }
  }

  function initAuthFace() {
    /* Reset face analysis state */
    faceMatchCount = 0;
    faceSuccessCount = 0;
    faceBestScore = 0;
    faceBestBbox = null;
    faceDecided = false;

    var video = document.getElementById('auth-face-video');
    var scanFaceBtn = document.getElementById('btn-auth-face-scan');

    if (scanFaceBtn) {
      scanFaceBtn.disabled = false;
      scanFaceBtn.onclick = function () {
        var frame = window.cameraManager.captureFrame() || '';
        window.trivoteSocket.emit('match_face', { frame: frame, voter_id: currentVoterId });
      };
    }

    if (video) {
      window.cameraManager.init(video).then(function () {
        /* Stream frames and include voter_id so server knows who to match */
        window.cameraManager.startStreaming(window.trivoteSocket, 'match_face', 3, { voter_id: currentVoterId });
        window.trivoteSocket.emit('start_face_auth', { voter_id: currentVoterId });
      }).catch(function () {
        window.showNotification('Could not access camera. You can use VERIFY FACE button.', 'warning');
      });
    }
  }

  function initAuthFingerprint() {
    isFpScanning = false;
    if (!fingerprintScene) {
      fingerprintScene = new window.FingerprintScene('auth-fp-canvas');
      fingerprintScene.init();
    }
    fingerprintScene.setState('idle');

    var statusEl = document.getElementById('auth-fp-status');
    if (statusEl) statusEl.textContent = 'Touch your sensor or click "TOUCH SENSOR NOW" to verify identity.';

    var scanBtn = document.getElementById('btn-auth-fp-scan');
    var impostorBtn = document.getElementById('btn-auth-fp-impostor');

    if (scanBtn) {
      scanBtn.disabled = false;
      scanBtn.textContent = 'TOUCH SENSOR NOW';
    }
    if (impostorBtn) {
      impostorBtn.disabled = false;
    }
  }

  function initAuthIris() {
    if (!irisScene) {
      irisScene = new window.IrisScene('auth-iris-canvas');
      irisScene.init();
    }
    irisScene.setState('scanning');

    var statusEl = document.getElementById('auth-iris-status');
    if (statusEl) statusEl.textContent = 'Scanning iris pattern...';

    var scanBtn = document.getElementById('btn-auth-iris-scan');
    if (scanBtn) {
      scanBtn.disabled = true;
      scanBtn.textContent = 'ANALYZING IRIS...';
      scanBtn.onclick = function () {
        irisScene.setState('scanning');
        scanBtn.disabled = true;
        if (statusEl) statusEl.textContent = 'Scanning iris pattern...';
        window.trivoteSocket.emit('match_iris', { voter_id: currentVoterId });
      };
    }

    /* Auto-start iris scan */
    setTimeout(function () {
      window.trivoteSocket.emit('match_iris', { voter_id: currentVoterId });
    }, 500);
  }

  function proceedToResult(authenticated, reason) {
    authStep = 4;
    stepper.setActiveStep(3);

    if (authenticated) {
      stepper.markCompleted(3);
    } else {
      stepper.markError(3);
    }

    showAuthStage(4);

    var resultIcon = document.getElementById('auth-result-icon');
    var resultText = document.getElementById('auth-result-text');
    var rejectionMsg = document.getElementById('auth-rejection-msg');
    var voteBtn = document.getElementById('btn-proceed-vote');
    var retryBtn = document.getElementById('btn-auth-retry');
    var homeBtn = document.getElementById('btn-auth-return-home');

    if (authenticated) {
      if (resultIcon) {
        resultIcon.className = 'decision-display__icon decision-display__icon--success';
        resultIcon.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>';
      }
      if (resultText) {
        resultText.className = 'decision-display__text decision-display__text--success';
        resultText.textContent = 'AUTHENTICATED';
      }
      if (rejectionMsg) rejectionMsg.style.display = 'none';
      if (voteBtn) {
        voteBtn.style.display = 'inline-flex';
        voteBtn.onclick = function () {
          window.appState.authenticatedVoterId = currentVoterId;
          window.showScreen('screen-vote');
        };
      }
      if (retryBtn) retryBtn.style.display = 'none';
      if (homeBtn) homeBtn.style.display = 'none';
    } else {
      if (resultIcon) {
        resultIcon.className = 'decision-display__icon decision-display__icon--error';
        resultIcon.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>';
      }
      if (resultText) {
        resultText.className = 'decision-display__text decision-display__text--error';
        resultText.textContent = 'REJECTED';
      }
      if (rejectionMsg) {
        rejectionMsg.textContent = reason || 'Biometric security threshold not satisfied.';
        rejectionMsg.style.display = 'block';
      }
      if (voteBtn) voteBtn.style.display = 'none';
      if (retryBtn) retryBtn.style.display = 'inline-flex';
      if (homeBtn) homeBtn.style.display = 'inline-flex';
    }

    /* Update result gauges */
    if (scores.face !== null && faceGauge) faceGauge.setValue(scores.face, 'Face');
    if (scores.fingerprint !== null && fpGauge) fpGauge.setValue(scores.fingerprint, 'Fingerprint');
    if (scores.iris !== null && irisGauge) irisGauge.setValue(scores.iris, 'Iris');
    if (scores.fusion !== null && fusionGauge) fusionGauge.setValue(scores.fusion, 'Fusion');
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

  function updateScoreSummary() {
    var items = [
      { id: 'summary-face', value: scores.face },
      { id: 'summary-fingerprint', value: scores.fingerprint },
      { id: 'summary-iris', value: scores.iris },
      { id: 'summary-fusion', value: scores.fusion }
    ];

    items.forEach(function (item) {
      var el = document.getElementById(item.id);
      if (el) {
        el.textContent = item.value !== null ? item.value.toFixed(1) + '%' : 'N/A';
      }
    });
  }

  function cleanupAuth() {
    isFpScanning = false;
    window.cameraManager.stop();
    if (fingerprintScene) {
      fingerprintScene.dispose();
      fingerprintScene = null;
    }
    if (irisScene) {
      irisScene.dispose();
      irisScene = null;
    }
    var verifyBtn = document.getElementById('btn-verify-voter');
    if (verifyBtn) {
      verifyBtn.disabled = false;
      verifyBtn.textContent = 'VERIFY';
    }
    var voterInput = document.getElementById('auth-voter-id');
    if (voterInput) {
      voterInput.disabled = false;
    }
  }

  window.initAuthenticateScreen = initAuthenticateScreen;
  window.destroyAuthenticateScreen = cleanupAuth;
})();
