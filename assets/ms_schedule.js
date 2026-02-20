/**
 * MS Schedule — Client-side scheduling utility
 * ═══════════════════════════════════════════════════════════════
 * Gestisce la visibilità degli elementi in base a temporizzazione.
 * Lavora in sinergia con ms_schedule_check.liquid (server-side)
 * e ms_datetime.liquid (variabile globale).
 *
 * Cerca elementi con attributo [data-ms-schedule] e li nasconde/mostra
 * in base a data-ms-schedule-start e data-ms-schedule-end.
 *
 * Utile per gestire edge-case di pagine cachate dalla CDN Shopify.
 */
(function () {
  'use strict';

  var CHECK_INTERVAL_MS = 60000; // Controlla ogni 60 secondi

  window.MS_Schedule = {
    /**
     * Verifica se il momento attuale è entro la finestra temporale.
     * @param {string|null} startStr - Data inizio "YYYY-MM-DD HH:MM" (null/vuoto = nessun limite)
     * @param {string|null} endStr   - Data fine "YYYY-MM-DD HH:MM" (null/vuoto = nessun limite)
     * @returns {boolean}
     */
    isVisible: function (startStr, endStr) {
      var now = new Date();

      if (startStr && startStr.trim() !== '') {
        var start = new Date(startStr.trim().replace(' ', 'T'));
        if (isNaN(start.getTime()) || now < start) return false;
      }

      if (endStr && endStr.trim() !== '') {
        var end = new Date(endStr.trim().replace(' ', 'T'));
        if (isNaN(end.getTime()) || now > end) return false;
      }

      return true;
    },

    /**
     * Scansiona il DOM e mostra/nasconde gli elementi schedulati.
     * Gli elementi devono avere l'attributo [data-ms-schedule].
     * Opzionali: data-ms-schedule-start, data-ms-schedule-end.
     */
    check: function () {
      var elements = document.querySelectorAll('[data-ms-schedule]');

      for (var i = 0; i < elements.length; i++) {
        var el = elements[i];
        var start = el.getAttribute('data-ms-schedule-start') || null;
        var end = el.getAttribute('data-ms-schedule-end') || null;
        var visible = MS_Schedule.isVisible(start, end);

        if (!visible) {
          el.style.display = 'none';
          el.setAttribute('aria-hidden', 'true');
        } else {
          // Rimuovi solo se era stato nascosto da noi
          if (el.getAttribute('aria-hidden') === 'true') {
            el.style.display = '';
            el.removeAttribute('aria-hidden');
          }
        }
      }
    },

    /**
     * Avvia il controllo periodico della temporizzazione.
     * @param {number} [intervalMs] - Intervallo in ms (default: 60000)
     */
    startAutoCheck: function (intervalMs) {
      intervalMs = intervalMs || CHECK_INTERVAL_MS;
      setInterval(function () {
        MS_Schedule.check();
      }, intervalMs);
    },

    /**
     * Inizializzazione: esegui il primo check e avvia il timer.
     */
    init: function () {
      MS_Schedule.check();
      MS_Schedule.startAutoCheck();
    }
  };

  // Auto-init
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', MS_Schedule.init);
  } else {
    MS_Schedule.init();
  }
})();
