import { onAuthChange, loginWithGoogle, logout } from './auth';
import {
  Tasting, Mode, Entry,
  subscribeTastings, addTasting, updateTasting, deleteTasting,
  entryColor, newId,
} from './tastings';
import {
  MAX_SCORE, rankByScore, scoreComplete, scoreChampion,
  buildBracket, roundLabel, tournamentProgress, BMatch,
} from './compute';
import { renderRankingBars, renderRadar, renderRadarLegend, RadarSeries } from './charts';
import {
  showToast, openOverlay, closeOverlay,
  openConfirmDialog, initConfirmDialog,
  createChipInput, ChipInputController, formatDate,
} from './ui';
import { submitFeedback } from './feedback';

const DEFAULT_AXES = ['味', '香り', 'コスパ', '見た目'];

// ============================================================
// DOM refs
// ============================================================
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

const loginScreen = $('login-screen');
const appEl = $('app');
const userInfo = $('user-info');
const userAvatar = $<HTMLImageElement>('user-avatar');
const userName = $('user-name');
const btnGoogleLogin = $<HTMLButtonElement>('btn-google-login');
const btnLogout = $<HTMLButtonElement>('btn-logout');

const tabNav = $('tab-nav');
const views: Record<string, HTMLElement> = {
  list: $('list-view'),
  create: $('create-view'),
  detail: $('detail-view'),
  champions: $('champions-view'),
};

const sessionListEl = $('session-list');
const listEmpty = $('list-empty');
const btnNew = $<HTMLButtonElement>('btn-new');

const createForm = $<HTMLFormElement>('create-form');
const cTitle = $<HTMLInputElement>('c-title');
const cMemo = $<HTMLTextAreaElement>('c-memo');
const cBlind = $<HTMLInputElement>('c-blind');
const cAxesField = $('c-axes-field');
const cAxesEditor = $('c-axes');
const cEntriesEl = $('c-entries');
const btnAddEntry = $<HTMLButtonElement>('btn-add-entry');
const btnCreateSubmit = $<HTMLButtonElement>('btn-create-submit');
const btnCreateCancel = $<HTMLButtonElement>('btn-create-cancel');
const btnCreateBack = $<HTMLButtonElement>('btn-create-back');

const detailBody = $('detail-body');
const btnDetailBack = $<HTMLButtonElement>('btn-detail-back');

const championListEl = $('champion-list');
const championsEmpty = $('champions-empty');

const settingsOverlay = $('settings-modal-overlay');
const sTitle = $<HTMLInputElement>('s-title');
const sMemo = $<HTMLTextAreaElement>('s-memo');
const btnSettingsSave = $<HTMLButtonElement>('btn-settings-save');
const btnSettingsDelete = $<HTMLButtonElement>('btn-settings-delete');
const btnSettingsClose = $<HTMLButtonElement>('btn-settings-close');

const feedbackBtn = $<HTMLButtonElement>('feedback-btn');
const feedbackOverlay = $('feedback-modal-overlay');
const inputFeedbackMessage = $<HTMLTextAreaElement>('input-feedback-message');
const btnFeedbackClose = $<HTMLButtonElement>('btn-feedback-close');
const btnFeedbackSend = $<HTMLButtonElement>('btn-feedback-send');

// ============================================================
// State
// ============================================================
let currentUid: string | null = null;
let unsub: (() => void) | null = null;
let tastings: Tasting[] = [];
let currentId: string | null = null;
let justCreatedId: string | null = null;

const axesInput: ChipInputController = createChipInput(cAxesEditor, '軸を入力してEnter', 'axis-suggestions');

// ============================================================
// helpers
// ============================================================
function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function entryLabel(t: Tasting, entry: Entry, index: number): string {
  if (t.blind && !t.revealed) return String.fromCharCode(65 + index);
  return entry.name.trim() || `(名前未設定)`;
}

function championOf(t: Tasting): Entry | null {
  return t.mode === 'score' ? scoreChampion(t) : buildBracket(t.entries, t.results).champion;
}

// ============================================================
// Views
// ============================================================
function showView(name: keyof typeof views): void {
  Object.entries(views).forEach(([key, node]) => node.classList.toggle('hidden', key !== name));
  Array.from(tabNav.children).forEach((child) => {
    child.classList.toggle('is-active', (child as HTMLElement).dataset.view === name);
  });
}

