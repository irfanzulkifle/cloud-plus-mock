"use strict";
/* CompTIA Cloud+ CV0-004 — Pearson VUE-style mock exam engine */

const EXAM_DURATION = 90 * 60; // 90 min (real CV0-004)
const PASS_PCT = 750 / 1000;   // CompTIA's published ~75% scaled pass
// Access gate password (for the private batch). Stored as a djb2 hash so it is
// not in cleartext in the source. NOTE: client-side only — blocks casual access,
// not a determined user. Change the password by updating GATE_HASH.
const GATE_HASH = 3784444874; // djb2 hash of 'cloudplus2026' — change via gateHash('newpassword')
function gateHash(s){let h=5381;for(let i=0;i<s.length;i++){h=((h<<5)+h+s.charCodeAt(i))>>>0;}return h;}
const DOMAINS = {
  1: { name: "Cloud Architecture", pct: 23 },
  2: { name: "Deployment", pct: 19 },
  3: { name: "Operations", pct: 17 },
  4: { name: "Security", pct: 19 },
  5: { name: "DevOps Fundamentals", pct: 10 },
  6: { name: "Troubleshooting", pct: 12 },
};

const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

let DATA = [];
let order = [];        // question indices into DATA, in exam order
let state = {         // per-question: selected Set of letters, flagged bool
  sel: [], flagged: [],
};
let pos = 0;           // current position in `order`
let timed = true, reviewMode = true, study = false;
let timeLeft = EXAM_DURATION, timerId = null;
let examStartedAt = 0;

/* ---------- deep-dive block (why correct / why others wrong / objective) ---------- */
function deepdiveHtml(text, label){
  const id = 'dd_' + Math.random().toString(36).slice(2);
  // escape minimal — text is trusted author content, but guard < and &
  const safe = text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  // bold the section headers (WHY / WHY THE OTHER... / DESIGN TRAP / OBJECTIVE)
  const pretty = safe.replace(/^(WHY|WHY THE OTHER OPTIONS ARE WRONG|DESIGN TRAP TO INTERNALIZE|OBJECTIVE)(?=\n)/gm,
    '<b>$1</b>');
  return `<div class="deepdive">
    <div class="deepdive-toggle" onclick="document.getElementById('${id}').parentElement.classList.toggle('open')">
      <span class="chev">▸</span>${label}
    </div>
    <div class="deepdive-body" id="${id}">${pretty}</div>
  </div>`;
}

