/* ============================================================
   TriVote — Camera Manager
   Handles getUserMedia, live streaming, and frame capture
   ============================================================ */

/**
 * CameraManager — wraps the browser MediaDevices API to provide
 * video capture, base64 frame streaming, and overlay drawing.
 */
class CameraManager {
  constructor() {
    this.videoElement = null;
    this.stream = null;
    this.streamingInterval = null;
    this.isStreaming = false;
    this._captureCanvas = document.createElement('canvas');
    this._captureCtx = this._captureCanvas.getContext('2d');
  }

  /**
   * Initialize the camera and attach to a video element.
   * @param {HTMLVideoElement} videoElement
   * @returns {Promise<void>}
   */
  async init(videoElement) {
    this.videoElement = videoElement;

    const constraints = {
      video: {
        width: { ideal: 640 },
        height: { ideal: 480 },
        facingMode: 'user'
      },
      audio: false
    };

    try {
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.videoElement.srcObject = this.stream;
      await this.videoElement.play();

      this._captureCanvas.width = this.videoElement.videoWidth || 640;
      this._captureCanvas.height = this.videoElement.videoHeight || 480;

      /* Update sensor status in header */
      const dotEl = document.getElementById('status-dot-sensor');
      const textEl = document.getElementById('status-text-sensor');
      if (dotEl) dotEl.className = 'status-dot status-dot--green';
      if (textEl) textEl.textContent = 'Camera Active';

    } catch (err) {
      console.error('[CameraManager] Failed to access camera:', err);
      const dotEl = document.getElementById('status-dot-sensor');
      const textEl = document.getElementById('status-text-sensor');
      if (dotEl) dotEl.className = 'status-dot status-dot--red';
      if (textEl) textEl.textContent = 'Camera Error';
      throw err;
    }
  }

  /**
   * Start sending base64 JPEG frames to the server via socket.
   * @param {TriVoteSocket} socket - The socket instance.
   * @param {string} eventName - The event to emit frames on.
   * @param {number} [fps=10] - Frames per second.
   * @param {Object} [extraData={}] - Extra fields to include with each frame.
   */
  startStreaming(socket, eventName, fps, extraData) {
    fps = fps || 10;
    extraData = extraData || {};
    if (this.isStreaming) {
      this.stopStreaming();
    }

    this.isStreaming = true;
    const interval = 1000 / fps;

    this.streamingInterval = setInterval(() => {
      if (!this.videoElement || this.videoElement.readyState < 2) return;

      const frame = this.captureFrame();
      if (frame) {
        var payload = Object.assign({}, extraData, { frame: frame });
        socket.emit(eventName, payload);
      }
    }, interval);
  }

  /**
   * Stop the frame streaming interval.
   */
  stopStreaming() {
    if (this.streamingInterval) {
      clearInterval(this.streamingInterval);
      this.streamingInterval = null;
    }
    this.isStreaming = false;
  }

  /**
   * Capture the current video frame as a base64 JPEG string.
   * @returns {string|null} Base64-encoded JPEG data (without the data URI prefix).
   */
  captureFrame() {
    if (!this.videoElement || this.videoElement.readyState < 2) return null;

    this._captureCanvas.width = this.videoElement.videoWidth || 640;
    this._captureCanvas.height = this.videoElement.videoHeight || 480;
    this._captureCtx.drawImage(this.videoElement, 0, 0);

    const dataUrl = this._captureCanvas.toDataURL('image/jpeg', 0.8);
    /* Strip the "data:image/jpeg;base64," prefix */
    return dataUrl.split(',')[1];
  }

  /**
   * Stop the camera entirely and release the media stream.
   */
  stop() {
    this.stopStreaming();

    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }

    if (this.videoElement) {
      this.videoElement.srcObject = null;
    }

    const dotEl = document.getElementById('status-dot-sensor');
    const textEl = document.getElementById('status-text-sensor');
    if (dotEl) dotEl.className = 'status-dot status-dot--yellow';
    if (textEl) textEl.textContent = 'Sensor Idle';
  }

  /**
   * Draw a face detection bounding-box overlay on a canvas.
   * Uses corner bracket style (green lines, not filled).
   * @param {HTMLCanvasElement} canvas - Overlay canvas element.
   * @param {Object} bbox - Bounding box {x, y, width, height} in video coordinates.
   */
  drawOverlay(canvas, bbox) {
    const ctx = canvas.getContext('2d');
    const scaleX = canvas.width / (this.videoElement.videoWidth || 640);
    const scaleY = canvas.height / (this.videoElement.videoHeight || 480);

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!bbox) return;

    const x = bbox.x * scaleX;
    const y = bbox.y * scaleY;
    const w = bbox.width * scaleX;
    const h = bbox.height * scaleY;
    const cornerLen = Math.min(w, h) * 0.2;

    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';

    /* Top-left corner */
    ctx.beginPath();
    ctx.moveTo(x, y + cornerLen);
    ctx.lineTo(x, y);
    ctx.lineTo(x + cornerLen, y);
    ctx.stroke();

    /* Top-right corner */
    ctx.beginPath();
    ctx.moveTo(x + w - cornerLen, y);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x + w, y + cornerLen);
    ctx.stroke();

    /* Bottom-right corner */
    ctx.beginPath();
    ctx.moveTo(x + w, y + h - cornerLen);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x + w - cornerLen, y + h);
    ctx.stroke();

    /* Bottom-left corner */
    ctx.beginPath();
    ctx.moveTo(x + cornerLen, y + h);
    ctx.lineTo(x, y + h);
    ctx.lineTo(x, y + h - cornerLen);
    ctx.stroke();
  }

  /**
   * Clear the overlay canvas.
   * @param {HTMLCanvasElement} canvas
   */
  clearOverlay(canvas) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}

/* Export as global singleton */
window.cameraManager = new CameraManager();
