/**
 * MS Infinite Scroll
 * Carica automaticamente i contenuti successivi durante lo scroll.
 *
 * Uso (Liquid):
 *   <div data-infinite-scroll
 *        data-infinite-grid="<selettore griglia>"
 *        data-infinite-item="<selettore singolo elemento>">
 *     <!-- griglia con gli elementi -->
 *     <!-- paginazione classica (.pagination-wrapper) -->
 *   </div>
 *
 * Il next URL viene letto direttamente dalla paginazione DOM.
 * La paginazione classica resta nel DOM per SEO e noscript.
 * Se JS è disabilitato, la paginazione resta visibile.
 */
(function () {
  'use strict';

  var DEBUG = false; // Imposta a true per log di debug in console

  /* ── CSS iniettato una sola volta ── */
  var STYLE_ID = 'ms-infinite-scroll-styles';
  if (!document.getElementById(STYLE_ID)) {
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent =
      '.ms-infinite-scroll__loader{display:flex;align-items:center;justify-content:center;gap:1rem;padding:2rem 0;width:100%}' +
      '.ms-infinite-scroll__spinner{width:2.4rem;height:2.4rem;border:3px solid rgba(var(--color-foreground),.15);border-top-color:rgb(var(--color-foreground));border-radius:50%;animation:ms-spin .7s linear infinite}' +
      '.ms-infinite-scroll__text{font-size:1.4rem;color:rgba(var(--color-foreground),.6)}' +
      '@keyframes ms-spin{to{transform:rotate(360deg)}}';
    document.head.appendChild(style);
  }

  function log() {
    if (DEBUG) console.log.apply(console, ['[MS Infinite Scroll]'].concat(Array.prototype.slice.call(arguments)));
  }

  /**
   * Estrae il URL della prossima pagina dalla paginazione DOM.
   * In Dawn la freccia "avanti" ha classi:
   *   pagination__item--prev  pagination__item-arrow
   */
  function getNextUrlFromPagination(paginationEl) {
    if (!paginationEl) return null;
    var nextArrow = paginationEl.querySelector('.pagination__item--prev.pagination__item-arrow');
    if (nextArrow) {
      var href = nextArrow.getAttribute('href');
      if (href && !href.startsWith('http')) {
        href = window.location.origin + href;
      }
      return href;
    }
    return null;
  }

  /**
   * Controlla se la parte inferiore della griglia è vicina al viewport.
   * threshold = quanti px di anticipo rispetto al fondo della griglia
   */
  function isNearBottom(grid, threshold) {
    var rect = grid.getBoundingClientRect();
    var viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    return rect.bottom - viewportHeight < threshold;
  }

  /* ── Inizializzazione singolo wrapper ── */
  function initInfiniteScroll(wrapper) {
    /* Evita doppia init */
    if (wrapper._msInfiniteScroll) return;

    var gridSelector = wrapper.dataset.infiniteGrid;
    var itemSelector = wrapper.dataset.infiniteItem;

    var grid = wrapper.querySelector(gridSelector);
    if (!grid) {
      log('Griglia non trovata con selettore:', gridSelector);
      return;
    }

    /* Trova paginazione e next URL dalla DOM */
    var pagination = wrapper.querySelector('.pagination-wrapper');
    var currentNextUrl = getNextUrlFromPagination(pagination);

    log('Init — grid:', gridSelector, '| items:', itemSelector, '| nextUrl:', currentNextUrl, '| pagination:', !!pagination);

    /* Nascondi paginazione classica */
    if (pagination) pagination.style.display = 'none';

    /* Se non c'è una pagina successiva, niente da fare */
    if (!currentNextUrl) {
      log('Nessuna pagina successiva, infinite scroll non necessario');
      wrapper._msInfiniteScroll = noop();
      return;
    }

    var loading = false;
    var finished = false;
    var THRESHOLD = 800; // px di anticipo

    /* ── Loader ── */
    var loader = document.createElement('div');
    loader.className = 'ms-infinite-scroll__loader';
    loader.setAttribute('role', 'status');
    loader.setAttribute('aria-live', 'polite');
    loader.innerHTML =
      '<div class="ms-infinite-scroll__spinner" aria-hidden="true"></div>' +
      '<span class="ms-infinite-scroll__text">Caricamento…</span>';
    loader.style.display = 'none';
    grid.after(loader);

    /* ── Scroll listener ── */
    function checkScroll() {
      if (loading || finished || !currentNextUrl) return;

      if (isNearBottom(grid, THRESHOLD)) {
        log('Vicino al fondo — caricamento pagina:', currentNextUrl);
        loadNextPage();
      }
    }

    window.addEventListener('scroll', checkScroll, { passive: true });
    window.addEventListener('resize', checkScroll, { passive: true });

    /* Check iniziale (se la pagina è corta, carica subito) */
    requestAnimationFrame(function () {
      checkScroll();
    });

    /* ── Fetch pagina successiva ── */
    function loadNextPage() {
      loading = true;
      loader.style.display = '';

      fetch(currentNextUrl)
        .then(function (res) {
          if (!res.ok) throw new Error('HTTP ' + res.status);
          return res.text();
        })
        .then(function (html) {
          var doc = new DOMParser().parseFromString(html, 'text/html');

          /* Estrai nuovi elementi dalla griglia fetchata */
          var fetchedGrid = doc.querySelector(gridSelector);
          if (fetchedGrid) {
            var newItems = fetchedGrid.querySelectorAll(itemSelector);
            log('Trovati', newItems.length, 'nuovi elementi');

            var fragment = document.createDocumentFragment();
            newItems.forEach(function (item) {
              fragment.appendChild(item);
            });

            grid.appendChild(fragment);

            /* Ri-attiva eventuali animazioni Dawn */
            if (typeof initializeScrollAnimationTrigger === 'function') {
              initializeScrollAnimationTrigger(grid.parentElement);
            }
          } else {
            log('Griglia non trovata nella pagina fetchata');
          }

          /* Cerca la prossima pagina nel documento fetchato */
          var fetchedPagination = doc.querySelector('.pagination-wrapper');
          currentNextUrl = getNextUrlFromPagination(fetchedPagination);
          log('Prossima pagina:', currentNextUrl);

          loading = false;
          loader.style.display = 'none';

          if (!currentNextUrl) {
            finish();
          } else {
            /* Dopo aver aggiunto contenuto, ri-controlla subito
               (la pagina potrebbe essere ancora corta) */
            requestAnimationFrame(function () {
              checkScroll();
            });
          }
        })
        .catch(function (err) {
          console.error('[MS Infinite Scroll] Errore:', err);
          loading = false;
          loader.style.display = 'none';
        });
    }

    /* ── Fine: rimuovi listener ── */
    function finish() {
      log('Tutte le pagine caricate');
      finished = true;
      window.removeEventListener('scroll', checkScroll);
      window.removeEventListener('resize', checkScroll);
      if (loader.parentNode) loader.remove();
    }

    /* ── Destroy (per ri-inizializzazione dopo filtri) ── */
    function destroy() {
      finished = true;
      window.removeEventListener('scroll', checkScroll);
      window.removeEventListener('resize', checkScroll);
      if (loader.parentNode) loader.remove();
      if (pagination) pagination.style.display = '';
    }

    wrapper._msInfiniteScroll = { destroy: destroy };
    log('Infinite scroll attivato con scroll listener (threshold:', THRESHOLD, 'px)');
  }

  /* Helper vuoto */
  function noop() {
    return { destroy: function () {} };
  }

  /* ── Init globale ── */
  function initAll() {
    var wrappers = document.querySelectorAll('[data-infinite-scroll]');
    log('initAll — trovati', wrappers.length, 'wrapper(s)');
    wrappers.forEach(initInfiniteScroll);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    requestAnimationFrame(initAll);
  }

  /* ── Theme editor: re-init dopo caricamento sezione ── */
  document.addEventListener('shopify:section:load', function () {
    setTimeout(initAll, 200);
  });

  /* ── Collection: re-init dopo che facets.js aggiorna ProductGridContainer ── */
  function watchProductGridContainer() {
    var pgc = document.getElementById('ProductGridContainer');
    if (!pgc) return;

    new MutationObserver(function () {
      setTimeout(function () {
        var wrapper = pgc.querySelector('[data-infinite-scroll]');
        if (wrapper) {
          if (wrapper._msInfiniteScroll) {
            wrapper._msInfiniteScroll.destroy();
            wrapper._msInfiniteScroll = null;
          }
          initInfiniteScroll(wrapper);
        }
      }, 100);
    }).observe(pgc, { childList: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', watchProductGridContainer);
  } else {
    requestAnimationFrame(watchProductGridContainer);
  }

  /* Esponi globalmente */
  window.MSInfiniteScroll = { init: initInfiniteScroll, initAll: initAll };
})();
