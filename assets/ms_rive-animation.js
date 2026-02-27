if (!customElements.get('rive-animation')) {
  class RiveAnimation extends HTMLElement {
    constructor() {
      super();
      this.riveInstance = null;
      this.observer = null;
      this.resizeHandler = null;
      this.mouseHandler = null;
      this.touchHandler = null;
      this.prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    }

    connectedCallback() {
      this.setupLazyLoading();
    }

    disconnectedCallback() {
      this.cleanup();
    }

    setupLazyLoading() {
      this.observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              this.loadRive();
              this.observer.disconnect();
            }
          });
        },
        { rootMargin: '200px', threshold: 0 }
      );
      this.observer.observe(this);
    }

    async loadRive() {
      const src = this.dataset.src;
      if (!src) {
        console.warn('Rive Animation: nessun src fornito');
        return;
      }
      if (typeof rive === 'undefined') {
        await this.loadRiveScript();
      }
      this.initRive();
    }

    loadRiveScript() {
      return new Promise((resolve, reject) => {
        if (typeof rive !== 'undefined') { resolve(); return; }
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/@rive-app/canvas@2.24.0';
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
    }

    initRive() {
      const canvas = this.querySelector('canvas');
      if (!canvas) { console.warn('Rive Animation: canvas non trovato'); return; }

      const container = canvas.parentElement;
      if (container) {
        const rect = container.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
      }

      const src = this.dataset.src;
      const stateMachine = this.dataset.stateMachine || '';
      const autoplay = this.dataset.autoplay === 'true';
      const shouldAutoplay = autoplay && !this.prefersReducedMotion.matches;

      const riveOptions = {
        src: src,
        canvas: canvas,
        autoplay: shouldAutoplay,
        onLoad: () => {
          this.riveInstance.resizeDrawingSurfaceToCanvas();
          this.setupResizeHandler();
          this.setupMouseTracking();
          this.executeCustomJS();
          if (this.prefersReducedMotion.matches && autoplay) {
            this.riveInstance.pause();
          }
        },
        onLoadError: (error) => {
          console.error('Rive Animation: errore caricamento', error);
        },
      };

      if (stateMachine && stateMachine.trim() !== '') {
        riveOptions.stateMachines = stateMachine;
      }

      this.riveInstance = new rive.Rive(riveOptions);

      this.prefersReducedMotion.addEventListener('change', (e) => {
        if (!this.riveInstance) return;
        if (e.matches) { this.riveInstance.pause(); }
        else if (autoplay) { this.riveInstance.play(); }
      });
    }

    setupMouseTracking() {
      if (!this.riveInstance) return;
      const canvas = this.querySelector('canvas');
      if (!canvas) return;

      const stateMachineName = this.dataset.stateMachine || '';
      if (!stateMachineName) return;

      const getInputs = () => {
        try { return this.riveInstance.stateMachineInputs(stateMachineName); }
        catch (e) { return []; }
      };

      const onPointerMove = (x, y) => {
        const inputs = getInputs();
        if (!inputs || inputs.length === 0) return;

        const rect = canvas.getBoundingClientRect();
        // Coordinate normalizzate 0-1
        const normX = (x - rect.left) / rect.width;
        const normY = (y - rect.top) / rect.height;
        // Coordinate in pixel relativi al centro del canvas
        const cx = (x - rect.left) - rect.width / 2;
        const cy = (y - rect.top) - rect.height / 2;

        inputs.forEach((input) => {
          const name = input.name.toLowerCase();
          // Input numerici per posizione X
          if (['x', 'mousex', 'pointerx', 'cursorx'].includes(name)) {
            input.value = normX * 100;
          }
          // Input numerici per posizione Y
          else if (['y', 'mousey', 'pointery', 'cursory'].includes(name)) {
            input.value = normY * 100;
          }
          // Input per coordinate centro
          else if (['cx', 'centerx'].includes(name)) {
            input.value = cx;
          }
          else if (['cy', 'centery'].includes(name)) {
            input.value = cy;
          }
          // Input boolean hover
          else if (['hover', 'ishover', 'is_hover', 'mouseover'].includes(name)) {
            input.value = true;
          }
        });
      };

      const onPointerLeave = () => {
        const inputs = getInputs();
        if (!inputs) return;
        inputs.forEach((input) => {
          const name = input.name.toLowerCase();
          if (['hover', 'ishover', 'is_hover', 'mouseover'].includes(name)) {
            input.value = false;
          }
        });
      };

      // Rileva se ci sono input trigger "follow" e usa l'API pointer di Rive
      const inputs = getInputs();
      const hasPointerInputs = inputs && inputs.some((i) => {
        const n = i.name.toLowerCase();
        return ['x', 'y', 'mousex', 'mousey', 'pointerx', 'pointery', 'cx', 'cy', 'centerx', 'centery'].includes(n);
      });

      if (hasPointerInputs) {
        this.mouseHandler = (e) => onPointerMove(e.clientX, e.clientY);
        this.mouseLeaveHandler = () => onPointerLeave();
        canvas.addEventListener('mousemove', this.mouseHandler);
        canvas.addEventListener('mouseleave', this.mouseLeaveHandler);

        this.touchHandler = (e) => {
          e.preventDefault();
          const touch = e.touches[0];
          if (touch) onPointerMove(touch.clientX, touch.clientY);
        };
        canvas.addEventListener('touchmove', this.touchHandler, { passive: false });
      }

      // Rive gestisce nativamente i pointer events per state machines
      // Passiamo gli eventi direttamente al runtime
      this.rivePointerMove = (e) => {
        const rect = canvas.getBoundingClientRect();
        this.riveInstance.stateMachinePointerMove(
          e.clientX - rect.left,
          e.clientY - rect.top
        );
      };
      this.rivePointerDown = (e) => {
        const rect = canvas.getBoundingClientRect();
        this.riveInstance.stateMachinePointerDown(
          e.clientX - rect.left,
          e.clientY - rect.top
        );
      };
      this.rivePointerUp = (e) => {
        const rect = canvas.getBoundingClientRect();
        this.riveInstance.stateMachinePointerUp(
          e.clientX - rect.left,
          e.clientY - rect.top
        );
      };

      canvas.addEventListener('mousemove', this.rivePointerMove);
      canvas.addEventListener('mousedown', this.rivePointerDown);
      canvas.addEventListener('mouseup', this.rivePointerUp);

      // Touch equivalents
      canvas.addEventListener('touchmove', (e) => {
        const touch = e.touches[0];
        if (!touch) return;
        const rect = canvas.getBoundingClientRect();
        this.riveInstance.stateMachinePointerMove(
          touch.clientX - rect.left,
          touch.clientY - rect.top
        );
      }, { passive: true });
    }

    setupResizeHandler() {
      let resizeTimeout;
      this.resizeHandler = () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
          if (!this.riveInstance) return;
          const canvas = this.querySelector('canvas');
          const container = canvas ? canvas.parentElement : null;
          if (container && canvas) {
            const rect = container.getBoundingClientRect();
            const dpr = window.devicePixelRatio || 1;
            canvas.width = rect.width * dpr;
            canvas.height = rect.height * dpr;
          }
          this.riveInstance.resizeDrawingSurfaceToCanvas();
        }, 100);
      };
      window.addEventListener('resize', this.resizeHandler);
    }

    executeCustomJS() {
      const customJsElement = this.querySelector('script[data-rive-custom-js]');
      if (customJsElement && this.riveInstance) {
        try {
          const riveInstance = this.riveInstance;
          const customCode = new Function('riveInstance', customJsElement.textContent);
          customCode(riveInstance);
        } catch (error) {
          console.error('Rive Animation: errore JS personalizzato', error);
        }
      }
    }

    cleanup() {
      if (this.observer) { this.observer.disconnect(); this.observer = null; }
      if (this.resizeHandler) { window.removeEventListener('resize', this.resizeHandler); this.resizeHandler = null; }
      const canvas = this.querySelector('canvas');
      if (canvas) {
        if (this.mouseHandler) canvas.removeEventListener('mousemove', this.mouseHandler);
        if (this.mouseLeaveHandler) canvas.removeEventListener('mouseleave', this.mouseLeaveHandler);
        if (this.touchHandler) canvas.removeEventListener('touchmove', this.touchHandler);
        if (this.rivePointerMove) canvas.removeEventListener('mousemove', this.rivePointerMove);
        if (this.rivePointerDown) canvas.removeEventListener('mousedown', this.rivePointerDown);
        if (this.rivePointerUp) canvas.removeEventListener('mouseup', this.rivePointerUp);
      }
      if (this.riveInstance) { this.riveInstance.cleanup(); this.riveInstance = null; }
    }

    play() { if (this.riveInstance) this.riveInstance.play(); }
    pause() { if (this.riveInstance) this.riveInstance.pause(); }
    stop() { if (this.riveInstance) this.riveInstance.stop(); }
    getRiveInstance() { return this.riveInstance; }
  }

  customElements.define('rive-animation', RiveAnimation);
}
