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
