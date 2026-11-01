/* ============================================================
   TriVote — Iris Scanner Scene
   High-precision optical eye model with biometric HUD reticle,
   concentric Daugman analysis rings, and polar phase scan
   (Clean transparent background without floating space particles)
   ============================================================ */

import * as THREE from 'three';

/**
 * IrisScene — anatomical eye geometry with procedural hazel-amber iris,
 * dynamic pupil dilation, forensic targeting reticle, and polar scan arm.
 */
class IrisScene {
  constructor(containerId) {
    this.containerId = containerId;
    this.container = null;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.clock = null;
    this.animationId = null;
    this.disposed = false;

    this.eyeGroup = null;
    this.sclera = null;
    this.iris = null;
    this.pupil = null;
    this.corneaGlint = null;
    this.analysisRings = [];
    this.reticleGroup = null;
    this.polarScanArm = null;
    this.pointLight = null;

    this.state = 'idle';
    this.progress = 0;
    this.ringExpansion = 0;
    this.targetRingExpansion = 0;
    this.polarAngle = 0;
    this.polarSpeed = 1.2;
    this.stateColor = new THREE.Color(0x06b6d4);
    this.targetColor = new THREE.Color(0x06b6d4);
  }

  init() {
    this.container = document.getElementById(this.containerId);
    if (!this.container) return;

    const width = this.container.clientWidth;
    const height = this.container.clientHeight || 400;

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 100);
    this.camera.position.set(0, 0, 5.8);
    this.camera.lookAt(0, 0, 0);

