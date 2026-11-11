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
    this.fingerprintMesh = null;
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

    /* 3. Optical Glass Platen */
    const platenGeo = new THREE.CylinderGeometry(1.48, 1.48, 0.04, 64);
    const platenMat = new THREE.MeshStandardMaterial({
      color: 0x07111e,
      metalness: 0.85,
      roughness: 0.18,
      emissive: 0x020b16,
      emissiveIntensity: 0.25
    });
    this.platenGlass = new THREE.Mesh(platenGeo, platenMat);
    this.platenGlass.position.y = 0.01;
    this.sensorGroup.add(this.platenGlass);

    /* 3b. Authentic High-Resolution Papillary Ridge Decal */
    const fpLoader = new THREE.TextureLoader();
    const fpTexture = fpLoader.load('/static/images/fingerprint-pattern.png', (tex) => {
      tex.needsUpdate = true;
      if (this.renderer && this.scene && this.camera) {
        this.renderer.render(this.scene, this.camera);
      }
    });
    fpTexture.wrapS = THREE.ClampToEdgeWrapping;
    fpTexture.wrapT = THREE.ClampToEdgeWrapping;
    fpTexture.generateMipmaps = true;
    fpTexture.minFilter = THREE.LinearMipmapLinearFilter;

    const fpGeo = new THREE.PlaneGeometry(2.2, 2.2);
    const fpMat = new THREE.MeshBasicMaterial({
      map: fpTexture,
      transparent: true,
      opacity: 0.9,
      color: 0x06b6d4,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    this.fingerprintMesh = new THREE.Mesh(fpGeo, fpMat);
    this.fingerprintMesh.rotation.x = -Math.PI / 2;
    this.fingerprintMesh.position.y = 0.032;
    this.sensorGroup.add(this.fingerprintMesh);

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

    /* Update authentic fingerprint decal */
    if (this.fingerprintMesh && this.fingerprintMesh.material) {
      this.fingerprintMesh.material.color.copy(this.stateColor);
      if (this.state === 'scanning') {
        this.fingerprintMesh.material.opacity = 0.85 + Math.sin(t * 6) * 0.12;
      } else if (this.state === 'success') {
        this.fingerprintMesh.material.opacity = 1.0;
      } else if (this.state === 'error') {
        this.fingerprintMesh.material.opacity = 0.95;
      } else {
        this.fingerprintMesh.material.opacity = 0.85;
      }
    }
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
          this.platenGlass.material.emissive.set(0x020b16);
          this.platenGlass.material.emissiveIntensity = 0.25;
        }
        if (this.fingerprintMesh) this.fingerprintMesh.material.color.set(0x06b6d4);
        /* Reset minutiae lock */
        this.minutiaeNodes.forEach(n => { n.locked = false; n.pulseTime = 0; });
        break;

      case 'scanning':
        this.targetColor.set(0x22d3ee);
        this.scanSpeed = 2.4;
        if (this.platenGlass) {
          this.platenGlass.material.emissive.set(0x041926);
          this.platenGlass.material.emissiveIntensity = 0.35;
        }
        if (this.fingerprintMesh) this.fingerprintMesh.material.color.set(0x22d3ee);
        break;

      case 'success':
        this.targetColor.set(0x10b981);
        this.scanSpeed = 0.4;
        if (this.platenGlass) {
          this.platenGlass.material.emissive.set(0x062818);
          this.platenGlass.material.emissiveIntensity = 0.4;
        }
        if (this.fingerprintMesh) this.fingerprintMesh.material.color.set(0x10b981);
        this.minutiaeNodes.forEach(n => {
          n.locked = true;
          n.mesh.material.color.set(0x10b981);
        });
        break;

      case 'error':
        this.targetColor.set(0xef4444);
        this.scanSpeed = 0.3;
        if (this.platenGlass) {
          this.platenGlass.material.emissive.set(0x2a0808);
          this.platenGlass.material.emissiveIntensity = 0.4;
        }
        if (this.fingerprintMesh) this.fingerprintMesh.material.color.set(0xef4444);
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

    if (this.fingerprintMesh) {
      if (this.fingerprintMesh.geometry) this.fingerprintMesh.geometry.dispose();
      if (this.fingerprintMesh.material) {
        if (this.fingerprintMesh.material.map) this.fingerprintMesh.material.map.dispose();
        this.fingerprintMesh.material.dispose();
      }
      this.fingerprintMesh = null;
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
