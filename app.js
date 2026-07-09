"use strict";
/* CompTIA Cloud+ CV0-004 — Pearson VUE-style mock exam engine */

const EXAM_DURATION = 90 * 60; // 90 min (real CV0-004)
const PASS_PCT = 750 / 1000;   // CompTIA's published ~75% scaled pass
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

/* ---------- helpers ---------- */
function shuffle(arr){
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
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
  timed = $('#optTimed').checked && !study;
  reviewMode = $('#optReview').checked;

  let idx = DATA.map((_, i) => i);
  if (mode === 'domain') {
    const d = parseInt($('#optDomain').value, 10);
    idx = idx.filter(i => DATA[i].domain === d);
    if (!idx.length) { alert('No questions matched that domain.'); return; }
  } else if (mode === 'rand50') idx = shuffle(idx).slice(0, 50);
  else if (mode === 'rand100') idx = shuffle(idx).slice(0, 100);

  order = idx;
  state.sel = order.map(() => new Set());
  state.flagged = order.map(() => false);
  pos = 0;
  timeLeft = EXAM_DURATION;
  examStartedAt = Date.now();

  $('#qTotal').textContent = DATA.length;
  $('#qMulti').textContent = DATA.filter(q => answerOf(q).length > 1).length;

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
  $('#multiHint').hidden = !multi;
  if (multi) {
    const n = q.choose || 'all';
    $('#multiHint').textContent = n === 'all' ? 'Select all that apply' : `Select ${n}`;
  }

  const wrap = $('#options');
  wrap.innerHTML = '';
  Object.keys(q.options).forEach(letter => {
    const div = document.createElement('div');
    div.className = 'opt' + (sel.has(letter) ? ' sel' : '');
    div.onclick = () => toggle(letter);
    div.innerHTML =
      `<div class="obox">${sel.has(letter) ? (multi ? '✓' : letter) : ''}</div>` +
      `<div class="otext"><span class="letter">${letter}.</span>${q.options[letter]}</div>`;
    wrap.appendChild(div);
  });

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

function reviewWrong(){
  // build a read-only review of every incorrect / blank question, with correct answer shown
  const wrong = [];
  order.forEach((_, i) => {
    const q = DATA[order[i]];
    const sel = state.sel[i];
    if (!isCorrect(q, sel)) wrong.push({ i, q, sel });
  });
  if (!wrong.length){ alert('All correct — nice! 🎉'); return; }

  $('#rwCount').textContent = `(${wrong.length} question${wrong.length > 1 ? 's' : ''})`;
  const list = $('#rwList');
  list.innerHTML = '';

  wrong.forEach(({ i, q, sel }) => {
    const ans = answerOf(q);
    const correctSet = new Set(ans);
    const isBlank = sel.size === 0;

    const card = document.createElement('div');
    card.className = 'rw-card';

    const head = document.createElement('div');
    head.className = 'rw-qhead';
    head.innerHTML = `<span class="rw-num">Q${i + 1}</span>` +
      (q.domainName ? `<span class="rw-dom">${q.domain}.0 ${q.domainName}</span>` : '') +
      (isBlank ? `<span class="rw-tag blank">Not answered</span>` : `<span class="rw-tag wrong">Incorrect</span>`);
    card.appendChild(head);

    const stem = document.createElement('div');
    stem.className = 'rw-stem';
    stem.textContent = q.stem;
    card.appendChild(stem);

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
      row.innerHTML = `<span class="rw-mark">${mark}</span><span class="rw-letter">${letter}.</span><span>${q.options[letter]}</span>`;
      opts.appendChild(row);
    });
    card.appendChild(opts);

    const ansLine = document.createElement('div');
    ansLine.className = 'rw-answer';
    const yourTxt = isBlank ? '<em>not answered</em>' : [...sel].sort().join(', ');
    ansLine.innerHTML = `<b>Correct answer:</b> ${ans.join(', ')}` +
      (isBlank ? '' : ` &nbsp;·&nbsp; <b>Your answer:</b> <span class="rw-yours">${yourTxt}</span>`);
    card.appendChild(ansLine);

    list.appendChild(card);
  });

  show('reviewWrongScreen');
  window.scrollTo({ top: 0, behavior: 'smooth' });
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
  $('#btnRwBack').onclick = () => show('resultScreen');
  $('#btnRwNew').onclick = () => { show('startScreen'); stopTimer(); };

  // show/hide domain picker based on mode
  const modeSel = $('#optMode');
  const toggleDomainPicker = () => {
    $('#domainPicker').hidden = (modeSel.value !== 'domain');
  };
  modeSel.addEventListener('change', toggleDomainPicker);
  buildDomainChips();

  // keyboard: 1-9/A-F select, arrows navigate, F flag
  document.addEventListener('keydown', (e) => {
    if (!$('#examScreen').classList.contains('active')) return;
    const q = DATA[order[pos]];
    const letters = Object.keys(q.options);
    const key = e.key.toUpperCase();
    if (letters.includes(key)) { toggle(key); e.preventDefault(); }
    else if (e.key === 'ArrowRight') { nextQ(); e.preventDefault(); }
    else if (e.key === 'ArrowLeft') { prevQ(); e.preventDefault(); }
    else if (key === 'F') { toggleFlag(); e.preventDefault(); }
  });
});
