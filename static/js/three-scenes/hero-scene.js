/* ============================================================
   TriVote — Hero Scene (Home Screen)
   Slowly rotating wireframe icosahedron with particle field
   ============================================================ */

import * as THREE from 'three';
import { createParticleField, animateParticles } from './particles.js';

/**
 * HeroScene — atmospheric wireframe shield with floating particles
 * for the home screen. Auto-animated, no user interaction.
 */
class HeroScene {
  constructor(containerId) {
    this.containerId = containerId;
    this.container = null;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.clock = null;
    this.animationId = null;
    this.icosahedron = null;
    this.innerIco = null;
    this.particles = null;
    this.disposed = false;
  }

  init() {
    this.container = document.getElementById(this.containerId);
    if (!this.container) return;

    const width = this.container.clientWidth;
    const height = this.container.clientHeight || 320;

    /* Scene */
    this.scene = new THREE.Scene();

    /* Camera */
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    this.camera.position.set(0, 0, 6);

    /* Renderer */
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x000000, 0);
    this.container.appendChild(this.renderer.domElement);

    /* Clock */
    this.clock = new THREE.Clock();

    /* Wireframe Icosahedron (outer) */
    const icoGeo = new THREE.IcosahedronGeometry(1.6, 1);
    const icoMat = new THREE.MeshBasicMaterial({
      color: 0x3b82f6,
      wireframe: true,
      transparent: true,
      opacity: 0.35
    });
    this.icosahedron = new THREE.Mesh(icoGeo, icoMat);
    this.scene.add(this.icosahedron);

    /* Inner Icosahedron (slightly smaller, different shade) */
    const innerGeo = new THREE.IcosahedronGeometry(1.1, 0);
    const innerMat = new THREE.MeshBasicMaterial({
      color: 0x1e40af,
      wireframe: true,
      transparent: true,
      opacity: 0.2
    });
    this.innerIco = new THREE.Mesh(innerGeo, innerMat);
    this.scene.add(this.innerIco);

    /* Particle Field */
    this.particles = createParticleField(200, 8, 0x3b82f6, 0.02);
    this.scene.add(this.particles);

    /* Ambient Point Lights */
    const light1 = new THREE.PointLight(0x3b82f6, 0.8, 20);
    light1.position.set(3, 2, 4);
    this.scene.add(light1);

    const light2 = new THREE.PointLight(0x1e40af, 0.4, 15);
    light2.position.set(-3, -2, 3);
    this.scene.add(light2);

    /* Handle resize */
    this._onResize = this._handleResize.bind(this);
    window.addEventListener('resize', this._onResize);

    /* Start animation */
    this.animate();
  }

  animate() {
    if (this.disposed) return;

    this.animationId = requestAnimationFrame(() => this.animate());

    const t = this.clock.getElapsedTime();

    /* Rotate icosahedrons */
    if (this.icosahedron) {
      this.icosahedron.rotation.x = t * 0.08;
      this.icosahedron.rotation.y = t * 0.12;
      /* Sinusoidal float */
      this.icosahedron.position.y = Math.sin(t * 0.5) * 0.15;
    }

    if (this.innerIco) {
      this.innerIco.rotation.x = -t * 0.1;
      this.innerIco.rotation.y = -t * 0.15;
      this.innerIco.position.y = Math.sin(t * 0.5) * 0.15;
    }

    /* Animate particles */
    if (this.particles) {
      animateParticles(this.particles, t, 0.5);
      this.particles.rotation.y = t * 0.02;
    }

    this.renderer.render(this.scene, this.camera);
  }

  _handleResize() {
    if (!this.container || this.disposed) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight || 320;
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

/* Expose globally */
window.HeroScene = HeroScene;
export { HeroScene };
