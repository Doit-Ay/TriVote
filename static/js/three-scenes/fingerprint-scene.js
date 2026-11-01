/* ============================================================
   TriVote — Fingerprint Scanner Scene
   High-precision optical/capacitive biometric sensor visualization
   with authentic papillary ridges, dual-layer laser scan beam,
   trailing holographic fan, ultrasonic radar pulse, and
   interactive minutiae locking markers.
   (Clean transparent background without floating space particles)
   ============================================================ */

import * as THREE from 'three';

/**
 * FingerprintScene — high-fidelity 3D biometric sensor with realistic
 * metallic bezel, optical glass platen, high-resolution friction ridges,
 * trailing laser sweep, dynamic minutiae markers, and zero space particles.
 */
class FingerprintScene {
  constructor(containerId) {
    this.containerId = containerId;
    this.container = null;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.clock = null;
    this.animationId = null;
    this.disposed = false;

    /* Mesh references */
    this.sensorGroup = null;
    this.sensorChassis = null;
    this.platenGlass = null;
    this.neonRing = null;
    this.laserCore = null;
    this.laserFan = null;
    this.laserLight = null;
    this.radarPulse = null;
    this.minutiaeNodes = [];
    this.reticleGroup = null;

    /* State variables */
    this.state = 'idle'; /* idle | scanning | success | error */
    this.stateColor = new THREE.Color(0x06b6d4);
    this.targetColor = new THREE.Color(0x06b6d4);
    this.scanSpeed = 1.0;
    this.laserZ = 0;
    this.lastLaserZ = 0;
    this.laserDirection = 1;
    this.radarScale = 0.1;
    this.radarAlpha = 0.0;
  }

  init() {
    this.container = document.getElementById(this.containerId);
    if (!this.container) return;

    const width = this.container.clientWidth;
    const height = this.container.clientHeight || 400;

    /* Scene */
    this.scene = new THREE.Scene();

    /* Perspective Camera angled down onto platen */
    this.camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
    this.camera.position.set(0, 3.4, 4.2);
    this.camera.lookAt(0, 0, 0);

    /* Renderer with transparent background */
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x000000, 0);
    this.container.appendChild(this.renderer.domElement);

    this.clock = new THREE.Clock();

    /* ---- Master Sensor Group ---- */
    this.sensorGroup = new THREE.Group();
    this.scene.add(this.sensorGroup);

