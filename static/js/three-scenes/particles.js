/* ============================================================
   TriVote — Shared Particle System Utilities
   Reusable Three.js particle field creation and animation
   ============================================================ */

import * as THREE from 'three';

/**
 * Create a field of floating particles.
 * @param {number} count - Number of particles.
 * @param {number} spread - Spatial spread (cube half-extent).
 * @param {string|number} color - Particle color (hex).
 * @param {number} size - Particle size.
 * @returns {THREE.Points} The particle system.
 */
export function createParticleField(count, spread, color, size) {
  const positions = new Float32Array(count * 3);
  const velocities = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    positions[i3]     = (Math.random() - 0.5) * spread;
    positions[i3 + 1] = (Math.random() - 0.5) * spread;
    positions[i3 + 2] = (Math.random() - 0.5) * spread;

    velocities[i3]     = (Math.random() - 0.5) * 0.002;
    velocities[i3 + 1] = (Math.random() - 0.5) * 0.002;
    velocities[i3 + 2] = (Math.random() - 0.5) * 0.002;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.userData = { velocities: velocities };

  const material = new THREE.PointsMaterial({
    color: new THREE.Color(color),
    size: size,
    transparent: true,
    opacity: 0.6,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true
  });

  return new THREE.Points(geometry, material);
}

/**
 * Animate particles: drift and loop within bounds.
 * @param {THREE.Points} particles - The particle system to animate.
 * @param {number} time - Elapsed time (from clock.getElapsedTime).
 * @param {number} speed - Animation speed multiplier.
 */
export function animateParticles(particles, time, speed) {
  const positions = particles.geometry.attributes.position.array;
  const velocities = particles.geometry.userData.velocities;
  const count = positions.length / 3;
  const spread = 5;
  const s = speed || 1;

  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    positions[i3]     += velocities[i3] * s;
    positions[i3 + 1] += velocities[i3 + 1] * s;
    positions[i3 + 2] += velocities[i3 + 2] * s;

    /* Wrap around bounds */
    for (let j = 0; j < 3; j++) {
      if (positions[i3 + j] > spread) positions[i3 + j] = -spread;
      if (positions[i3 + j] < -spread) positions[i3 + j] = spread;
    }
  }

  particles.geometry.attributes.position.needsUpdate = true;
}