tabNav.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest('[data-view]') as HTMLElement | null;
  if (!btn) return;
  const view = btn.dataset.view as keyof typeof views;
  currentId = null;
  showView(view);
});

// ============================================================
// Auth
// ============================================================
onAuthChange((user) => {
  if (unsub) {
    unsub();
    unsub = null;
  }

  if (user) {
    currentUid = user.uid;
    loginScreen.classList.add('hidden');
    appEl.classList.remove('hidden');
    userInfo.classList.remove('hidden');
    userAvatar.src = user.photoURL || '';
    userAvatar.alt = '';
    userName.textContent = user.displayName || user.email || '';

    unsub = subscribeTastings(currentUid, (list) => {
      tastings = list;
      renderAll();
    });
  } else {
    currentUid = null;
    tastings = [];
    currentId = null;
    loginScreen.classList.remove('hidden');
    appEl.classList.add('hidden');
    userInfo.classList.add('hidden');
    showView('list');
  }
});

btnGoogleLogin.addEventListener('click', () => {
  loginWithGoogle().catch((err: Error) => showToast('ログインに失敗しました: ' + err.message));
});
btnLogout.addEventListener('click', () => logout());

// ============================================================
// List view
// ============================================================
function renderList(): void {
  sessionListEl.innerHTML = '';

  if (tastings.length === 0) {
    listEmpty.classList.remove('hidden');
    return;
  }
  listEmpty.classList.add('hidden');

  tastings.forEach((t) => {
    const card = el('div', 'session-card');
    card.dataset.id = t.id;

    const top = el('div', 'session-card__top');
    top.append(el('span', 'session-card__title', t.title || '(無題の比べ会)'));
    top.append(el('span', 'badge badge--mode', t.mode === 'score' ? '点数' : 'トーナメント'));
    if (t.blind) top.append(el('span', 'badge badge--blind', 'ブラインド'));
    top.append(
      el('span', t.status === 'done' ? 'badge badge--done' : 'badge badge--active',
        t.status === 'done' ? '確定' : '進行中'),
    );
    card.append(top);

    if (t.memo.trim()) card.append(el('div', 'session-card__memo', t.memo));

    const foot = el('div', 'session-card__foot');
    foot.append(el('span', undefined, `エントリー ${t.entries.length}`));
    const champ = championOf(t);
    if (champ) {
      const idx = t.entries.findIndex((e) => e.id === champ.id);
      foot.append(el('span', 'session-card__champion', `🏆 ${entryLabel(t, champ, idx)}`));
    }
    if (t.updatedAt) foot.append(el('span', undefined, formatDate(t.updatedAt)));
    card.append(foot);

    sessionListEl.append(card);
  });
}

sessionListEl.addEventListener('click', (e) => {
  const card = (e.target as HTMLElement).closest('.session-card') as HTMLElement | null;
  if (!card || !card.dataset.id) return;
  openDetail(card.dataset.id);
});

btnNew.addEventListener('click', () => openCreate());

// ============================================================
// Create view
// ============================================================
function updateAxesVisibility(): void {
  const mode = (createForm.querySelector('input[name="c-mode"]:checked') as HTMLInputElement)?.value;
  cAxesField.classList.toggle('hidden', mode !== 'score');
}

function makeEntryRow(name = ''): HTMLElement {
  const row = el('div', 'entry-row');
  const dot = el('span', 'entry-row__dot');
  const input = el('input', 'entry-row__input') as HTMLInputElement;
  input.type = 'text';
  input.placeholder = 'エントリー名';
  input.value = name;
  const remove = el('button', 'entry-row__remove', '×') as HTMLButtonElement;
  remove.type = 'button';
  remove.addEventListener('click', () => {
    if (cEntriesEl.children.length <= 2) {
      showToast('エントリーは2つ以上必要です');
      return;
    }
    row.remove();
    recolorEntryRows();
  });
  row.append(dot, input, remove);
  return row;
}

function recolorEntryRows(): void {
  Array.from(cEntriesEl.children).forEach((row, i) => {
    const dot = row.querySelector('.entry-row__dot') as HTMLElement;
    if (dot) dot.style.background = entryColor(i);
  });
}

function openCreate(): void {
  createForm.reset();
  cAxesEditor.querySelectorAll('.chip').forEach((c) => c.remove());
  axesInput.setValues(DEFAULT_AXES);
  cEntriesEl.innerHTML = '';
  for (let i = 0; i < 3; i += 1) cEntriesEl.append(makeEntryRow());
  recolorEntryRows();
  updateAxesVisibility();
  showView('create');
  cTitle.focus();
}

