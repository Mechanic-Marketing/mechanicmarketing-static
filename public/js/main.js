// ==========================================================================
// Mechanic Marketing — main.js
// ==========================================================================

// ---------------------------------------------------------------------------
// Animated counters (scroll-triggered, cubic easing, 2000ms)
// ---------------------------------------------------------------------------
function animateCounters() {
  document.querySelectorAll('.counter, [data-target]').forEach(function(el) {
    if (el.dataset.counted) return;
    var rect = el.getBoundingClientRect();
    if (rect.top > window.innerHeight) return;
    el.dataset.counted = '1';
    var target = parseInt(el.dataset.target);
    var suffix = el.dataset.suffix || '';
    var duration = 2000;
    var start = performance.now();
    function update(now) {
      var elapsed = now - start;
      var progress = Math.min(elapsed / duration, 1);
      // Cubic ease-out
      var eased = 1 - Math.pow(1 - progress, 3);
      var current = Math.round(target * eased);
      if (el.classList.contains('counter')) {
        el.textContent = current.toLocaleString();
      } else {
        el.textContent = current.toLocaleString() + suffix;
      }
      if (progress < 1) requestAnimationFrame(update);
    }
    requestAnimationFrame(update);
  });
}

// ---------------------------------------------------------------------------
// Scroll reveal (.reveal class)
// ---------------------------------------------------------------------------
function revealOnScroll() {
  document.querySelectorAll('.reveal').forEach(function(el) {
    var rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight - 60) {
      el.classList.add('visible');
    }
  });
}

window.addEventListener('scroll', function() {
  animateCounters();
  revealOnScroll();
});

window.addEventListener('load', function() {
  animateCounters();
  revealOnScroll();
});

// ---------------------------------------------------------------------------
// Step card entrance animation
// ---------------------------------------------------------------------------
var stepCards = document.querySelectorAll('.step-card');
if (stepCards.length && 'IntersectionObserver' in window) {
  var stepObserver = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        stepObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });
  stepCards.forEach(function(card) { stepObserver.observe(card); });
}

// ---------------------------------------------------------------------------
// FAQ accordion
// ---------------------------------------------------------------------------
document.querySelectorAll('.faq-q').forEach(function(btn) {
  btn.addEventListener('click', function() {
    this.parentElement.classList.toggle('open');
  });
});

// ---------------------------------------------------------------------------
// Contact form handler
// ---------------------------------------------------------------------------
var form = document.getElementById('contact-form');
if (form) {
  form.addEventListener('submit', async function(e) {
    e.preventDefault();
    var btn = form.querySelector('button[type="submit"]');
    btn.textContent = 'Sending...';
    btn.disabled = true;
    try {
      var res = await fetch('/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(new FormData(form)))
      });
      if (res.ok) {
        form.innerHTML = '<p class="form-success">Thanks — we\'ll be in touch within 1 business day.</p>';
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({ event: 'generate_lead', form_name: 'contact' });
      } else {
        throw new Error('Server error');
      }
    } catch (err) {
      btn.textContent = 'Try again';
      btn.disabled = false;
      var errEl = document.createElement('p');
      errEl.className = 'form-error';
      errEl.textContent = 'Something went wrong. Please email us directly at hello@mechanicmarketing.co';
      form.appendChild(errEl);
    }
  });
}
