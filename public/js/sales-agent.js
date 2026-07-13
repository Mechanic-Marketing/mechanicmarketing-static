// Mechanic Marketing sales agent - page controller for /sales-agent.html
// Calls /api/sales-agent (Cloudflare Pages Function).

(function () {
  const API = '/api/sales-agent';
  const STORAGE_KEY = 'mm_sales_lead_v1';
  const BOOKING_URL = 'https://meet.reclaimai.com/e/686c0900-a513-4c74-8e6c-c728c72145e7';

  const introForm = document.getElementById('saIntro');
  const leadForm = document.getElementById('saLeadForm');
  const bodyEl = document.getElementById('saBody');
  const inputWrap = document.getElementById('saInputWrap');
  const inputEl = document.getElementById('saInput');
  const sendBtn = document.getElementById('saSend');

  let lead = loadLead();
  let messages = [];
  let isSending = false;
  let clickupTaskId = null;

  function loadLead() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  function saveLead(l) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(l)); } catch {}
    lead = l;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function linkify(safeHtml) {
    return safeHtml.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
  }

  function addMessage(role, content) {
    const msg = document.createElement('div');
    msg.className = 'sa-msg sa-msg--' + role;
    msg.innerHTML = linkify(escapeHtml(content)).replace(/\n/g, '<br>');
    bodyEl.appendChild(msg);
    bodyEl.scrollTop = bodyEl.scrollHeight;

    messages.push({ role: role === 'agent' ? 'assistant' : 'user', content });
  }

  function addTyping() {
    removeTyping();
    const el = document.createElement('div');
    el.className = 'sa-typing';
    el.id = '_saTyping';
    el.innerHTML = '<span></span><span></span><span></span>';
    bodyEl.appendChild(el);
    bodyEl.scrollTop = bodyEl.scrollHeight;
  }

  function removeTyping() {
    const t = document.getElementById('_saTyping');
    if (t) t.remove();
  }

  function renderRecommendation(rec) {
    if (!rec || !rec.service) return;

    const card = document.createElement('div');
    card.className = 'sa-rec';

    const inclusions = (rec.included || [])
      .map(i => `<li>${escapeHtml(i)}</li>`)
      .join('');

    // Only Accelerate carries a booking offer.
    const offerBlock = (rec.service === 'accelerate' && rec.offer)
      ? `<div class="sa-rec__offer"><strong>Book now and save</strong>${escapeHtml(rec.offer)}</div>`
      : '';

    const ctaLabel = rec.service === 'accelerate'
      ? 'Book a call and lock it in'
      : (rec.service === 'unsure' ? 'Book a free call to talk it through' : 'Book a free call');

    card.innerHTML = `
      <span class="sa-rec__badge">${rec.service === 'unsure' ? "Let's talk" : 'Recommended for you'}</span>
      <div class="sa-rec__title">${escapeHtml(rec.headline || '')}</div>
      <div class="sa-rec__reason">${escapeHtml(rec.reasoning || '')}</div>
      ${rec.price ? `<div class="sa-rec__price"><div class="sa-rec__price-label">Investment</div><div class="sa-rec__price-amt">${escapeHtml(rec.price)}</div></div>` : ''}
      ${offerBlock}
      ${inclusions ? `<ul class="sa-rec__list">${inclusions}</ul>` : ''}
      <div class="sa-rec__cta">
        <a class="sa-btn" href="${BOOKING_URL}" target="_blank" rel="noopener">${ctaLabel}</a>
      </div>
    `;

    bodyEl.appendChild(card);
    bodyEl.scrollTop = bodyEl.scrollHeight;

    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event: 'sales_agent_recommendation', plan: rec.service });
  }

  function clearSuggestions() {
    const existing = document.getElementById('_saSuggestions');
    if (existing) existing.remove();
  }

  function renderSuggestions(suggestions) {
    clearSuggestions();
    if (!Array.isArray(suggestions) || suggestions.length === 0) return;

    const wrap = document.createElement('div');
    wrap.className = 'sa-suggestions';
    wrap.id = '_saSuggestions';
    suggestions.forEach((s) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'sa-chip';
      chip.textContent = s;
      chip.addEventListener('click', () => send(s));
      wrap.appendChild(chip);
    });
    bodyEl.appendChild(wrap);
    bodyEl.scrollTop = bodyEl.scrollHeight;
  }

  function showChat() {
    introForm.style.display = 'none';
    bodyEl.style.display = 'flex';
    inputWrap.style.display = 'flex';

    const greeting = `G'day ${lead.name}! Let's find the right fit for your workshop. First up, where are you at, just getting started, already running some marketing, or an established shop wanting the lot?`;
    addMessage('agent', greeting);
    renderSuggestions(['Just getting started', 'Already running ads', 'Established, want the lot']);
    setTimeout(() => inputEl.focus(), 200);
  }

  async function send(overrideText) {
    const text = (overrideText !== undefined ? overrideText : inputEl.value.trim()).trim();
    if (!text || isSending) return;

    clearSuggestions();
    addMessage('user', text);
    inputEl.value = '';
    inputEl.disabled = true;
    sendBtn.disabled = true;
    isSending = true;
    addTyping();

    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead,
          messages: messages.filter(m => m.role === 'user' || m.role === 'assistant'),
          clickupTaskId,
        }),
      });

      removeTyping();

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        addMessage('agent', err.error || "I'm having a bit of a moment. Try again?");
      } else {
        const data = await res.json();
        if (data.clickupTaskId) clickupTaskId = data.clickupTaskId;
        addMessage('agent', data.reply);
        renderRecommendation(data.recommendation);
        renderSuggestions(data.suggestions);
      }
    } catch (err) {
      removeTyping();
      addMessage('agent', "Can't reach our system right now. Check your connection?");
    } finally {
      inputEl.disabled = false;
      sendBtn.disabled = false;
      isSending = false;
      inputEl.focus();
    }
  }

  leadForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(leadForm);
    const newLead = {
      name: (fd.get('name') || '').trim(),
      email: (fd.get('email') || '').trim(),
      website: (fd.get('website') || '').trim(),
    };
    if (!newLead.name || !newLead.email) return;
    saveLead(newLead);
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event: 'sales_agent_lead', page: location.pathname });
    showChat();
  });

  sendBtn.addEventListener('click', () => send());
  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  });

  if (lead && lead.name && lead.email) {
    showChat();
  }
})();