btnAddEntry.addEventListener('click', () => {
  cEntriesEl.append(makeEntryRow());
  recolorEntryRows();
});

createForm.addEventListener('change', (e) => {
  if ((e.target as HTMLInputElement).name === 'c-mode') updateAxesVisibility();
});

btnCreateCancel.addEventListener('click', () => showView('list'));
btnCreateBack.addEventListener('click', () => showView('list'));

createForm.addEventListener('submit', (e) => {
  e.preventDefault();
  if (!currentUid || btnCreateSubmit.disabled) return;

  const title = cTitle.value.trim();
  if (!title) {
    showToast('タイトルを入力してください');
    return;
  }

  const names = Array.from(cEntriesEl.querySelectorAll<HTMLInputElement>('.entry-row__input'))
    .map((inp) => inp.value.trim())
    .filter((v) => v.length > 0);
  if (names.length < 2) {
    showToast('エントリーを2つ以上入力してください');
    return;
  }

  const mode = ((createForm.querySelector('input[name="c-mode"]:checked') as HTMLInputElement)?.value
    || 'score') as Mode;

  let axes: string[] = [];
  if (mode === 'score') {
    axes = axesInput.getValues();
    if (axes.length === 0) {
      showToast('評価軸を1つ以上入力してください');
      return;
    }
  }

  const entries: Entry[] = names.map((name) => ({ id: newId(), name }));

  btnCreateSubmit.disabled = true;
  addTasting(currentUid, { title, memo: cMemo.value.trim(), mode, blind: cBlind.checked, axes, entries })
    .then((id) => {
      justCreatedId = id;
      showToast('比べ会をはじめました');
      openDetail(id);
    })
    .catch((err: Error) => showToast('作成に失敗しました: ' + err.message))
    .finally(() => {
      btnCreateSubmit.disabled = false;
    });
});

// ============================================================
// Detail view
// ============================================================
function openDetail(id: string): void {
  currentId = id;
  showView('detail');
  renderDetail();
}

btnDetailBack.addEventListener('click', () => {
  currentId = null;
  justCreatedId = null;
  showView('list');
});

function renderDetail(): void {
  const t = tastings.find((x) => x.id === currentId);

  if (!t) {
    detailBody.innerHTML = '';
    if (currentId && currentId === justCreatedId) {
      detailBody.append(el('div', 'empty-state', '読み込み中…'));
    } else {
      currentId = null;
      showView('list');
    }
    return;
  }
  justCreatedId = null;
  detailBody.innerHTML = '';

  // --- header ---
  detailBody.append(el('div', 'detail-title', t.title || '(無題の比べ会)'));

  const meta = el('div', 'detail-meta');
  meta.append(el('span', 'badge badge--mode', t.mode === 'score' ? '点数評価' : 'トーナメント'));
  if (t.blind) {
    meta.append(el('span', 'badge badge--blind', t.revealed ? 'ブラインド（公開済み）' : 'ブラインド'));
  }
  meta.append(
    el('span', t.status === 'done' ? 'badge badge--done' : 'badge badge--active',
      t.status === 'done' ? '確定済み' : '進行中'),
  );
  detailBody.append(meta);

  if (t.memo.trim()) detailBody.append(el('div', 'view-intro', t.memo));

  // --- result banner ---
  detailBody.append(renderResultBanner(t));

  // --- body ---
  if (t.mode === 'score') renderScoreBody(t);
  else renderTournamentBody(t);

  // --- actions ---
  detailBody.append(renderDetailActions(t));
}

