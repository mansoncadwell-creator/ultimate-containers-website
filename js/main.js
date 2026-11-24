/**
 * Ultimate Containers Inc. — progressive enhancement and quotation form
 */
document.addEventListener('DOMContentLoaded', () => {
  const year = String(new Date().getFullYear());
  document.querySelectorAll('.current-year, #year').forEach((node) => { node.textContent = year; });

  const navToggle = document.querySelector('.nav-toggle');
  const mainNav = document.querySelector('.main-nav');
  if (navToggle && mainNav) {
    navToggle.addEventListener('click', () => {
      const open = mainNav.classList.toggle('open');
      navToggle.setAttribute('aria-expanded', String(open));
    });
    mainNav.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => {
      mainNav.classList.remove('open');
      navToggle.setAttribute('aria-expanded', 'false');
    }));
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && mainNav.classList.contains('open')) {
        mainNav.classList.remove('open');
        navToggle.setAttribute('aria-expanded', 'false');
        navToggle.focus();
      }
    });
  }

  document.querySelectorAll('.faq-question').forEach((button) => {
    button.setAttribute('aria-expanded', button.closest('.faq-item')?.classList.contains('open') ? 'true' : 'false');
    button.addEventListener('click', () => {
      const item = button.closest('.faq-item');
      if (!item) return;
      const opening = !item.classList.contains('open');
      document.querySelectorAll('.faq-item.open').forEach((other) => {
        other.classList.remove('open');
        other.querySelector('.faq-question')?.setAttribute('aria-expanded', 'false');
      });
      item.classList.toggle('open', opening);
      button.setAttribute('aria-expanded', String(opening));
    });
  });

  const path = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.main-nav a').forEach((link) => {
    if (link.getAttribute('href') === path) link.classList.add('active');
  });

  const form = document.getElementById('quote-form');
  if (!form) return;
  const submitBtn = form.querySelector('[type="submit"]');
  const message = document.getElementById('form-message');
  let csrfToken = '';
  let submitting = false;

  const tokenField = form.querySelector('input[name="csrf_token"]');
  if (submitBtn) submitBtn.disabled = true;
  const loadToken = async () => {
    try {
      const response = await fetch('/api/csrf', {
        credentials: 'same-origin',
        headers: { 'Accept': 'application/json' },
        cache: 'no-store'
      });
      if (!response.ok) throw new Error('Token endpoint unavailable');
      const data = await response.json();
      if (!data.csrf_token) throw new Error('Token missing');
      csrfToken = data.csrf_token;
      if (tokenField) tokenField.value = csrfToken;
      if (submitBtn) submitBtn.disabled = false;
    } catch (_) {
      if (message) {
        message.className = 'form-message error';
        message.textContent = 'The secure form could not be initialized. Please refresh the page or contact the company using its verified contact details.';
        message.style.display = 'block';
      }
    }
  };
  loadToken();

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (submitting) return;
    clearErrors();
    if (!csrfToken) {
      showMessage('The secure form is not ready. Please wait a moment and try again.', false);
      return;
    }

    const required = ['full_name', 'email', 'container_type', 'quantity', 'delivery_city', 'delivery_country', 'privacy_consent'];
    let valid = true;
    required.forEach((name) => {
      const field = form.elements.namedItem(name);
      if (!field || (field.type === 'checkbox' ? !field.checked : !String(field.value).trim())) {
        markError(field, 'This field is required.');
        valid = false;
      }
    });
    const email = form.elements.namedItem('email');
    if (email && email.value.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) {
      markError(email, 'Enter a valid email address.');
      valid = false;
    }
    const quantity = form.elements.namedItem('quantity');
    if (quantity && quantity.value.trim()) {
      const n = Number(quantity.value);
      if (!Number.isInteger(n) || n < 1 || n > 9999) {
        markError(quantity, 'Enter a whole number from 1 to 9999.');
        valid = false;
      }
    }
    if (!valid) {
      form.querySelector('.has-error input, .has-error select, .has-error textarea')?.focus();
      return;
    }

    submitting = true;
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.dataset.originalText = submitBtn.textContent;
      submitBtn.textContent = 'Submitting…';
    }
    try {
      const response = await fetch(form.action || '/api/quotations', {
        method: 'POST',
        body: new URLSearchParams(new FormData(form)),
        credentials: 'same-origin',
        headers: { 'Accept': 'application/json', 'X-CSRF-Token': csrfToken },
        cache: 'no-store'
      });
      let data;
      try { data = await response.json(); }
      catch (_) { throw new Error('The server returned an unreadable response. Please try again later.'); }

      if (response.ok && data.success === true) {
        showMessage(data.message || 'Your enquiry has been received by the website.', true);
        form.reset();
        await loadToken();
      } else {
        showMessage(data.message || 'Your enquiry could not be submitted. Please review the form and try again.', false);
      }
    } catch (error) {
      showMessage(error.message || 'A connection error prevented submission. Please try again later.', false);
    } finally {
      submitting = false;
      if (submitBtn) {
        submitBtn.textContent = submitBtn.dataset.originalText || 'Submit Enquiry';
        if (csrfToken) submitBtn.disabled = false;
      }
    }
  });

  function markError(field, text) {
    if (!field) return;
    const group = field.closest('.form-group') || field.closest('.privacy-consent');
    if (group) {
      group.classList.add('has-error');
      const error = group.querySelector('.form-error');
      if (error) error.textContent = text;
    }
    field.classList.add('error');
    field.setAttribute('aria-invalid', 'true');
  }
  function clearErrors() {
    form.querySelectorAll('.has-error').forEach((el) => el.classList.remove('has-error'));
    form.querySelectorAll('.error').forEach((el) => {
      el.classList.remove('error');
      el.removeAttribute('aria-invalid');
    });
    form.querySelectorAll('.form-error').forEach((el) => { el.textContent = ''; });
    if (message) { message.style.display = 'none'; message.className = 'form-message'; }
  }
  function showMessage(text, success) {
    if (!message) return;
    message.className = success ? 'form-message success' : 'form-message error';
    message.textContent = text;
    message.style.display = 'block';
    message.setAttribute('role', success ? 'status' : 'alert');
    message.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
});
