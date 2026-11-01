/* ============================================================
   TriVote — Score Gauge Component
   Horizontal score bar with animated fill and status color
   ============================================================ */

/**
 * ScoreGauge — renders a horizontal score bar with label, value,
 * and animated fill that reflects the score threshold.
 */
class ScoreGauge {
  /**
   * @param {string} containerId - The DOM element ID to render into.
   */
  constructor(containerId) {
    this.containerId = containerId;
    this.container = null;
    this.score = 0;
    this.label = '';
    this.status = 'default';
    this.fillEl = null;
    this.valueEl = null;
  }

  /**
   * Render the gauge DOM.
   */
  render() {
    this.container = document.getElementById(this.containerId);
    if (!this.container) return;

    this.container.innerHTML = '';
    this.container.className = 'score-bar';

    /* Header row: label + value */
    const header = document.createElement('div');
    header.className = 'score-bar__header';

    const labelEl = document.createElement('span');
    labelEl.className = 'score-bar__label';
    labelEl.textContent = this.label || 'Score';
    header.appendChild(labelEl);

    this.valueEl = document.createElement('span');
    this.valueEl.className = 'score-bar__value';
    this.valueEl.textContent = 'N/A';
    header.appendChild(this.valueEl);

    this.container.appendChild(header);

    /* Track + Fill */
    const track = document.createElement('div');
    track.className = 'score-bar__track';

    this.fillEl = document.createElement('div');
    this.fillEl.className = 'score-bar__fill';
    this.fillEl.style.width = '0%';
    track.appendChild(this.fillEl);

    this.container.appendChild(track);
  }

  /**
   * Animate the bar fill from 0 to the given score.
   * @param {number} score - Score value 0 to 100.
   * @param {string} [label] - Optional label text.
   */
  setValue(score, label) {
    this.score = Math.max(0, Math.min(100, score));
    if (label !== undefined) this.label = label;

    if (!this.fillEl || !this.valueEl) {
      this.render();
    }

    /* Update label if provided */
    if (label !== undefined) {
      const labelEl = this.container.querySelector('.score-bar__label');
      if (labelEl) labelEl.textContent = label;
    }

    /* Update value text */
    this.valueEl.textContent = this.score.toFixed(1) + '%';

    /* Auto-determine status based on score */
    if (this.score >= 70) {
      this.setStatus('success');
    } else if (this.score >= 40) {
      this.setStatus('warning');
    } else {
      this.setStatus('error');
    }

    /* Animate fill — use rAF to ensure DOM is ready */
    requestAnimationFrame(() => {
      this.fillEl.style.width = this.score + '%';
    });
  }

  /**
   * Set the color status of the fill bar.
   * @param {'success'|'warning'|'error'|'default'} status
   */
  setStatus(status) {
    this.status = status;

    if (!this.fillEl) return;

    /* Remove existing status classes */
    this.fillEl.classList.remove(
      'score-bar__fill--success',
      'score-bar__fill--warning',
      'score-bar__fill--danger'
    );

    switch (status) {
      case 'success':
        this.fillEl.classList.add('score-bar__fill--success');
        break;
      case 'warning':
        this.fillEl.classList.add('score-bar__fill--warning');
        break;
      case 'error':
        this.fillEl.classList.add('score-bar__fill--danger');
        break;
    }
  }

  /**
   * Reset the gauge to empty/default.
   */
  reset() {
    this.score = 0;
    this.status = 'default';
    if (this.fillEl) this.fillEl.style.width = '0%';
    if (this.valueEl) this.valueEl.textContent = 'N/A';
  }
}

window.ScoreGauge = ScoreGauge;
