// Mechanic Marketing sales agent - persistent site-wide chat widget.
// Floating launcher + panel, present on every page. Talks to /api/sales-agent.
// Persists the lead + full conversation + clickupTaskId in localStorage, so
// the chat survives page navigation and reloads.
//
// Namespaced `.msa-*` (mechanic sales agent) to avoid any CSS/JS collision.
// The lead key is shared with the dedicated /sales-agent page so a visitor who
// introduces themselves in one place doesn't have to do it twice.

(function () {
  const API = '/api/sales-agent';
  const LEAD_KEY = 'mm_sales_lead_v1';
  const STATE_KEY = 'mm_sales_agent_state_v1';
  const BOOKING_URL = 'https://meet.reclaimai.com/e/686c0900-a513-4c74-8e6c-c728c72145e7';

  const FONT = "'TT Commons Pro','Helvetica Neue',Arial,sans-serif";

  const css = `
  .msa-launcher {
    position: fixed; right: 20px; bottom: 20px; z-index: 9997;
    display: flex; align-items: center; gap: 10px;
    background: #1c1c1a; color: #F0F0EC;
    border: none; border-radius: 100px;
    padding: 12px 20px 12px 12px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.28);
    cursor: pointer; font-family: ${FONT};
    transition: transform 0.15s;
  }
  .msa-launcher:hover { transform: translateY(-2px); }
  .msa-launcher__avatar { width: 32px; height: 32px; border-radius: 50%; background: #FF3D02; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.8rem; flex-shrink: 0; }
  .msa-launcher__label { font-size: 0.85rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; white-space: nowrap; }
  .msa-launcher.open { display: none; }

  .msa-overlay {
    position: fixed; inset: 0;
    background: rgba(28,28,26,0.5);
    z-index: 9998;
    display: flex; align-items: flex-end; justify-content: flex-end;
    opacity: 0; transition: opacity 0.3s; pointer-events: none;
  }
  .msa-overlay.open { opacity: 1; pointer-events: auto; }
  .msa-panel {
    width: 420px; max-width: calc(100vw - 32px);
    height: 640px; max-height: calc(100vh - 32px);
    margin: 16px; background: #F0F0EC;
    border: 2px solid #1c1c1a; border-radius: 4px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    display: flex; flex-direction: column; overflow: hidden;
    transform: translateY(20px); transition: transform 0.3s;
  }
  .msa-overlay.open .msa-panel { transform: translateY(0); }
  .msa-header { background: #1c1c1a; color: #F0F0EC; padding: 16px 20px; display: flex; align-items: center; gap: 12px; }
  .msa-header__avatar { width: 36px; height: 36px; border-radius: 50%; background: #FF3D02; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.85rem; flex-shrink: 0; }
  .msa-header__title { font-family: ${FONT}; font-size: 0.95rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.03em; }
  .msa-header__sub { font-size: 0.7rem; color: rgba(240,240,236,0.6); margin-top: 2px; display: flex; align-items: center; gap: 6px; }
  .msa-header__dot { width: 6px; height: 6px; border-radius: 50%; background: #4ade80; }
  .msa-header__actions { margin-left: auto; display: flex; align-items: center; gap: 4px; }
  .msa-header__btn { background: none; border: none; color: #F0F0EC; cursor: pointer; padding: 4px 8px; line-height: 1; opacity: 0.7; transition: opacity 0.2s; font-family: inherit; }
  .msa-header__btn:hover { opacity: 1; }
  .msa-header__close { font-size: 1.4rem; }
  .msa-header__restart { font-size: 0.68rem; text-decoration: underline; }

  .msa-intro { flex: 1; padding: 26px 22px; display: flex; flex-direction: column; gap: 16px; overflow-y: auto; }
  .msa-intro__greeting { font-family: ${FONT}; font-weight: 800; font-size: 1.25rem; text-transform: uppercase; line-height: 1.1; color: #1c1c1a; }
  .msa-intro__sub { font-size: 0.9rem; color: #555; line-height: 1.5; }
  .msa-intro__form { display: flex; flex-direction: column; gap: 12px; }
  .msa-intro__field { display: flex; flex-direction: column; gap: 4px; }
  .msa-intro__field label { font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #777; }
  .msa-intro__field input { padding: 12px 14px; border: 1.5px solid #1c1c1a; border-radius: 2px; font-family: inherit; font-size: 0.92rem; background: #fff; }
  .msa-intro__field input:focus { outline: none; box-shadow: 0 0 0 3px rgba(255,61,2,0.22); }
  .msa-intro__btn { margin-top: 8px; padding: 14px 20px; background: #FF3D02; color: #fff; border: none; border-radius: 2px; font-family: ${FONT}; font-size: 0.85rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; cursor: pointer; }
  .msa-intro__fineprint { font-size: 0.7rem; color: #999; text-align: center; margin-top: 4px; }

  .msa-body { flex: 1; padding: 16px; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; background: #F0F0EC; }
  .msa-msg { max-width: 85%; padding: 10px 14px; border-radius: 12px; font-size: 0.9rem; line-height: 1.5; word-wrap: break-word; white-space: pre-wrap; }
  .msa-msg--agent { background: #fff; color: #1c1c1a; border: 1.5px solid #1c1c1a; align-self: flex-start; border-bottom-left-radius: 3px; }
  .msa-msg--user { background: #1c1c1a; color: #F0F0EC; align-self: flex-end; border-bottom-right-radius: 3px; }
  .msa-msg a { text-decoration: underline; }
  .msa-typing { align-self: flex-start; background: #fff; border: 1.5px solid #1c1c1a; padding: 12px 16px; border-radius: 12px; display: flex; gap: 4px; }
  .msa-typing span { width: 7px; height: 7px; border-radius: 50%; background: #999; animation: msaDot 1.2s ease-in-out infinite; }
  .msa-typing span:nth-child(2) { animation-delay: 0.2s; }
  .msa-typing span:nth-child(3) { animation-delay: 0.4s; }
  @keyframes msaDot { 0%, 60%, 100% { opacity: 0.3; } 30% { opacity: 1; } }

  .msa-rec { align-self: stretch; background: #fff; border: 2px solid #1c1c1a; border-radius: 3px; padding: 18px 20px; box-shadow: 4px 4px 0 #1c1c1a; }
  .msa-rec__badge { display: inline-block; background: #FF3D02; color: #fff; padding: 4px 12px; border-radius: 100px; font-family: ${FONT}; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 10px; }
  .msa-rec__title { font-family: ${FONT}; font-weight: 800; font-size: 1.15rem; text-transform: uppercase; margin-bottom: 6px; color: #1c1c1a; }
  .msa-rec__desc { font-size: 0.82rem; color: #444; line-height: 1.5; margin-bottom: 10px; }
  .msa-rec__price { background: #1c1c1a; color: #F0F0EC; border-radius: 2px; padding: 10px 14px; font-family: ${FONT}; font-size: 0.9rem; font-weight: 800; margin-bottom: 10px; }
  .msa-rec__offer { background: #F0AA00; border: 1.5px solid #1c1c1a; border-radius: 2px; padding: 10px 14px; font-size: 0.8rem; line-height: 1.45; color: #1c1c1a; margin-bottom: 12px; }
  .msa-rec__offer strong { display: block; text-transform: uppercase; font-family: ${FONT}; letter-spacing: 0.03em; margin-bottom: 2px; }
  .msa-rec__list { list-style: none; padding: 0; margin: 0 0 14px; }
  .msa-rec__list li { padding: 4px 0 4px 20px; position: relative; font-size: 0.82rem; color: #222; line-height: 1.45; }
  .msa-rec__list li::before { content: '✓'; position: absolute; left: 0; top: 4px; color: #FF3D02; font-weight: 800; }
  .msa-rec__cta { display: inline-block; padding: 11px 20px; background: #FF3D02; color: #fff; border-radius: 2px; font-family: ${FONT}; font-size: 0.8rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; text-decoration: none; }

  .msa-suggestions { align-self: flex-start; max-width: 90%; display: flex; flex-wrap: wrap; gap: 6px; }
  .msa-chip { background: #fff; border: 1.5px solid #1c1c1a; border-radius: 100px; padding: 6px 14px; font-family: inherit; font-size: 0.78rem; font-weight: 600; color: #1c1c1a; cursor: pointer; transition: background 0.15s, color 0.15s, transform 0.15s; }
  .msa-chip:hover { background: #FF3D02; color: #fff; border-color: #FF3D02; transform: translateY(-1px); }

  .msa-input { padding: 12px 16px; border-top: 1.5px solid #1c1c1a; background: #fff; display: flex; gap: 8px; }
  .msa-input input { flex: 1; padding: 10px 14px; border: 1.5px solid #1c1c1a; border-radius: 100px; font-family: inherit; font-size: 0.9rem; background: #F0F0EC; }
  .msa-input input:focus { outline: none; box-shadow: 0 0 0 3px rgba(255,61,2,0.2); }
  .msa-input button { padding: 10px 18px; background: #1c1c1a; color: #fff; border: none; border-radius: 100px; font-family: ${FONT}; font-size: 0.8rem; font-weight: 700; text-transform: uppercase; cursor: pointer; }
  .msa-input button:disabled { background: #999; cursor: not-allowed; }

  @media (max-width: 480px) {
    .msa-panel { width: 100%; max-width: 100%; height: 100%; max-height: 100%; margin: 0; border-radius: 0; }
    .msa-launcher__label { display: none; }
    .msa-launcher { padding: 12px; }
  }
  `;

  class SalesAgentWidget {
    constructor() {
      this.lead = this.loadLead();
      this.history = []; // [{role:'agent'|'user', content, recommendation?, suggestions?}]
      this.clickupTaskId = null;
      this.isSending = false;
      this.init();
    }

    // ---------- storage ----------
    loadLead() {
      try {
        const raw = localStorage.getItem(LEAD_KEY);
        return raw ? JSON.parse(raw) : null;
      } catch { return null; }
    }
    saveLead(lead) {
      try { localStorage.setItem(LEAD_KEY, JSON.stringify(lead)); } catch {}
      this.lead = lead;
    }
    loadState() {
      try {
        const raw = localStorage.getItem(STATE_KEY);
        if (!raw) return { history: [], clickupTaskId: null };
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return { history: parsed, clickupTaskId: null };
        return { history: parsed.history || [], clickupTaskId: parsed.clickupTaskId || null };
      } catch { return { history: [], clickupTaskId: null }; }
    }
    saveState() {
      try {
        localStorage.setItem(STATE_KEY, JSON.stringify({ history: this.history, clickupTaskId: this.clickupTaskId }));
      } catch {}
    }
    clearAll() {
      try { localStorage.removeItem(STATE_KEY); } catch {}
      this.history = [];
      this.clickupTaskId = null;
    }

    // ---------- dom ----------
    init() {
      if (!document.getElementById('msa-styles')) {
        const s = document.createElement('style');
        s.id = 'msa-styles';
        s.textContent = css;
        document.head.appendChild(s);
      }

      this.launcher = document.createElement('button');
      this.launcher.className = 'msa-launcher';
      this.launcher.type = 'button';
      this.launcher.setAttribute('aria-label', 'Chat to find the right Mechanic Marketing plan');
      this.launcher.innerHTML = `
        <span class="msa-launcher__avatar">MM</span>
        <span class="msa-launcher__label">Find your plan</span>
      `;
      document.body.appendChild(this.launcher);

      this.overlay = document.createElement('div');
      this.overlay.className = 'msa-overlay';
      this.overlay.innerHTML = `
        <div class="msa-panel" role="dialog" aria-label="Chat to find the right Mechanic Marketing plan">
          <div class="msa-header">
            <div class="msa-header__avatar">MM</div>
            <div>
              <div class="msa-header__title">Mechanic Marketing</div>
              <div class="msa-header__sub"><span class="msa-header__dot"></span>Find the right plan for your workshop</div>
            </div>
            <div class="msa-header__actions">
              <button class="msa-header__btn msa-header__restart" type="button">Start over</button>
              <button class="msa-header__btn msa-header__close" type="button" aria-label="Close chat">&times;</button>
            </div>
          </div>
          <div class="msa-intro"></div>
          <div class="msa-body" style="display:none;"></div>
          <div class="msa-input" style="display:none;">
            <input type="text" placeholder="Type a message..." aria-label="Message the Mechanic Marketing assistant">
            <button type="button">Send</button>
          </div>
        </div>
      `;
      document.body.appendChild(this.overlay);

      this.introEl = this.overlay.querySelector('.msa-intro');
      this.bodyEl = this.overlay.querySelector('.msa-body');
      this.inputWrap = this.overlay.querySelector('.msa-input');
      this.inputEl = this.overlay.querySelector('.msa-input input');
      this.sendBtn = this.overlay.querySelector('.msa-input button');
      this.closeBtn = this.overlay.querySelector('.msa-header__close');
      this.restartBtn = this.overlay.querySelector('.msa-header__restart');

      this.launcher.addEventListener('click', () => this.open());
      this.closeBtn.addEventListener('click', () => this.close());
      this.overlay.addEventListener('click', (e) => { if (e.target === this.overlay) this.close(); });
      this.sendBtn.addEventListener('click', () => this.send());
      this.inputEl.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.send(); } });
      this.restartBtn.addEventListener('click', () => this.restart());

      window.openMechanicSalesAgent = () => this.open();
    }

    open() {
      this.overlay.classList.add('open');
      this.launcher.classList.add('open');
      if (this.lead && this.lead.name && this.lead.email) this.showChat();
      else this.showIntro();
    }
    close() {
      this.overlay.classList.remove('open');
      this.launcher.classList.remove('open');
    }
    restart() {
      this.clearAll();
      this.showIntro();
    }

    showIntro() {
      this.introEl.style.display = 'flex';
      this.bodyEl.style.display = 'none';
      this.inputWrap.style.display = 'none';

      this.introEl.innerHTML = `
        <div>
          <div class="msa-intro__greeting">G'day! Let's find your fit.</div>
          <div class="msa-intro__sub" style="margin-top:10px;">Tell us about your workshop and we'll point you to the right plan, then get you a free call to kick things off.</div>
        </div>
        <form class="msa-intro__form" autocomplete="on">
          <div class="msa-intro__field">
            <label>Your name</label>
            <input type="text" name="name" required placeholder="e.g. Dave">
          </div>
          <div class="msa-intro__field">
            <label>Email</label>
            <input type="email" name="email" required placeholder="you@yourworkshop.com.au">
          </div>
          <div class="msa-intro__field">
            <label>Workshop website (optional)</label>
            <input type="url" name="website" placeholder="https://yourworkshop.com.au">
          </div>
          <button type="submit" class="msa-intro__btn">Start chatting</button>
          <p class="msa-intro__fineprint">We'll only use this to reply, never to spam you.</p>
        </form>
      `;

      const form = this.introEl.querySelector('form');
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const fd = new FormData(form);
        const lead = {
          name: (fd.get('name') || '').trim(),
          email: (fd.get('email') || '').trim(),
          website: (fd.get('website') || '').trim(),
        };
        if (!lead.name || !lead.email) return;
        this.saveLead(lead);
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({ event: 'sales_agent_lead', page: location.pathname });
        this.showChat();
      });
    }

    showChat() {
      this.introEl.style.display = 'none';
      this.bodyEl.style.display = 'flex';
      this.inputWrap.style.display = 'flex';
      this.bodyEl.innerHTML = '';

      const state = this.loadState();
      this.history = state.history;
      this.clickupTaskId = state.clickupTaskId;

      if (this.history.length === 0) {
        const greeting = `G'day ${this.lead.name}! Where are you at, just getting started, already running some marketing, or an established shop wanting the lot?`;
        this.addMessage('agent', greeting, null, ['Just getting started', 'Already running ads', 'Established, want the lot'], true);
      } else {
        this.history.forEach((entry, i) => {
          this.renderMessage(entry.role, entry.content);
          if (entry.recommendation) this.renderRecommendation(entry.recommendation);
          if (entry.suggestions && i === this.history.length - 1) this.renderSuggestions(entry.suggestions);
        });
        this.bodyEl.scrollTop = this.bodyEl.scrollHeight;
      }

      setTimeout(() => this.inputEl.focus(), 200);
    }

    // ---------- rendering ----------
    escapeHtml(s) {
      return String(s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
    linkify(safeHtml) {
      return safeHtml.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
    }
    renderMessage(role, content) {
      const msg = document.createElement('div');
      msg.className = 'msa-msg msa-msg--' + role;
      msg.innerHTML = this.linkify(this.escapeHtml(content)).replace(/\n/g, '<br>');
      this.bodyEl.appendChild(msg);
    }
    addMessage(role, content, recommendation, suggestions, persist) {
      this.renderMessage(role, content);
      if (recommendation) this.renderRecommendation(recommendation);
      if (suggestions) this.renderSuggestions(suggestions);
      this.bodyEl.scrollTop = this.bodyEl.scrollHeight;

      if (persist !== false) {
        this.history.push({
          role, content,
          recommendation: recommendation || undefined,
          suggestions: suggestions || undefined,
        });
        this.saveState();
      }
    }
    renderRecommendation(rec) {
      if (!rec || !rec.service) return;
      const card = document.createElement('div');
      card.className = 'msa-rec';

      const inclusions = (rec.included || []).map(i => `<li>${this.escapeHtml(i)}</li>`).join('');
      const offerBlock = (rec.service === 'accelerate' && rec.offer)
        ? `<div class="msa-rec__offer"><strong>Book now and save</strong>${this.escapeHtml(rec.offer)}</div>`
        : '';
      const ctaLabel = rec.service === 'accelerate'
        ? 'Book a call and lock it in'
        : (rec.service === 'unsure' ? 'Book a free call' : 'Book a free call');

      card.innerHTML = `
        <span class="msa-rec__badge">${rec.service === 'unsure' ? "Let's talk" : 'Recommended for you'}</span>
        <div class="msa-rec__title">${this.escapeHtml(rec.headline || '')}</div>
        <div class="msa-rec__desc">${this.escapeHtml(rec.reasoning || '')}</div>
        ${rec.price ? `<div class="msa-rec__price">${this.escapeHtml(rec.price)}</div>` : ''}
        ${offerBlock}
        ${inclusions ? `<ul class="msa-rec__list">${inclusions}</ul>` : ''}
        <a class="msa-rec__cta" href="${BOOKING_URL}" target="_blank" rel="noopener">${ctaLabel}</a>
      `;
      this.bodyEl.appendChild(card);

      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({ event: 'sales_agent_recommendation', plan: rec.service });
    }
    clearSuggestions() {
      const existing = this.bodyEl.querySelector('.msa-suggestions');
      if (existing) existing.remove();
    }
    renderSuggestions(suggestions) {
      this.clearSuggestions();
      if (!Array.isArray(suggestions) || suggestions.length === 0) return;
      const wrap = document.createElement('div');
      wrap.className = 'msa-suggestions';
      suggestions.forEach((s) => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'msa-chip';
        chip.textContent = s;
        chip.addEventListener('click', () => this.send(s));
        wrap.appendChild(chip);
      });
      this.bodyEl.appendChild(wrap);
      this.bodyEl.scrollTop = this.bodyEl.scrollHeight;
    }
    addTyping() {
      this.removeTyping();
      const el = document.createElement('div');
      el.className = 'msa-typing';
      el.id = '_msaTyping';
      el.innerHTML = '<span></span><span></span><span></span>';
      this.bodyEl.appendChild(el);
      this.bodyEl.scrollTop = this.bodyEl.scrollHeight;
    }
    removeTyping() {
      const t = document.getElementById('_msaTyping');
      if (t) t.remove();
    }

    // ---------- networking ----------
    async send(overrideText) {
      const text = (overrideText !== undefined ? overrideText : this.inputEl.value.trim()).trim();
      if (!text || this.isSending) return;

      this.clearSuggestions();
      this.addMessage('user', text);
      this.inputEl.value = '';
      this.inputEl.disabled = true;
      this.sendBtn.disabled = true;
      this.isSending = true;
      this.addTyping();

      try {
        const res = await fetch(API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lead: this.lead,
            messages: this.history
              .filter(m => m.role === 'user' || m.role === 'agent')
              .map(m => ({ role: m.role === 'agent' ? 'assistant' : 'user', content: m.content })),
            clickupTaskId: this.clickupTaskId,
          }),
        });

        this.removeTyping();

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          this.addMessage('agent', err.error || "I'm having a bit of a moment. Try again?");
        } else {
          const data = await res.json();
          if (data.clickupTaskId) this.clickupTaskId = data.clickupTaskId;
          this.addMessage('agent', data.reply, data.recommendation, data.suggestions);
        }
      } catch (err) {
        this.removeTyping();
        this.addMessage('agent', "Can't reach our system right now. Check your connection?");
      } finally {
        this.inputEl.disabled = false;
        this.sendBtn.disabled = false;
        this.isSending = false;
        this.inputEl.focus();
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new SalesAgentWidget());
  } else {
    new SalesAgentWidget();
  }
})();
