/**
 * Data di nascita: registrazione (customer note BIRTHDATE:YYYY-MM-DD) e validazione.
 * Nessuna chiamata esterna; Flow legge la note e aggiorna il metafield.
 */
(function() {
  'use strict';

  const BIRTHDATE_PREFIX = 'BIRTHDATE:';

  document.addEventListener('submit', function(e) {
    var form = e.target;
    if (form && form.nodeName === 'FORM') {
      var dateInput = form.querySelector('input[data-ms-birthdate-required]');
      if (dateInput && (dateInput.value || '').trim() === '') {
        e.preventDefault();
        dateInput.setAttribute('aria-invalid', 'true');
        dateInput.focus();
        if (dateInput.scrollIntoView) {
          dateInput.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }
    }
  }, true);

  function initRegister(options) {
    const form = document.getElementById(options.formId);
    const dateInput = document.getElementById(options.dateInputId);
    const noteInput = document.getElementById(options.noteInputId);
    const errorContainer = document.getElementById(options.errorContainerId);
    const required = options.required === true;

    if (!form || !dateInput || !noteInput) return;

    form.addEventListener('submit', function(e) {
      const value = (dateInput.value || '').trim();

      if (required && !value) {
        e.preventDefault();
        if (errorContainer) {
          errorContainer.classList.remove('hidden');
          dateInput.setAttribute('aria-invalid', 'true');
          dateInput.setAttribute('aria-describedby', errorContainer.id);
          dateInput.focus();
        }
        return;
      }

      if (errorContainer) {
        errorContainer.classList.add('hidden');
        dateInput.removeAttribute('aria-invalid');
        dateInput.removeAttribute('aria-describedby');
      }

      if (value) {
        noteInput.value = BIRTHDATE_PREFIX + value;
      }
    });
  }

  function initCart(options) {
    var checkoutBtn = document.getElementById(options.checkoutButtonId);
    var dateInput = document.getElementById(options.dateInputId);
    if (!checkoutBtn || !dateInput || !options.required) return;

    var form = checkoutBtn.form;
    if (!form) return;

    function getBirthdateValue() {
      return (dateInput.value || '').trim();
    }

    function otherReasonsDisabled() {
      return checkoutBtn.hasAttribute('data-ms-other-disabled') ||
        checkoutBtn.hasAttribute('data-ms-invoice-invalid') ||
        checkoutBtn.hasAttribute('data-ms-terms-disabled');
    }

    function toggleCheckout() {
      var val = getBirthdateValue();
      if (val) {
        checkoutBtn.removeAttribute('data-ms-birthdate-required');
        checkoutBtn.disabled = otherReasonsDisabled();
      } else {
        checkoutBtn.setAttribute('data-ms-birthdate-required', '');
        checkoutBtn.disabled = true;
      }
    }

    form.addEventListener('submit', function(e) {
      if (getBirthdateValue() === '') {
        e.preventDefault();
        dateInput.setAttribute('aria-invalid', 'true');
        dateInput.focus();
        if (dateInput.scrollIntoView) {
          dateInput.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }
    });

    dateInput.addEventListener('change', toggleCheckout);
    dateInput.addEventListener('input', toggleCheckout);
    dateInput.addEventListener('blur', function() {
      if (getBirthdateValue() === '') {
        dateInput.setAttribute('aria-invalid', 'true');
      } else {
        dateInput.removeAttribute('aria-invalid');
      }
    });
    toggleCheckout();
  }

  window.MSBirthdate = {
    initRegister: initRegister,
    initCart: initCart
  };
})();