function renderResultBanner(t: Tasting): HTMLElement {
  const champ = championOf(t);
  const banner = el('div', 'result-banner');

  if (champ) {
    const idx = t.entries.findIndex((e) => e.id === champ.id);
    banner.append(el('div', 'result-banner__label', t.status === 'done' ? '優勝' : '現在の1位'));
    const name = el('div', 'result-banner__name');
    name.append(el('span', undefined, '🏆'));
    name.append(el('span', undefined, entryLabel(t, champ, idx)));
    banner.append(name);
    if (t.blind && !t.revealed) {
      banner.append(el('div', 'result-banner__sub', '「正体を公開する」で名前がわかります'));
    } else if (t.status !== 'done') {
      banner.append(el('div', 'result-banner__sub', '「結果を確定する」で殿堂入りに保存されます'));
    }
    return banner;
  }

  banner.classList.add('result-banner--pending');
  banner.append(el('div', 'result-banner__label', 'RESULT'));
  banner.append(el('div', 'result-banner__name', 'まだ結果は出ていません'));
  if (t.mode === 'score') {
    const total = t.entries.length * t.axes.length;
    let filled = 0;
    t.entries.forEach((e) => t.axes.forEach((ax) => {
      if ((Number(t.scores[e.id]?.[ax]) || 0) > 0) filled += 1;
    }));
    banner.append(el('div', 'result-banner__sub', `採点 ${filled} / ${total}`));
  } else {
    const p = tournamentProgress(buildBracket(t.entries, t.results));
    banner.append(el('div', 'result-banner__sub', `対戦 ${p.done} / ${p.total}`));
  }
  return banner;
}

function renderScoreBody(t: Tasting): void {
  const editable = t.status === 'active';

  t.entries.forEach((entry, index) => {
    const card = el('div', 'score-entry');
    const head = el('div', 'score-entry__head');
    const dot = el('span', 'score-entry__dot');
    dot.style.background = entryColor(index);
    head.append(dot);
    head.append(el('span', 'score-entry__name', entryLabel(t, entry, index)));

    const entryScores = t.scores[entry.id] || {};
    const totalNow = t.axes.reduce((sum, ax) => sum + (Number(entryScores[ax]) || 0), 0);
    head.append(el('span', 'score-entry__total', `${totalNow} 点`));
    card.append(head);

    t.axes.forEach((axis) => {
      const row = el('div', 'axis-row');
      row.append(el('span', 'axis-row__label', axis));
      const dots = el('div', 'dots');
      const current = Number(entryScores[axis]) || 0;
      for (let v = 1; v <= MAX_SCORE; v += 1) {
        const d = el('button', 'dot' + (v <= current ? ' is-on' : ''), String(v)) as HTMLButtonElement;
        d.type = 'button';
        d.disabled = !editable;
        d.dataset.entry = entry.id;
        d.dataset.axis = axis;
        d.dataset.val = String(v);
        dots.append(d);
      }
      row.append(dots);
      card.append(row);
    });

    detailBody.append(card);
  });

  // ranking
  const ranked = rankByScore(t);
  const champ = scoreChampion(t);
  const maxTotal = t.axes.length * MAX_SCORE;
  const rankSection = el('div', 'card');
  rankSection.append(el('div', 'section__title', '暫定ランキング'));
  rankSection.append(el('div', 'view-intro', scoreComplete(t) ? '全エントリーの採点が完了しました。' : '採点した合計点の順です。'));
  rankSection.append(renderRankingBars(ranked.map((item) => ({
    label: entryLabel(t, item.entry, item.index),
    value: item.total,
    max: maxTotal,
    first: !!champ && champ.id === item.entry.id,
  }))));
  detailBody.append(rankSection);

  // radar
  if (t.axes.length >= 3) {
    const series: RadarSeries[] = ranked
      .filter((item) => item.filled > 0)
      .map((item) => ({
        label: entryLabel(t, item.entry, item.index),
        color: entryColor(item.index),
        values: t.axes.map((ax) => item.perAxis[ax] || 0),
      }));
    if (series.length > 0) {
      const radarCard = el('div', 'card');
      radarCard.append(el('div', 'section__title', '軸ごとの比較'));
      const wrap = el('div', 'radar-wrap');
      const svg = renderRadar(t.axes, series, MAX_SCORE);
      if (svg) wrap.append(svg);
      wrap.append(renderRadarLegend(series));
      radarCard.append(wrap);
      detailBody.append(radarCard);
    }
  }
}

function slotEl(t: Tasting, entry: Entry | null, match: BMatch, editable: boolean): HTMLElement {
  if (!entry) {
    return el('div', 'match-slot is-empty', match.decidable ? '—' : '不戦勝');
  }
  const index = t.entries.findIndex((e) => e.id === entry.id);
  const isWinner = match.winner?.id === entry.id;
  const clickable = editable && match.decidable;
  const node = el(
    'div',
    'match-slot' + (isWinner ? ' is-winner' : '') + (clickable ? ' is-clickable' : ''),
  );
  const dot = el('span', 'match-slot__dot');
  dot.style.background = entryColor(index);
  node.append(dot);
  node.append(el('span', 'match-slot__name', entryLabel(t, entry, index)));
  if (clickable) {
    node.dataset.match = match.key;
    node.dataset.entry = entry.id;
  }
  return node;
}

