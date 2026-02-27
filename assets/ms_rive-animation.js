if (!customElements.get('rive-animation')) {
  class RiveAnimation extends HTMLElement {
    constructor() {
      super();
      this.riveInstance = null;
      this.observer = null;
      this.resizeHandler = null;
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
        {
          rootMargin: '200px',
          threshold: 0,
        }
      );

      this.observer.observe(this);
    }

    async loadRive() {
      const src = this.dataset.src;
      if (!src) {
        console.warn('Rive Animation: No src provided');
        return;
      }

      if (typeof rive === 'undefined') {
        await this.loadRiveScript();
      }

      this.initRive();
    }

    loadRiveScript() {
      return new Promise((resolve, reject) => {
        if (typeof rive !== 'undefined') {
          resolve();
          return;
        }

        const script = document.createElement('script');
        script.src = 'https://unpkg.com/@rive-app/canvas@2.24.0';
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
    }

    initRive() {
      const canvas = this.querySelector('canvas');
      if (!canvas) {
        console.warn('Rive Animation: No canvas element found');
        return;
      }

      const src = this.dataset.src;
      const stateMachine = this.dataset.stateMachine || undefined;
      const autoplay = this.dataset.autoplay === 'true';
      const loop = this.dataset.loop === 'true';

      const shouldAutoplay = autoplay && !this.prefersReducedMotion.matches;

      const riveOptions = {
        src: src,
        canvas: canvas,
        autoplay: shouldAutoplay,
        onLoad: () => {
          this.riveInstance.resizeDrawingSurfaceToCanvas();
          this.setupResizeHandler();
          this.executeCustomJS();

          if (this.prefersReducedMotion.matches && autoplay) {
            this.riveInstance.pause();
          }
        },
        onLoadError: (error) => {
          console.error('Rive Animation: Failed to load', error);
        },
      };

      if (stateMachine) {
        riveOptions.stateMachines = stateMachine;
      }

      this.riveInstance = new rive.Rive(riveOptions);

      this.prefersReducedMotion.addEventListener('change', (e) => {
        if (this.riveInstance) {
          if (e.matches) {
            this.riveInstance.pause();
          } else if (autoplay) {
            this.riveInstance.play();
          }
        }
      });
    }

    setupResizeHandler() {
      let resizeTimeout;
      this.resizeHandler = () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
          if (this.riveInstance) {
            this.riveInstance.resizeDrawingSurfaceToCanvas();
          }
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
          console.error('Rive Animation: Custom JS error', error);
        }
      }
    }

    cleanup() {
      if (this.observer) {
        this.observer.disconnect();
        this.observer = null;
      }

      if (this.resizeHandler) {
        window.removeEventListener('resize', this.resizeHandler);
        this.resizeHandler = null;
      }

      if (this.riveInstance) {
        this.riveInstance.cleanup();
        this.riveInstance = null;
      }
    }

    play() {
      if (this.riveInstance) {
        this.riveInstance.play();
      }
    }

    pause() {
      if (this.riveInstance) {
        this.riveInstance.pause();
      }
    }

    stop() {
      if (this.riveInstance) {
        this.riveInstance.stop();
      }
    }

    getRiveInstance() {
      return this.riveInstance;
    }
  }

  customElements.define('rive-animation', RiveAnimation);
}
