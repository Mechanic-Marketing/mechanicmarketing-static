// Mobile nav toggle
const toggle = document.querySelector('.nav-toggle');
const nav = document.querySelector('.site-nav');
if (toggle && nav) {
  toggle.addEventListener('click', () => {
    nav.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', nav.classList.contains('is-open'));
  });
}

// Contact form handler
const form = document.getElementById('contact-form');
if (form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button[type="submit"]');
    btn.textContent = 'Sending...';
    btn.disabled = true;
    try {
      const res = await fetch('__CONTACT_FORM_ENDPOINT__', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(new FormData(form)))
      });
      if (res.ok) {
        form.innerHTML = '<p class="form-success">Thanks — we\'ll be in touch within 1 business day.</p>';
      } else {
        throw new Error('Server error');
      }
    } catch {
      btn.textContent = 'Try again';
      btn.disabled = false;
      const err = document.createElement('p');
      err.className = 'form-error';
      err.textContent = 'Something went wrong. Please email us directly at hello@mechanicmarketing.co';
      form.appendChild(err);
    }
  });
}