    /* 1. Sensor Chassis (Dark titanium brushed bezel) */
    const chassisGeo = new THREE.CylinderGeometry(1.64, 1.72, 0.14, 64);
    const chassisMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      metalness: 0.88,
      roughness: 0.22
    });
    this.sensorChassis = new THREE.Mesh(chassisGeo, chassisMat);
    this.sensorChassis.position.y = -0.07;
    this.sensorGroup.add(this.sensorChassis);

    /* 2. LED Perimeter Light Guide (Torus) */
    const ringGeo = new THREE.TorusGeometry(1.56, 0.024, 16, 80);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x06b6d4,
      transparent: true,
      opacity: 0.85
    });
    this.neonRing = new THREE.Mesh(ringGeo, ringMat);
    this.neonRing.rotation.x = Math.PI / 2;
    this.neonRing.position.y = 0.015;
    this.sensorGroup.add(this.neonRing);

    /* 3. Optical Glass Platen with Papillary Ridge Texture */
    const platenGeo = new THREE.CylinderGeometry(1.48, 1.48, 0.04, 64);
    const fingerprintTexture = this._createFingerprintTexture();
    const platenMat = new THREE.MeshStandardMaterial({
      map: fingerprintTexture,
      color: 0x111c33,
      metalness: 0.4,
      roughness: 0.15,
      emissive: 0x06b6d4,
      emissiveIntensity: 0.08
    });
    this.platenGlass = new THREE.Mesh(platenGeo, platenMat);
    this.platenGlass.position.y = 0.01;
    this.sensorGroup.add(this.platenGlass);

    /* 4. Forensic Platen Corner Tick Reticles */
    this._createPlatenReticles();

    /* 5. Minutiae Marker Nodes in 3D */
    this._createMinutiaeNodes();

    /* 6. Ultrasonic Radar Pulse Ring */
    const radarGeo = new THREE.RingGeometry(0.1, 0.14, 64);
    const radarMat = new THREE.MeshBasicMaterial({
      color: 0x06b6d4,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    this.radarPulse = new THREE.Mesh(radarGeo, radarMat);
    this.radarPulse.rotation.x = Math.PI / 2;
    this.radarPulse.position.y = 0.038;
    this.sensorGroup.add(this.radarPulse);

    /* 7. Dual-Layer Laser Sweep: Core Beam */
    const beamGeo = new THREE.PlaneGeometry(2.7, 0.035);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0x06b6d4,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    this.laserCore = new THREE.Mesh(beamGeo, beamMat);
    this.laserCore.position.y = 0.045;
    this.laserCore.rotation.x = Math.PI / 2;
    this.sensorGroup.add(this.laserCore);

    /* 8. Trailing Laser Holographic Fan */
    const fanGeo = new THREE.PlaneGeometry(2.7, 0.45);
    const fanMat = new THREE.MeshBasicMaterial({
      color: 0x06b6d4,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    this.laserFan = new THREE.Mesh(fanGeo, fanMat);
    this.laserFan.position.y = 0.042;
    this.laserFan.rotation.x = Math.PI / 2;
    this.sensorGroup.add(this.laserFan);

    /* 9. Dynamic Laser Reflection Light */
    this.laserLight = new THREE.PointLight(0x06b6d4, 1.2, 3);
    this.laserLight.position.set(0, 0.25, 0);
    this.sensorGroup.add(this.laserLight);

    /* ---- Lighting ---- */
    const ambientLight = new THREE.AmbientLight(0x384a60, 0.6);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.5);
    dirLight.position.set(2.5, 4.5, 2.5);
    this.scene.add(dirLight);

    /* Resize Listener */
    this._onResize = this._handleResize.bind(this);
    window.addEventListener('resize', this._onResize);

    this.animate();
  }

  /**
   * Create 3D Corner Alignment Ticks around platen.
   */
  _createPlatenReticles() {
    this.reticleGroup = new THREE.Group();
    this.reticleGroup.position.y = 0.035;

    const lineMat = new THREE.LineBasicMaterial({
      color: 0x06b6d4,
      transparent: true,
      opacity: 0.4
    });

    const corners = [
      { x: -1.05, z: -1.05, dx: 0.2, dz: 0.2 },
      { x: 1.05, z: -1.05, dx: -0.2, dz: 0.2 },
      { x: -1.05, z: 1.05, dx: 0.2, dz: -0.2 },
      { x: 1.05, z: 1.05, dx: -0.2, dz: -0.2 }
    ];

    corners.forEach(c => {
      const pts = [
        new THREE.Vector3(c.x, 0, c.z + c.dz),
        new THREE.Vector3(c.x, 0, c.z),
        new THREE.Vector3(c.x + c.dx, 0, c.z)
      ];
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const line = new THREE.Line(geo, lineMat);
      this.reticleGroup.add(line);
    });

    this.sensorGroup.add(this.reticleGroup);
  }

  /**
   * Create interactive 3D Minutiae Nodes that lock as the laser sweeps past.
   */
  _createMinutiaeNodes() {
    /* Coordinates matching real friction ridge bifurcations and endings */
    const coords = [
      { x: -0.42, z: -0.65 },
      { x: 0.35, z: -0.58 },
      { x: -0.68, z: -0.25 },
      { x: 0.55, z: -0.15 },
      { x: -0.15, z: -0.32 },
      { x: 0.22, z: -0.05 },
      { x: -0.52, z: 0.20 },
      { x: 0.48, z: 0.30 },
      { x: -0.18, z: 0.45 },
      { x: 0.25, z: 0.58 },
      { x: -0.60, z: 0.65 },
      { x: 0.62, z: 0.70 },
      { x: -0.05, z: 0.05 },
      { x: 0.05, z: -0.75 }
    ];

    const ringGeo = new THREE.RingGeometry(0.025, 0.045, 16);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x06b6d4,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
      depthWrite: false
    });

    coords.forEach(coord => {
      const mesh = new THREE.Mesh(ringGeo.clone(), ringMat.clone());
      mesh.rotation.x = Math.PI / 2;
      mesh.position.set(coord.x, 0.036, coord.z);
      this.sensorGroup.add(mesh);

      this.minutiaeNodes.push({
        mesh: mesh,
        x: coord.x,
        z: coord.z,
        locked: false,
        pulseTime: 0
      });
    });
  }

  /**
   * Generate an authentic high-resolution papillary ridge fingerprint texture
   * on a 1024x1024 canvas with natural whorls, deltas, and minutiae markers.
   */
  _createFingerprintTexture() {
    const size = 1024;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    const cx = size / 2;
    const cy = size / 2;

    /* Base platen glass surface background */
    ctx.fillStyle = '#0a1224';
    ctx.fillRect(0, 0, size, size);

    /* Subtle radial platen depth gradient */
    const bgGrad = ctx.createRadialGradient(cx, cy, 60, cx, cy, size * 0.46);
    bgGrad.addColorStop(0, '#101e38');
    bgGrad.addColorStop(0.75, '#0b1325');
    bgGrad.addColorStop(1, '#060a14');
    ctx.fillStyle = bgGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.46, 0, Math.PI * 2);
    ctx.fill();

    /* Fingertip silhouette clipping area */
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, cy + 20, 310, 390, 0, 0, Math.PI * 2);
    ctx.clip();

    /* 1. Core friction ridges (Whorl and converging loops) */
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    /* Central Whorl Spiral */
    for (let r = 18; r < 360; r += 11) {
      ctx.beginPath();
      const alpha = Math.max(0.2, 0.85 - (r / 360) * 0.4);
      ctx.strokeStyle = `rgba(6, 182, 212, ${alpha})`;

      /* Realistic dermatoglyphic ridge perturbation */
      for (let theta = 0; theta <= Math.PI * 2 + 0.1; theta += 0.08) {
        const wobble = Math.sin(theta * 3 + r * 0.12) * 5 + Math.cos(theta * 2) * 3;
        const radiusX = r + wobble;
        const radiusY = r * 1.35 + Math.sin(theta) * 8;
        const px = cx + Math.cos(theta) * radiusX;
        const py = cy + 40 + Math.sin(theta) * radiusY;
        if (theta === 0) {
          ctx.moveTo(px, py);
        } else {
          ctx.lineTo(px, py);
        }
      }
      ctx.stroke();
    }

    /* 2. Distal Arches (Top region towards fingertip) */
    for (let i = 0; i < 22; i++) {
      ctx.beginPath();
      const archY = cy - 40 - i * 14;
      const radius = 90 + i * 16;
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.45)';
      ctx.arc(cx, archY + radius * 0.4, radius, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
    }

    /* 3. Basal Delta Convergences (Bottom left & right) */
    for (let d = 0; d < 12; d++) {
      /* Left delta */
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.35)';
      ctx.moveTo(cx - 240, cy + 180 + d * 10);
      ctx.quadraticCurveTo(cx - 150, cy + 120 + d * 8, cx - 80, cy + 240 + d * 10);
      ctx.stroke();

      /* Right delta */
      ctx.beginPath();
      ctx.moveTo(cx + 240, cy + 180 + d * 10);
      ctx.quadraticCurveTo(cx + 150, cy + 120 + d * 8, cx + 80, cy + 240 + d * 10);
      ctx.stroke();
    }

    /* 4. Forensic Minutiae Callouts (circles + leader ticks) */
    const minutiaePoints = [
      { x: cx - 110, y: cy - 140, tag: 'B-04' },
      { x: cx + 95, y: cy - 120, tag: 'E-09' },
      { x: cx - 180, y: cy - 40, tag: 'B-02' },
      { x: cx + 150, y: cy - 25, tag: 'E-03' },
      { x: cx - 40, y: cy - 70, tag: 'C-01' },
      { x: cx + 60, y: cy + 10, tag: 'B-07' },
      { x: cx - 140, y: cy + 60, tag: 'E-11' },
      { x: cx + 130, y: cy + 85, tag: 'B-14' },
      { x: cx - 50, y: cy + 130, tag: 'E-06' },
      { x: cx + 70, y: cy + 160, tag: 'B-15' },
      { x: cx - 160, y: cy + 180, tag: 'D-01' },
      { x: cx + 170, y: cy + 195, tag: 'D-02' }
    ];

    ctx.font = '11px "JetBrains Mono", monospace';
    ctx.textBaseline = 'middle';

    minutiaePoints.forEach(pt => {
      /* Small target ring */
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.75)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 8, 0, Math.PI * 2);
      ctx.stroke();

      /* Center point */
      ctx.fillStyle = 'rgba(56, 189, 248, 0.9)';
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 2, 0, Math.PI * 2);
      ctx.fill();

      /* Leader tick & text */
      ctx.beginPath();
      ctx.moveTo(pt.x + 9, pt.y);
      ctx.lineTo(pt.x + 22, pt.y);
      ctx.stroke();

      ctx.fillStyle = 'rgba(56, 189, 248, 0.8)';
      ctx.fillText(pt.tag, pt.x + 26, pt.y);
    });

    ctx.restore();

    /* Forensic Core Crosshair */
    ctx.strokeStyle = 'rgba(6, 182, 212, 0.4)';
    ctx.lineWidth = 1.0;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(cx - 30, cy + 30);
    ctx.lineTo(cx + 30, cy + 30);
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx, cy + 60);
    ctx.stroke();
    ctx.setLineDash([]);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    return texture;
  }

  animate() {
    if (this.disposed) return;

    this.animationId = requestAnimationFrame(() => this.animate());

    const t = this.clock.getElapsedTime();

    /* Smooth color transition */
    this.stateColor.lerp(this.targetColor, 0.06);
    if (this.neonRing) this.neonRing.material.color.copy(this.stateColor);
    if (this.laserCore) this.laserCore.material.color.copy(this.stateColor);
    if (this.laserFan) this.laserFan.material.color.copy(this.stateColor);
    if (this.laserLight) this.laserLight.color.copy(this.stateColor);
    if (this.radarPulse) this.radarPulse.material.color.copy(this.stateColor);

    /* 1. Laser Beam Sweep & Trailing Fan Dynamics */
    this.lastLaserZ = this.laserZ;
    this.laserZ = Math.sin(t * this.scanSpeed * 2.2) * 1.15;
    this.laserDirection = (this.laserZ - this.lastLaserZ) >= 0 ? 1 : -1;

    if (this.laserCore) {
      this.laserCore.position.z = this.laserZ;
      this.laserCore.material.opacity = this.state === 'idle' ? 0.6 : (0.8 + Math.sin(t * 8) * 0.15);
    }

    if (this.laserFan) {
      /* Fan trails behind the movement vector */
      const trailOffset = -this.laserDirection * 0.22;
      this.laserFan.position.z = this.laserZ + trailOffset;
      this.laserFan.material.opacity = this.state === 'idle' ? 0.15 : (0.35 + Math.sin(t * 5) * 0.1);
    }

    if (this.laserLight) {
      this.laserLight.position.z = this.laserZ;
      this.laserLight.intensity = this.state === 'idle' ? 0.6 : 1.5;
    }

    /* 2. Ultrasonic Radar Wave (Expanding concentric pulse) */
    if (this.radarPulse) {
      if (this.state === 'scanning') {
        this.radarScale += 0.022;
        if (this.radarScale > 1.45) {
          this.radarScale = 0.1;
        }
        this.radarAlpha = Math.max(0, 0.75 - (this.radarScale / 1.45));
        this.radarPulse.scale.set(this.radarScale, this.radarScale, 1);
        this.radarPulse.material.opacity = this.radarAlpha;
      } else {
        this.radarPulse.material.opacity = 0;
      }
    }

    /* 3. Minutiae Node Lock Dynamics */
    this.minutiaeNodes.forEach(node => {
      /* If laser is sweeping over this node's Z coordinate */
      const distZ = Math.abs(this.laserZ - node.z);
      if (distZ < 0.14) {
        node.locked = true;
        node.pulseTime = 1.0;
      }

      if (node.pulseTime > 0) {
        node.pulseTime -= 0.02;
      }

      if (this.state === 'success') {
        node.mesh.material.color.set(0x10b981);
        node.mesh.material.opacity = 0.9;
        const successPulse = 1 + Math.sin(t * 4) * 0.15;
        node.mesh.scale.set(successPulse, successPulse, 1);
      } else if (this.state === 'error') {
        node.mesh.material.color.set(0xef4444);
        node.mesh.material.opacity = 0.8;
      } else if (node.locked && this.state === 'scanning') {
        node.mesh.material.color.copy(this.stateColor);
        node.mesh.material.opacity = 0.4 + node.pulseTime * 0.55;
        const pulse = 1 + node.pulseTime * 0.4;
        node.mesh.scale.set(pulse, pulse, 1);
      } else {
        node.mesh.material.color.copy(this.stateColor);
        node.mesh.material.opacity = 0.2;
        node.mesh.scale.set(1, 1, 1);
      }
    });

    /* 4. Neon Ring Subtle Breathing */
    if (this.neonRing) {
      const breath = 0.5 + Math.sin(t * 2.5) * 0.25;
      this.neonRing.material.opacity = breath;
    }

    /* 5. Platen Glass Gentle Breathing Rotation */
    if (this.sensorGroup) {
      this.sensorGroup.rotation.y = Math.sin(t * 0.25) * 0.035;
    }

    this.renderer.render(this.scene, this.camera);
  }

  /**
   * Set the visual state of the scanner.
   * @param {'idle'|'scanning'|'success'|'error'} state
   */
  setState(state) {
    this.state = state;

    switch (state) {
      case 'idle':
        this.targetColor.set(0x06b6d4);
        this.scanSpeed = 0.8;
        if (this.platenGlass) {
          this.platenGlass.material.emissive.set(0x06b6d4);
          this.platenGlass.material.emissiveIntensity = 0.06;
        }
        /* Reset minutiae lock */
        this.minutiaeNodes.forEach(n => { n.locked = false; n.pulseTime = 0; });
        break;

      case 'scanning':
        this.targetColor.set(0x22d3ee);
        this.scanSpeed = 2.4;
        if (this.platenGlass) {
          this.platenGlass.material.emissive.set(0x22d3ee);
          this.platenGlass.material.emissiveIntensity = 0.16;
        }
        break;

      case 'success':
        this.targetColor.set(0x10b981);
        this.scanSpeed = 0.4;
        if (this.platenGlass) {
          this.platenGlass.material.emissive.set(0x10b981);
          this.platenGlass.material.emissiveIntensity = 0.25;
        }
        this.minutiaeNodes.forEach(n => {
          n.locked = true;
          n.mesh.material.color.set(0x10b981);
        });
        break;

      case 'error':
        this.targetColor.set(0xef4444);
        this.scanSpeed = 0.3;
        if (this.platenGlass) {
          this.platenGlass.material.emissive.set(0xef4444);
          this.platenGlass.material.emissiveIntensity = 0.25;
        }
        this.minutiaeNodes.forEach(n => {
          n.mesh.material.color.set(0xef4444);
        });
        /* Shake effect on container */
        if (this.container) {
          this.container.classList.add('animate-shake');
          setTimeout(() => {
            if (this.container) this.container.classList.remove('animate-shake');
          }, 500);
        }
        break;
    }
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
    this.minutiaeNodes = [];
  }
}

window.FingerprintScene = FingerprintScene;
export { FingerprintScene };