/* ---------- helpers ---------- */
function shuffle(arr){
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Build an N-question exam whose domain mix mirrors the official CV0-004
// weightings (Architecture 23, Deployment 19, Operations 17, Security 19,
// DevOps 10, Troubleshooting 12). Caps each domain at its available pool.
const OFFICIAL_WEIGHTS = { 1:23, 2:19, 3:17, 4:19, 5:10, 6:12 };
function weightedSample(data, n){
  const byDomain = { 1:[], 2:[], 3:[], 4:[], 5:[], 6:[] };
  data.forEach((q, i) => { if (byDomain[q.domain]) byDomain[q.domain].push(i); });
  const picks = [];
  // proportional allocation, rounded, with leftover reassigned by largest remainder
  let assigned = 0;
  const quota = {};
  let remainder = [];
  Object.keys(OFFICIAL_WEIGHTS).forEach(d => {
    const exact = n * OFFICIAL_WEIGHTS[d] / 100;
    const base = Math.floor(exact);
    quota[d] = Math.min(base, byDomain[d].length);
    assigned += quota[d];
    remainder.push({ d, frac: exact - base });
  });
  // distribute any shortfall (capped domains) to other domains by remainder
  remainder.sort((a, b) => b.frac - a.frac);
  let k = 0;
  while (assigned < n && k < remainder.length){
    const d = remainder[k].d;
    if (quota[d] < byDomain[d].length){ quota[d]++; assigned++; }
    k = (k + 1) % remainder.length;
  }
  Object.keys(quota).forEach(d => {
    picks.push(...shuffle(byDomain[d]).slice(0, quota[d]));
  });
  return shuffle(picks);
}

function fmtTime(s){
  s = Math.max(0, Math.floor(s));
  const m = Math.floor(s / 60), ss = s % 60;
  return `${String(m).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;
}
function answerOf(q){ return (q.answer || '').split(''); }
function isCorrect(q, sel){
  const ans = answerOf(q);
  if (sel.size !== ans.length) return false;
  for (const a of ans) if (!sel.has(a)) return false;
  return true;
}

/* ---------- start exam ---------- */
function beginExam(){
  DATA = (window.EXAM_DATA || []).slice();
  if (!DATA.length){ alert('No exam data loaded (data.js missing?)'); return; }

  const mode = $('#optMode').value;
  study = (mode === 'study');
  timed = !study;          // timed for every mode except Study mode
  reviewMode = true;       // end-of-exam review screen always shown

  let idx = DATA.map((_, i) => i);
  if (mode === 'domain') {
    const d = parseInt($('#optDomain').value, 10);
    idx = idx.filter(i => DATA[i].domain === d);
    if (!idx.length) { alert('No questions matched that domain.'); return; }
  } else if (mode === 'rand90') {
    idx = weightedSample(DATA, 90);
  }

  order = idx;
  state.sel = order.map(() => new Set());
  state.flagged = order.map(() => false);
  pos = 0;
  timeLeft = EXAM_DURATION;
  examStartedAt = Date.now();

  $('#startScreen').classList.remove('active');
  $('#examScreen').classList.add('active');

  buildNavGrid();
  renderQuestion();
  if (timed) startTimer();
}

/* ---------- timer ---------- */
function startTimer(){
  $('#timer').classList.remove('warn');
  timerId = setInterval(() => {
    timeLeft--;
    $('#timer').textContent = fmtTime(timeLeft);
    if (timeLeft <= 60) $('#timer').classList.add('warn');
    if (timeLeft <= 0){
      clearInterval(timerId);
      finishExam();
    }
  }, 1000);
}
function stopTimer(){ if (timerId) clearInterval(timerId); }

/* ---------- render current question ---------- */
function renderQuestion(){
  const q = DATA[order[pos]];
  const sel = state.sel[pos];
  const multi = answerOf(q).length > 1;

  $('#qCounter').textContent = `Question ${pos + 1} of ${order.length}`;
  if ($('#optMode').value === 'domain') {
    const d = q.domain;
    $('#qCounter').textContent += `  ·  ${d}.0 ${q.domainName}`;
  }
  $('#stem').textContent = q.stem;
  // per-question source image (uploaded to question-images/q<number>.<ext>, or
  // embedded as a data URI in window.QIMAGES for the offline standalone build)
  const img = $('#stemImg');
  const n = q.number;
  img.hidden = true;
  img.removeAttribute('src');
  const embedded = (window.QIMAGES && window.QIMAGES[n]);
  if (embedded) {
    img.onload = () => { img.hidden = false; };
    img.onerror = () => { img.hidden = true; };
    img.src = embedded;
  } else {
    const candidates = [`question-images/q${n}.jpg`, `question-images/q${n}.jpeg`, `question-images/q${n}.png`];
    let tried = 0;
    const tryNext = () => {
      if (tried >= candidates.length) { img.hidden = true; img.removeAttribute('src'); return; }
      const src = candidates[tried++];
      img.onload = () => { img.hidden = false; };
      img.onerror = tryNext;
      img.src = src;
    };
    tryNext();
  }
  $('#multiHint').hidden = !multi;
  if (multi) {
    const n = q.choose || 'all';
    $('#multiHint').textContent = n === 'all' ? 'Select all that apply' : `Select ${n}`;
  }

  const wrap = $('#options');
  wrap.innerHTML = '';
  const correctSet = new Set(answerOf(q));
  const showStudy = study && sel.size > 0; // instant feedback once an answer is picked
  Object.keys(q.options).forEach(letter => {
    let cls = 'opt' + (sel.has(letter) ? ' sel' : '');
    if (showStudy){
      if (correctSet.has(letter)) cls += ' is-correct';
      else if (sel.has(letter)) cls += ' is-wrong';
    }
    const div = document.createElement('div');
    div.className = cls;
    div.tabIndex = 0;
    div.setAttribute('role', 'option');
    div.setAttribute('aria-selected', sel.has(letter) ? 'true' : 'false');
    div.onclick = () => toggle(letter);
    div.onkeydown = (ev) => {
      if (ev.key === 'Enter' || ev.key === ' ') { toggle(letter); ev.preventDefault(); }
    };
    div.innerHTML =
      `<div class="obox">${sel.has(letter) ? (multi ? '✓' : letter) : ''}</div>` +
      `<div class="otext"><span class="letter">${letter}.</span>${q.options[letter]}</div>`;
    wrap.appendChild(div);
  });

  // study-mode instant feedback line
  let fb = $('#studyFeedback');
  if (!fb){ fb = document.createElement('div'); fb.id = 'studyFeedback'; fb.className = 'study-feedback'; wrap.parentNode.insertBefore(fb, wrap.nextSibling); }
  if (showStudy){
    const correct = isCorrect(q, sel);
    const yourTxt = [...sel].sort().join(', ');
    const ansTxt = [...correctSet].sort().join(', ');
    fb.className = 'study-feedback ' + (correct ? 'ok' : 'no');
    let html = correct
      ? `<b>✓ Correct!</b>`
      : `<b>✗ Not quite.</b> Correct answer: <b>${ansTxt}</b>` + (yourTxt ? ` &nbsp;·&nbsp; Your answer: ${yourTxt}` : '');
    // per-option explanations: chosen option(s) + any correct option(s) not chosen
    const explLetters = [...new Set([...sel, ...correctSet])].sort();
    const explLines = explLetters.map(letter => {
      const text = q.explanations && q.explanations[letter];
      if (!text) return '';
      const label = correctSet.has(letter) ? `Correct answer (${letter})` : `Your answer (${letter})`;
      return `<div class="study-explain"><b>${label}:</b> ${text}</div>`;
    }).join('');
    if (explLines) html += explLines;
    if (q.deepdive) html += deepdiveHtml(q.deepdive, 'Why this answer is right');
    fb.innerHTML = html;
    fb.style.display = 'block';
  } else {
    fb.style.display = 'none';
  }

  $('#btnFlag').classList.toggle('on', state.flagged[pos]);
  $('#btnFlag').textContent = state.flagged[pos] ? '★ Flagged' : '☆ Flag for review';
  $('#btnPrev').disabled = (pos === 0);
  $('#btnNext').disabled = (pos === order.length - 1);

  updateNavGrid();
  // auto-scroll to top of question panel on mobile
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function toggle(letter){
  const sel = state.sel[pos];
  const multi = answerOf(DATA[order[pos]]).length > 1;
  if (multi){
    if (sel.has(letter)) sel.delete(letter); else sel.add(letter);
  } else {
    sel.clear(); sel.add(letter);
  }
  renderQuestion();
}

/* ---------- navigator ---------- */
function buildNavGrid(){
  const grid = $('#navGrid');
  grid.innerHTML = '';
  order.forEach((_, i) => {
    const c = document.createElement('div');
    c.className = 'navcell';
    c.dataset.pos = i;
    c.textContent = i + 1;
    c.onclick = () => { pos = i; renderQuestion(); };
    grid.appendChild(c);
  });
}
function updateNavGrid(){
  $$('#navGrid .navcell').forEach((c, i) => {
    c.classList.toggle('answered', state.sel[i].size > 0);
    c.classList.toggle('flagged', state.flagged[i]);
    c.classList.toggle('current', i === pos);
  });
}

/* ---------- flag ---------- */
function toggleFlag(){
  state.flagged[pos] = !state.flagged[pos];
  $('#btnFlag').classList.toggle('on', state.flagged[pos]);
  $('#btnFlag').textContent = state.flagged[pos] ? '★ Flagged' : '☆ Flag for review';
  updateNavGrid();
}

/* ---------- nav buttons ---------- */
function nextQ(){ if (pos < order.length - 1){ pos++; renderQuestion(); } }
function prevQ(){ if (pos > 0){ pos--; renderQuestion(); } }

/* ---------- end / review ---------- */
function requestEnd(){
  const answered = state.sel.filter(s => s.size > 0).length;
  const flagged = state.flagged.filter(Boolean).length;
  const blank = order.length - answered;
  if (timed) stopTimer();
  $('#reviewSummary').innerHTML =
    `Total <b>${order.length}</b> · Answered <b>${answered}</b> · ` +
    `Flagged <b>${flagged}</b> · <span style="color:var(--red)">Unanswered ${blank}</span>` +
    (blank > 0 ? `<br><span style="color:var(--red);font-weight:700">⚠ ${blank} question(s) unanswered — you can still go back and answer them, or submit now.</span>` : '');
  const grid = $('#reviewGrid');
  grid.innerHTML = '';
  order.forEach((_, i) => {
    const c = document.createElement('div');
    c.className = 'navcell'
      + (state.sel[i].size > 0 ? ' answered' : '')
      + (state.flagged[i] ? ' flagged' : '');
    c.textContent = i + 1;
    c.onclick = () => { pos = i; show('examScreen'); renderQuestion(); };
    grid.appendChild(c);
  });
  show('reviewScreen');
}
function backToExam(){ show('examScreen'); if (timed) startTimer(); renderQuestion(); }

/* ---------- finish / score ---------- */
function finishExam(){
  stopTimer();
  let correct = 0;
  order.forEach((_, i) => {
    const q = DATA[order[i]];
    if (isCorrect(q, state.sel[i])) correct++;
  });
  const total = order.length;
  const pct = Math.round((correct / total) * 100);
  const passed = (correct / total) >= PASS_PCT;

  $('#pct').textContent = pct;
  $('.score-ring').classList.toggle('fail', !passed);
  $('#passMsg').textContent = passed ? 'Congratulations — Likely Pass' : 'Not yet — Keep studying';
  $('#passMsg').style.color = passed ? 'var(--green)' : 'var(--red)';
  $('#rCorrect').textContent = correct;
  $('#rTotal').textContent = total;
  const used = study ? Math.round((Date.now() - examStartedAt) / 1000) : (EXAM_DURATION - timeLeft);
  $('#rTime').textContent = fmtTime(used);

  // breakdown by multi vs single
  let singleT = 0, singleC = 0, multiT = 0, multiC = 0;
  order.forEach((_, i) => {
    const q = DATA[order[i]];
    if (answerOf(q).length > 1){ multiT++; if (isCorrect(q, state.sel[i])) multiC++; }
    else { singleT++; if (isCorrect(q, state.sel[i])) singleC++; }
  });
  $('#rBreakdown').innerHTML =
    `<div><b>Single-choice:</b> ${singleC}/${singleT} correct</div>` +
    `<div><b>Multi-select:</b> ${multiC}/${multiT} correct</div>` +
    `<div style="margin-top:6px">Real CV0-004 is scaled to 100–900; published pass ≈ 750. ` +
    `This linear % is a study proxy, not the official scale.</div>`;

  $('#examScreen').classList.remove('active');
  $('#reviewScreen').classList.remove('active');
  show('resultScreen');
}

let rwWrong = []; // cached list for current review session: {i, q, sel, correct}
let rwMode = 'wrong'; // 'wrong' = incorrect only, 'all' = every question
let rwDomainFilter = 0; // 0 = all

function reviewWrong(){
  // build a read-only review of every incorrect / blank question, with correct answer + reason shown
  rwMode = 'wrong';
  rwWrong = [];
  order.forEach((_, i) => {
    const q = DATA[order[i]];
    const sel = state.sel[i];
    if (!isCorrect(q, sel)) rwWrong.push({ i, q, sel, correct: false });
  });
  if (!rwWrong.length){ alert('All correct — nice! 🎉'); return; }
  openReview();
}

function reviewAll(){
  // review EVERY question (incl. ones answered correctly) so students see the reasoning even when they guessed right
  rwMode = 'all';
  rwWrong = [];
  order.forEach((_, i) => {
    const q = DATA[order[i]];
    const sel = state.sel[i];
    rwWrong.push({ i, q, sel, correct: isCorrect(q, sel) });
  });
  openReview();
}

function openReview(){
  rwDomainFilter = 0;
  buildRwDomainFilter();
  renderRwList();
  show('reviewWrongScreen');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function buildRwDomainFilter(){
  const wrap = $('#rwDomainFilter');
  wrap.innerHTML = '';
  const present = [...new Set(rwWrong.map(w => w.q.domain).filter(Boolean))].sort();
  if (!present.length){ wrap.hidden = true; return; }
  wrap.hidden = false;

  const allChip = document.createElement('button');
  allChip.type = 'button';
  allChip.className = 'rw-fchip' + (rwDomainFilter === 0 ? ' on' : '');
  allChip.textContent = `All (${rwWrong.length})`;
  allChip.onclick = () => { rwDomainFilter = 0; renderRwList(); };
  wrap.appendChild(allChip);

  present.forEach(d => {
    const n = rwWrong.filter(w => w.q.domain === d).length;
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'rw-fchip' + (rwDomainFilter === d ? ' on' : '');
    chip.textContent = `${d}.0 ${rwWrong.find(w => w.q.domain === d).q.domainName} (${n})`;
    chip.onclick = () => { rwDomainFilter = d; renderRwList(); };
    wrap.appendChild(chip);
  });
}

function renderRwList(){
  buildRwDomainFilter(); // refresh 'on' state
  const items = rwDomainFilter === 0 ? rwWrong : rwWrong.filter(w => w.q.domain === rwDomainFilter);

  const label = rwMode === 'all' ? 'all' : 'incorrect';
  $('#rwCount').textContent = `(${items.length} of ${rwWrong.length} ${label})`;

  // jump nav
  const jump = $('#rwJumpNav');
  jump.innerHTML = '';
  items.forEach(({ i, sel, correct }) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'rw-jbtn' + (sel.size === 0 ? ' blank' : (correct ? ' ok' : ''));
    btn.textContent = i + 1;
    btn.title = sel.size === 0 ? 'Not answered' : (correct ? 'Correct' : 'Incorrect');
    btn.onclick = () => {
      const card = document.querySelector(`.rw-card[data-qi="${i}"]`);
      if (card){ card.classList.remove('collapsed'); card.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    };
    jump.appendChild(btn);
  });

  const list = $('#rwList');
  list.innerHTML = '';

  items.forEach(({ i, q, sel, correct }) => {
    const ans = answerOf(q);
    const correctSet = new Set(ans);
    const isBlank = sel.size === 0;

    const card = document.createElement('div');
    card.className = 'rw-card collapsed';
    card.dataset.qi = i;
    const tag = isBlank ? `<span class="rw-tag blank">Not answered</span>`
      : (correct ? `<span class="rw-tag correct">Correct</span>` : `<span class="rw-tag wrong">Incorrect</span>`);
    const head = document.createElement('div');
    head.className = 'rw-qhead';
    head.innerHTML = `<span class="rw-num">Q${i + 1}</span>` +
      (q.domainName ? `<span class="rw-dom">${q.domain}.0 ${q.domainName}</span>` : '') +
      tag +
      `<span class="rw-chev">▾</span>`;
    head.onclick = () => card.classList.toggle('collapsed');
    card.appendChild(head);

    const bodyEl = document.createElement('div');
    bodyEl.className = 'rw-body';

    const stem = document.createElement('div');
    stem.className = 'rw-stem';
    stem.textContent = q.stem;
    bodyEl.appendChild(stem);

    const opts = document.createElement('div');
    opts.className = 'rw-opts';
    Object.keys(q.options).forEach(letter => {
      const row = document.createElement('div');
      const isCorrectOpt = correctSet.has(letter);
      const isYourOpt = sel.has(letter);
      let cls = 'rw-opt';
      if (isCorrectOpt) cls += ' correct';
      else if (isYourOpt) cls += ' yours';
      row.className = cls;
      const mark = isCorrectOpt ? '✓' : (isYourOpt ? '✗' : '');
      const expl = q.explanations && q.explanations[letter]
        ? `<div class="rw-explain">${q.explanations[letter]}</div>` : '';
      row.innerHTML = `<div style="display:flex;gap:10px;align-items:flex-start">` +
        `<span class="rw-mark">${mark}</span><span class="rw-letter">${letter}.</span>` +
        `<div style="flex:1"><span>${q.options[letter]}</span>${expl}</div></div>`;
      opts.appendChild(row);
    });
    bodyEl.appendChild(opts);

    const ansLine = document.createElement('div');
    ansLine.className = 'rw-answer';
    const yourTxt = isBlank ? '<em>not answered</em>' : [...sel].sort().join(', ');
    ansLine.innerHTML = `<b>Correct answer:</b> ${ans.join(', ')}` +
      (isBlank ? '' : ` &nbsp;·&nbsp; <b>Your answer:</b> <span class="rw-yours">${yourTxt}</span>`);
    bodyEl.appendChild(ansLine);

    if (q.deepdive) {
      const dd = document.createElement('div');
      dd.innerHTML = deepdiveHtml(q.deepdive, 'Why this answer is right');
      bodyEl.appendChild(dd.firstChild);
    }

    card.appendChild(bodyEl);
    list.appendChild(card);
  });
}

/* ---------- theme ---------- */
function applyTheme(theme){
  document.documentElement.setAttribute('data-theme', theme);
  const isDark = theme === 'dark';
  const label = isDark ? '☀️ Light' : '🌙 Dark';
  $('#themeToggle').textContent = label;
  $('#themeToggle2').textContent = isDark ? '☀️' : '🌙';
  try { localStorage.setItem('cloudplus-theme', theme); } catch(e){}
}
function toggleTheme(){
  const cur = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  applyTheme(cur === 'dark' ? 'light' : 'dark');
}

/* ---------- screen switch ---------- */
function show(id){
  $$('.screen').forEach(s => s.classList.remove('active'));
  $('#' + id).classList.add('active');
}
/* ---------- wire up ---------- */
/* ---------- domain picker (By domain mode) ---------- */
function buildDomainChips() {
  const wrap = $('#domainChips');
  wrap.innerHTML = '';
  Object.keys(DOMAINS).forEach(k => {
    const d = parseInt(k, 10);
    const count = (window.EXAM_DATA || []).filter(q => q.domain === d).length;
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip' + (d === parseInt($('#optDomain').value, 10) ? ' on' : '');
    chip.innerHTML = `<b>${d}.0</b> ${DOMAINS[d].name} <span class="chipcount">${count} Q</span>`;
    chip.onclick = () => {
      $('#optDomain').value = String(d);
      $$('#domainChips .chip').forEach(c => c.classList.remove('on'));
      chip.classList.add('on');
    };
    wrap.appendChild(chip);
  });
}

window.addEventListener('DOMContentLoaded', () => {
  $('#btnBegin').onclick = beginExam;
  $('#btnEnd').onclick = requestEnd;
  $('#btnFlag').onclick = toggleFlag;
  $('#btnNext').onclick = nextQ;
  $('#btnPrev').onclick = prevQ;
  $('#btnBack').onclick = backToExam;
  $('#btnSubmit').onclick = finishExam;
  $('#btnRestart').onclick = () => { show('startScreen'); stopTimer(); };
  $('#btnReviewWrong').onclick = reviewWrong;
  $('#btnReviewAll').onclick = reviewAll;
  $('#btnRwBack').onclick = () => show('resultScreen');
  $('#btnRwNew').onclick = () => { show('startScreen'); stopTimer(); };
  $('#btnRwExpandAll').onclick = () => $$('.rw-card').forEach(c => c.classList.remove('collapsed'));
  $('#btnRwCollapseAll').onclick = () => $$('.rw-card').forEach(c => c.classList.add('collapsed'));

  // ---------- ACCESS GATE (private batch) ----------
  const gate = $('#gate');
  const gatePass = $('#gatePass');
  const gateBtn = $('#gateBtn');
  const gateErr = $('#gateErr');
  const unlock = () => {
    if (gateHash(gatePass.value) === GATE_HASH) {
      try { sessionStorage.setItem('cloudplus-unlocked', '1'); } catch(e){}
      gate.classList.add('hidden');
    } else {
      gateErr.hidden = false;
      gatePass.value = '';
      gatePass.focus();
    }
  };
  // remember unlock for this tab session
  let already = false;
  try { already = sessionStorage.getItem('cloudplus-unlocked') === '1'; } catch(e){}
  if (already) gate.classList.add('hidden');
  gateBtn.onclick = unlock;
  gatePass.addEventListener('keydown', (e) => { if (e.key === 'Enter') { unlock(); e.preventDefault(); } });
  if (!already) gatePass.focus();

  // theme toggle (persisted)
  $('#themeToggle').onclick = toggleTheme;
  $('#themeToggle2').onclick = toggleTheme;

  // keyboard shortcuts help panel (on exam screen)
  $('#btnHelp').onclick = () => $('#kbdHelp').hidden = !$('#kbdHelp').hidden;
  $('#btnHelpClose').onclick = () => $('#kbdHelp').hidden = true;
  let saved = 'light';
  try { saved = localStorage.getItem('cloudplus-theme') || 'light'; } catch(e){}
  applyTheme(saved);

  // show/hide domain picker based on mode
  const modeSel = $('#optMode');
  const toggleDomainPicker = () => {
    $('#domainPicker').hidden = (modeSel.value !== 'domain');
  };
  modeSel.addEventListener('change', toggleDomainPicker);
  buildDomainChips();

  // keyboard: A-F/1-9 select option, ArrowUp/Down move focus, ArrowLeft/Right change question,
  // F flag, Enter selects focused option
  document.addEventListener('keydown', (e) => {
    if (!$('#examScreen').classList.contains('active')) return;
    const q = DATA[order[pos]];
    const letters = Object.keys(q.options);
    const opts = $$('#options .opt');
    const focusedIdx = opts.findIndex(o => o === document.activeElement);

    const key = e.key.toUpperCase();
    if (/^[A-F]$/.test(key) && letters.includes(key)) {
      toggle(key); e.preventDefault(); return;
    }
    if (/^[1-9]$/.test(e.key) && parseInt(e.key,10) <= letters.length) {
      toggle(letters[parseInt(e.key,10) - 1]); e.preventDefault(); return;
    }
    if (e.key === 'ArrowDown') {
      if (focusedIdx >= 0 && focusedIdx < opts.length - 1) opts[focusedIdx + 1].focus();
      else if (focusedIdx < 0 && opts.length) opts[0].focus();
      e.preventDefault(); return;
    }
    if (e.key === 'ArrowUp') {
      if (focusedIdx > 0) opts[focusedIdx - 1].focus();
      else if (focusedIdx < 0 && opts.length) opts[opts.length - 1].focus();
      e.preventDefault(); return;
    }
    if (e.key === 'ArrowRight') { nextQ(); e.preventDefault(); return; }
    if (e.key === 'ArrowLeft') { prevQ(); e.preventDefault(); return; }
    if (key === 'F') { toggleFlag(); e.preventDefault(); return; }
    if (e.key === 'Enter' && focusedIdx >= 0) {
      const letter = letters[focusedIdx];
      toggle(letter); e.preventDefault(); return;
    }
  });
});
