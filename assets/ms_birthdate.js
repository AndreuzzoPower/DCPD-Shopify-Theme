/**
 * Data di nascita: validazione carrello.
 * Segue il pattern dei gate sul bottone checkout (data-ms-birthdate-invalid + ms:gate-changed).
 */
(function() {
  'use strict';

  function isAnyGateBlocking(btn) {
    return btn.hasAttribute('data-ms-other-disabled') ||
      btn.hasAttribute('data-ms-invoice-invalid') ||
      btn.hasAttribute('data-ms-birthdate-invalid');
  }

  function isTermsBlocking(btn) {
    var termsEl = document.querySelector('ms-cart-terms[data-checkout-id="' + btn.id + '"]');
    if (!termsEl) return false;
    var cb = termsEl.querySelector('.ms-cart-terms__checkbox');
    return cb && !cb.checked;
  }

  function resolveDisabled(btn) {
    btn.disabled = isAnyGateBlocking(btn) || isTermsBlocking(btn);

    var ctasContainer = btn.closest('.cart__ctas');
    if (ctasContainer) {
      var dynCheckout = ctasContainer.nextElementSibling;
      if (dynCheckout && dynCheckout.classList.contains('cart__dynamic-checkout-buttons')) {
        dynCheckout.hidden = btn.disabled;
      }
    }
  }

  function initCart(options) {
    var checkoutBtn = document.getElementById(options.checkoutButtonId);
    var dateInput = document.getElementById(options.dateInputId);
    if (!checkoutBtn || !dateInput || !options.required) return;

    function getValue() {
      return (dateInput.value || '').trim();
    }

    function sync() {
      if (getValue()) {
        checkoutBtn.removeAttribute('data-ms-birthdate-invalid');
      } else {
        checkoutBtn.setAttribute('data-ms-birthdate-invalid', '');
      }
      checkoutBtn.dispatchEvent(new CustomEvent('ms:gate-changed'));
      resolveDisabled(checkoutBtn);
    }

    dateInput.addEventListener('change', sync);
    dateInput.addEventListener('input', sync);
    dateInput.addEventListener('blur', function() {
      if (getValue() === '') {
        dateInput.setAttribute('aria-invalid', 'true');
      } else {
        dateInput.removeAttribute('aria-invalid');
      }
    });

    checkoutBtn.addEventListener('ms:gate-changed', function() {
      resolveDisabled(checkoutBtn);
    });

    var form = checkoutBtn.form || document.getElementById(checkoutBtn.getAttribute('form'));
    if (form) {
      form.addEventListener('submit', function(e) {
        if (getValue() === '') {
          e.preventDefault();
          dateInput.setAttribute('aria-invalid', 'true');
          dateInput.focus();
          if (dateInput.scrollIntoView) {
            dateInput.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
        }
      });
    }

    sync();
  }

  window.MSBirthdate = {
    initCart: initCart
  };
})();