function renderTournamentBody(t: Tasting): void {
  const editable = t.status === 'active';
  const bracket = buildBracket(t.entries, t.results);

  const card = el('div', 'card');
  card.append(el('div', 'section__title', 'トーナメント表'));
  card.append(el('div', 'view-intro', editable ? '勝った方をタップして勝ち上がりを決めます。' : '確定済みの結果です。'));

  const board = el('div', 'bracket');
  bracket.rounds.forEach((matches, r) => {
    const roundEl = el('div', 'bracket-round');
    roundEl.append(el('div', 'bracket-round__title', roundLabel(r, bracket.rounds.length)));
    matches.forEach((m) => {
      const matchEl = el('div', 'match');
      matchEl.append(slotEl(t, m.a, m, editable));
      matchEl.append(slotEl(t, m.b, m, editable));
      roundEl.append(matchEl);
    });
    board.append(roundEl);
  });
  card.append(board);
  detailBody.append(card);
}

function renderDetailActions(t: Tasting): HTMLElement {
  const actions = el('div', 'detail-actions');
  const champ = championOf(t);

  if (t.blind && !t.revealed) {
    const b = el('button', 'btn btn--accent', '🎭 正体を公開する') as HTMLButtonElement;
    b.dataset.action = 'reveal';
    actions.append(b);
  }

  if (t.status === 'active' && champ) {
    const b = el('button', 'btn btn--primary', '🏆 結果を確定する') as HTMLButtonElement;
    b.dataset.action = 'confirm';
    actions.append(b);
  }

  if (t.status === 'done') {
    const b = el('button', 'btn btn--ghost', '編集に戻す') as HTMLButtonElement;
    b.dataset.action = 'reopen';
    actions.append(b);
  }

  if (t.status === 'active') {
    const b = el('button', 'btn btn--ghost', t.mode === 'score' ? '採点をリセット' : '対戦をリセット') as HTMLButtonElement;
    b.dataset.action = 'reset';
    actions.append(b);
  }

  const settings = el('button', 'btn btn--ghost', '設定・削除') as HTMLButtonElement;
  settings.dataset.action = 'settings';
  actions.append(settings);

  return actions;
}

// detail interactions (event delegation)
detailBody.addEventListener('click', (e) => {
  const target = e.target as HTMLElement;
  if (!currentUid || !currentId) return;
  const t = tastings.find((x) => x.id === currentId);
  if (!t) return;

  // score dot
  const dot = target.closest('.dot') as HTMLElement | null;
  if (dot && dot.dataset.entry && dot.dataset.axis && dot.dataset.val) {
    if (t.status !== 'active') return;
    const entryId = dot.dataset.entry;
    const axis = dot.dataset.axis;
    const val = Number(dot.dataset.val);
    const scores = JSON.parse(JSON.stringify(t.scores)) as Tasting['scores'];
    if (!scores[entryId]) scores[entryId] = {};
    scores[entryId][axis] = scores[entryId][axis] === val ? 0 : val;
    updateTasting(currentUid, t.id, { scores }).catch((err: Error) => showToast('保存に失敗: ' + err.message));
    return;
  }

  // bracket slot
  const slot = target.closest('.match-slot.is-clickable') as HTMLElement | null;
  if (slot && slot.dataset.match && slot.dataset.entry) {
    if (t.status !== 'active') return;
    const results = { ...t.results };
    if (results[slot.dataset.match] === slot.dataset.entry) {
      delete results[slot.dataset.match];
    } else {
      results[slot.dataset.match] = slot.dataset.entry;
    }
    updateTasting(currentUid, t.id, { results }).catch((err: Error) => showToast('保存に失敗: ' + err.message));
    return;
  }

  // action buttons
  const btn = target.closest('button[data-action]') as HTMLButtonElement | null;
  if (!btn) return;
  const action = btn.dataset.action;

  if (action === 'reveal') {
    updateTasting(currentUid, t.id, { revealed: true });
  } else if (action === 'confirm') {
    updateTasting(currentUid, t.id, { status: 'done' }).then(() => showToast('結果を確定しました'));
  } else if (action === 'reopen') {
    updateTasting(currentUid, t.id, { status: 'active' });
  } else if (action === 'reset') {
    const isScore = t.mode === 'score';
    openConfirmDialog(
      isScore ? '採点をリセットしますか？' : '対戦をリセットしますか？',
      'これまでの入力内容が消えます。元に戻せません。',
      'リセットする',
      () => {
        updateTasting(currentUid!, t.id, isScore ? { scores: {} } : { results: {} })
          .then(() => showToast('リセットしました'))
          .catch((err: Error) => showToast('失敗: ' + err.message));
      },
    );
  } else if (action === 'settings') {
    openSettings(t);
  }
});

