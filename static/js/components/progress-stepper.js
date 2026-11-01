/* ============================================================
   TriVote — Progress Stepper Component
   Horizontal step indicator with connecting lines
   ============================================================ */

/**
 * SVG check icon markup (no emoji).
 */
const CHECK_SVG = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';

/**
 * SVG X icon markup.
 */
const X_SVG = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';

/**
 * ProgressStepper — a reusable horizontal progress stepper.
 */
class ProgressStepper {
  /**
   * @param {string} containerId - The DOM element ID to render into.
   * @param {Array<string>} steps - Array of step label strings.
   */
  constructor(containerId, steps) {
    this.containerId = containerId;
    this.steps = steps;
    this.activeIndex = 0;
    this.completedSteps = new Set();
    this.errorSteps = new Set();
    this.container = null;
  }

  /**
   * Render the stepper DOM elements.
   */
  render() {
    this.container = document.getElementById(this.containerId);
    if (!this.container) return;

    this.container.innerHTML = '';
    this.container.className = 'progress-stepper';

    this.steps.forEach((label, i) => {
      /* Step wrapper (circle + optional line) */
      const stepEl = document.createElement('div');
      stepEl.className = 'progress-stepper__step';

      /* Circle */
      const circleEl = document.createElement('div');
      circleEl.className = 'progress-stepper__circle';
      circleEl.setAttribute('data-step-index', i);
      circleEl.style.position = 'relative';

      /* Determine state */
      if (this.errorSteps.has(i)) {
        circleEl.classList.add('progress-stepper__circle--error');
        circleEl.innerHTML = X_SVG;
      } else if (this.completedSteps.has(i)) {
        circleEl.classList.add('progress-stepper__circle--completed');
        circleEl.innerHTML = CHECK_SVG;
      } else if (i === this.activeIndex) {
        circleEl.classList.add('progress-stepper__circle--active');
        circleEl.textContent = String(i + 1);
      } else {
        circleEl.textContent = String(i + 1);
      }

      /* Label (below circle) */
      const labelEl = document.createElement('span');
      labelEl.className = 'progress-stepper__label';
      labelEl.textContent = label;
      circleEl.appendChild(labelEl);

      stepEl.appendChild(circleEl);

      /* Connecting line (between steps, not after last) */
      if (i < this.steps.length - 1) {
        const lineEl = document.createElement('div');
        lineEl.className = 'progress-stepper__line';
        if (this.completedSteps.has(i)) {
          lineEl.classList.add('progress-stepper__line--completed');
        }
        stepEl.appendChild(lineEl);
      }

      this.container.appendChild(stepEl);
    });
  }

  /**
   * Set the active step index and re-render.
   * @param {number} index
   */
  setActiveStep(index) {
    this.activeIndex = index;
    this.render();
  }

  /**
   * Mark a step as completed and re-render.
   * @param {number} index
   */
  markCompleted(index) {
    this.completedSteps.add(index);
    this.errorSteps.delete(index);
    this.render();
  }

  /**
   * Mark a step as errored and re-render.
   * @param {number} index
   */
  markError(index) {
    this.errorSteps.add(index);
    this.completedSteps.delete(index);
    this.render();
  }

  /**
   * Reset all steps to default state.
   */
  reset() {
    this.activeIndex = 0;
    this.completedSteps.clear();
    this.errorSteps.clear();
    this.render();
  }
}

window.ProgressStepper = ProgressStepper;