    /* Renderer with transparent background */
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x000000, 0);
    this.container.appendChild(this.renderer.domElement);

    this.clock = new THREE.Clock();

    /* ---- Eye Group ---- */
    this.eyeGroup = new THREE.Group();
    this.scene.add(this.eyeGroup);

    /* Sclera (anatomical eyeball) */
    const scleraGeo = new THREE.SphereGeometry(1.3, 64, 64);
    const scleraMat = new THREE.MeshStandardMaterial({
      color: 0xf0f2f5,
      roughness: 0.5,
      metalness: 0.05
    });
    this.sclera = new THREE.Mesh(scleraGeo, scleraMat);
    this.eyeGroup.add(this.sclera);

    /* Iris Disc (detailed procedural texture) */
    const irisTexture = this._createIrisTexture();
    const irisGeo = new THREE.CircleGeometry(0.58, 64);
    const irisMat = new THREE.MeshBasicMaterial({
      map: irisTexture,
      transparent: true
    });
    this.iris = new THREE.Mesh(irisGeo, irisMat);
    this.iris.position.z = 1.285;
    this.eyeGroup.add(this.iris);

    /* Pupil */
    const pupilGeo = new THREE.CircleGeometry(0.19, 48);
    const pupilMat = new THREE.MeshBasicMaterial({ color: 0x05070a });
    this.pupil = new THREE.Mesh(pupilGeo, pupilMat);
    this.pupil.position.z = 1.292;
    this.eyeGroup.add(this.pupil);

    /* Cornea Specular Dome / Highlight (realistic optical glass glint) */
    const corneaGeo = new THREE.SphereGeometry(0.68, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.45);
    const corneaMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      transmission: 0.95,
      opacity: 0.35,
      transparent: true,
      roughness: 0.05,
      metalness: 0.1,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05
    });
    this.corneaGlint = new THREE.Mesh(corneaGeo, corneaMat);
    this.corneaGlint.position.z = 0.95;
    this.eyeGroup.add(this.corneaGlint);

    /* ---- Concentric Analysis Rings (Daugman Rubber-Sheet Coordinates) ---- */
    const ringColors = [0x06b6d4, 0x06b6d4, 0x06b6d4, 0x3b82f6];
    for (let i = 0; i < 4; i++) {
      const inner = 0.55 + i * 0.18;
      const outer = inner + 0.022;
      const ringGeo = new THREE.RingGeometry(inner, outer, 64);
      const ringMat = new THREE.MeshBasicMaterial({
        color: ringColors[i],
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.z = 1.31;
      this.eyeGroup.add(ring);
      this.analysisRings.push(ring);
    }

    /* ---- Biometric Forensic Optical Reticle ---- */
    this._createReticle();

    /* ---- Lighting ---- */
    const ambientLight = new THREE.AmbientLight(0x556677, 0.7);
    this.scene.add(ambientLight);

    const frontLight = new THREE.DirectionalLight(0xffffff, 0.65);
    frontLight.position.set(1.5, 2, 4);
    this.scene.add(frontLight);

    this.pointLight = new THREE.PointLight(0x06b6d4, 0.8, 8);
    this.pointLight.position.set(0, 0, 2.5);
    this.scene.add(this.pointLight);

    this._onResize = this._handleResize.bind(this);
    window.addEventListener('resize', this._onResize);

    this.animate();
  }

  /**
   * Create forensic optical targeting reticle with corner brackets,
   * limbus boundary ring, and rotating polar scan arm.
   */
  _createReticle() {
    this.reticleGroup = new THREE.Group();
    this.reticleGroup.position.z = 1.32;
    this.scene.add(this.reticleGroup);

    /* 1. Limbus circle guide */
    const limbusGeo = new THREE.RingGeometry(0.68, 0.69, 64);
    const limbusMat = new THREE.MeshBasicMaterial({
      color: 0x06b6d4,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const limbusMesh = new THREE.Mesh(limbusGeo, limbusMat);
    this.reticleGroup.add(limbusMesh);

    /* 2. Outer target ring with dash-like feel */
    const outerRingGeo = new THREE.RingGeometry(1.15, 1.16, 64);
    const outerRingMat = new THREE.MeshBasicMaterial({
      color: 0x3b82f6,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const outerMesh = new THREE.Mesh(outerRingGeo, outerRingMat);
    this.reticleGroup.add(outerMesh);

    /* 3. Four corner forensic brackets [ ] */
    const bracketMat = new THREE.LineBasicMaterial({
      color: 0x06b6d4,
      transparent: true,
      opacity: 0.6
    });

    const corners = [
      { x: -1.05, y: 1.05, dx: 0.25, dy: -0.25 },
      { x: 1.05, y: 1.05, dx: -0.25, dy: -0.25 },
      { x: -1.05, y: -1.05, dx: 0.25, dy: 0.25 },
      { x: 1.05, y: -1.05, dx: -0.25, dy: 0.25 }
    ];

    corners.forEach(c => {
      const pts = [
        new THREE.Vector3(c.x, c.y + c.dy, 0),
        new THREE.Vector3(c.x, c.y, 0),
        new THREE.Vector3(c.x + c.dx, c.y, 0)
      ];
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const line = new THREE.Line(geo, bracketMat);
      this.reticleGroup.add(line);
    });

    /* 4. Eight radial ticks */
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const r1 = 0.72;
      const r2 = 0.82;
      const pts = [
        new THREE.Vector3(Math.cos(angle) * r1, Math.sin(angle) * r1, 0),
        new THREE.Vector3(Math.cos(angle) * r2, Math.sin(angle) * r2, 0)
      ];
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const tick = new THREE.Line(geo, bracketMat);
      this.reticleGroup.add(tick);
    }

    /* 5. Polar Scan Arm (Rotating radial laser sweep) */
    const armPts = [
      new THREE.Vector3(0.2, 0, 0),
      new THREE.Vector3(0.68, 0, 0)
    ];
    const armGeo = new THREE.BufferGeometry().setFromPoints(armPts);
    const armMat = new THREE.LineBasicMaterial({
      color: 0x06b6d4,
      linewidth: 2,
      transparent: true,
      opacity: 0.75
    });
    this.polarScanArm = new THREE.Line(armGeo, armMat);
    this.reticleGroup.add(this.polarScanArm);
  }

  _createIrisTexture() {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    const cx = size / 2;
    const cy = size / 2;
    const outerR = size / 2;

    /* Transparent background */
    ctx.clearRect(0, 0, size, size);

    /* Iris gradient rings (rich amber-hazel tone) */
    const gradient = ctx.createRadialGradient(cx, cy, outerR * 0.3, cx, cy, outerR);
    gradient.addColorStop(0, '#150c02');
    gradient.addColorStop(0.18, '#583a15');
    gradient.addColorStop(0.42, '#855d28');
    gradient.addColorStop(0.68, '#c8973b');
    gradient.addColorStop(0.88, '#6c4719');
    gradient.addColorStop(1, '#241505');

    ctx.beginPath();
    ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();

    /* Fine iris radial fibers (collarette crypts) */
    ctx.lineWidth = 0.8;
    for (let i = 0; i < 180; i++) {
      const angle = (i / 180) * Math.PI * 2;
      const innerR = outerR * 0.32 + Math.random() * outerR * 0.08;
      const endR = outerR * (0.84 + Math.random() * 0.16);
      const alpha = 0.15 + (i % 3 === 0 ? 0.2 : 0.05);
      ctx.strokeStyle = `rgba(255, 220, 160, ${alpha})`;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(angle) * innerR, cy + Math.sin(angle) * innerR);
      ctx.lineTo(cx + Math.cos(angle) * endR, cy + Math.sin(angle) * endR);
      ctx.stroke();
    }

    /* Darker contraction furrows */
    for (let i = 0; i < 90; i++) {
      const angle = (i / 90) * Math.PI * 2 + 0.02;
      const innerR = outerR * 0.45;
      const endR = outerR * 0.92;
      ctx.strokeStyle = 'rgba(20, 10, 4, 0.28)';
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(angle) * innerR, cy + Math.sin(angle) * innerR);
      ctx.lineTo(cx + Math.cos(angle) * endR, cy + Math.sin(angle) * endR);
      ctx.stroke();
    }

    /* Pupil mask with soft antialiased edge */
    const pupilGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, outerR * 0.34);
    pupilGrad.addColorStop(0, 'rgba(8, 10, 14, 1)');
    pupilGrad.addColorStop(0.8, 'rgba(8, 10, 14, 0.95)');
    pupilGrad.addColorStop(1, 'rgba(8, 10, 14, 0)');
    ctx.beginPath();
    ctx.arc(cx, cy, outerR * 0.34, 0, Math.PI * 2);
    ctx.fillStyle = pupilGrad;
    ctx.fill();

    const texture = new THREE.CanvasTexture(canvas);
    return texture;
  }

  animate() {
    if (this.disposed) return;

    this.animationId = requestAnimationFrame(() => this.animate());

    const t = this.clock.getElapsedTime();

    /* Smooth color transition */
    this.stateColor.lerp(this.targetColor, 0.06);
    if (this.pointLight) this.pointLight.color.copy(this.stateColor);

    /* Subtle anatomical saccadic eye gaze */
    if (this.eyeGroup) {
      this.eyeGroup.rotation.y = Math.sin(t * 0.35) * 0.04;
      this.eyeGroup.rotation.x = Math.sin(t * 0.28) * 0.025;
    }

    /* Dynamic pupil dilation (light reflex breathing) */
    if (this.pupil) {
      const dilation = 1 + Math.sin(t * 0.9) * 0.08;
      this.pupil.scale.set(dilation, dilation, 1);
    }

    /* Analysis rings expansion and pulsing */
    this.ringExpansion += (this.targetRingExpansion - this.ringExpansion) * 0.05;
    this.analysisRings.forEach((ring, i) => {
      ring.material.color.copy(this.stateColor);
      ring.material.opacity = this.ringExpansion * (0.45 - i * 0.07);
      const pulse = 1 + Math.sin(t * 3.5 + i * 1.4) * 0.04 * this.ringExpansion;
      ring.scale.set(pulse, pulse, 1);
    });

    /* Polar Scan Arm rotation */
    if (this.polarScanArm) {
      this.polarAngle += this.polarSpeed * 0.035;
      this.polarScanArm.rotation.z = this.polarAngle;
      this.polarScanArm.material.color.copy(this.stateColor);
      this.polarScanArm.material.opacity = this.state === 'idle' ? 0.3 : (0.7 + Math.sin(t * 6) * 0.2);
    }

    /* Reticle breathing */
    if (this.reticleGroup) {
      const reticlePulse = 1 + Math.sin(t * 1.5) * 0.008;
      this.reticleGroup.scale.set(reticlePulse, reticlePulse, 1);
    }

    this.renderer.render(this.scene, this.camera);
  }

  /**
   * Set the visual state.
   * @param {'idle'|'scanning'|'analyzing'|'matching'|'success'|'error'} state
   */
  setState(state) {
    this.state = state;

    switch (state) {
      case 'idle':
        this.targetRingExpansion = 0;
        this.polarSpeed = 0.8;
        this.targetColor.set(0x06b6d4);
        if (this.pointLight) this.pointLight.intensity = 0.6;
        break;

      case 'scanning':
        this.targetRingExpansion = 1;
        this.polarSpeed = 3.2;
        this.targetColor.set(0x06b6d4);
        if (this.pointLight) this.pointLight.intensity = 1.3;
        break;

      case 'analyzing':
        this.targetRingExpansion = 1;
        this.polarSpeed = 4.5;
        this.targetColor.set(0x38bdf8);
        if (this.pointLight) this.pointLight.intensity = 1.6;
        break;

      case 'matching':
        this.targetRingExpansion = 0.7;
        this.polarSpeed = 1.5;
        this.targetColor.set(0x3b82f6);
        if (this.pointLight) this.pointLight.intensity = 1.8;
        break;

      case 'success':
        this.targetRingExpansion = 0.5;
        this.polarSpeed = 0.4;
        this.targetColor.set(0x10b981);
        if (this.pointLight) this.pointLight.intensity = 2.0;
        this.analysisRings.forEach(ring => ring.material.color.set(0x10b981));
        break;

      case 'error':
        this.targetRingExpansion = 0.3;
        this.polarSpeed = 0.2;
        this.targetColor.set(0xef4444);
        if (this.pointLight) this.pointLight.intensity = 2.0;
        if (this.container) {
          this.container.classList.add('animate-shake');
          setTimeout(() => {
            if (this.container) this.container.classList.remove('animate-shake');
          }, 500);
        }
        break;
    }
  }

  /**
   * Set progress for UI sync.
   * @param {number} value - Progress 0 to 1.
   */
  setProgress(value) {
    this.progress = Math.max(0, Math.min(1, value));

    /* Map progress to ring reveal */
    const ringCount = this.analysisRings.length;
    this.analysisRings.forEach((ring, i) => {
      const threshold = i / ringCount;
      const visible = this.progress > threshold;
      ring.material.opacity = visible ? 0.45 : 0;
    });
  }

  _handleResize() {
    if (!this.container || this.disposed) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight || 400;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  dispose() {
    this.disposed = true;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    window.removeEventListener('resize', this._onResize);

    if (this.scene) {
      this.scene.traverse((child) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (child.material.map) child.material.map.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach(m => m.dispose());
          } else {
            child.material.dispose();
          }
        }
      });
    }

    if (this.renderer) {
      this.renderer.dispose();
      if (this.renderer.domElement && this.renderer.domElement.parentNode) {
        this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
      }
    }

    this.scene = null;
    this.camera = null;
    this.renderer = null;
  }
}

window.IrisScene = IrisScene;
export { IrisScene };