// ============================================================
// Settings modal
// ============================================================
let settingsTargetId: string | null = null;

function openSettings(t: Tasting): void {
  settingsTargetId = t.id;
  sTitle.value = t.title;
  sMemo.value = t.memo;
  openOverlay(settingsOverlay);
}

btnSettingsClose.addEventListener('click', () => closeOverlay(settingsOverlay));

btnSettingsSave.addEventListener('click', () => {
  if (!currentUid || !settingsTargetId) return;
  const title = sTitle.value.trim();
  if (!title) {
    showToast('タイトルを入力してください');
    return;
  }
  updateTasting(currentUid, settingsTargetId, { title, memo: sMemo.value.trim() })
    .then(() => {
      showToast('保存しました');
      closeOverlay(settingsOverlay);
    })
    .catch((err: Error) => showToast('保存に失敗: ' + err.message));
});

btnSettingsDelete.addEventListener('click', () => {
  if (!currentUid || !settingsTargetId) return;
  const id = settingsTargetId;
  openConfirmDialog(
    'この比べ会を削除しますか？',
    '記録が完全に削除されます。元に戻せません。',
    '削除する',
    () => {
      deleteTasting(currentUid!, id)
        .then(() => {
          showToast('削除しました');
          closeOverlay(settingsOverlay);
          currentId = null;
          showView('list');
        })
        .catch((err: Error) => showToast('削除に失敗: ' + err.message));
    },
  );
});

// ============================================================
// Champions view (殿堂入り)
// ============================================================
function renderChampions(): void {
  championListEl.innerHTML = '';
  const done = tastings.filter((t) => t.status === 'done' && championOf(t));

  if (done.length === 0) {
    championsEmpty.classList.remove('hidden');
    return;
  }
  championsEmpty.classList.add('hidden');

  done.forEach((t) => {
    const champ = championOf(t)!;
    const idx = t.entries.findIndex((e) => e.id === champ.id);
    const card = el('div', 'champion-card');
    card.dataset.id = t.id;
    card.append(el('span', 'champion-card__medal', '🏆'));
    const body = el('div');
    body.append(el('div', 'champion-card__theme', t.title || '(無題の比べ会)'));
    body.append(el('div', 'champion-card__name', entryLabel(t, champ, idx)));
    card.append(body);
    if (t.updatedAt) card.append(el('span', 'champion-card__date', formatDate(t.updatedAt)));
    championListEl.append(card);
  });
}

championListEl.addEventListener('click', (e) => {
  const card = (e.target as HTMLElement).closest('.champion-card') as HTMLElement | null;
  if (!card || !card.dataset.id) return;
  openDetail(card.dataset.id);
});

// ============================================================
// Render all
// ============================================================
function renderAll(): void {
  renderList();
  renderChampions();
  if (!views.detail.classList.contains('hidden')) renderDetail();
}

// ============================================================
// Dialogs / feedback
// ============================================================
initConfirmDialog();

feedbackBtn.addEventListener('click', () => {
  inputFeedbackMessage.value = '';
  openOverlay(feedbackOverlay);
});
btnFeedbackClose.addEventListener('click', () => closeOverlay(feedbackOverlay));
btnFeedbackSend.addEventListener('click', () => {
  const message = inputFeedbackMessage.value.trim();
  if (!message || btnFeedbackSend.disabled) return;
  btnFeedbackSend.disabled = true;
  submitFeedback(message)
    .then((ok) => {
      showToast(ok ? '送信しました。ありがとうございます！' : '送信に失敗しました');
      if (ok) closeOverlay(feedbackOverlay);
    })
    .finally(() => {
      btnFeedbackSend.disabled = false;
    });
});

showView('list');
