import {
  PrefNote, Verdict, subscribePrefNotes, addPrefNote, updatePrefNote, deletePrefNote,
  MAX_PREF_NOTES, MAX_PREF_SUBJECT,
} from './prefnotes';

// 「好みノート」の画面部分。4つの好み系アプリで共通に使う（index.html の #prefnote-section とセットで動く）

export interface PrefNotesDeps {
  showToast: (message: string) => void;
  /** 削除などの確認（ブラウザ標準のconfirmではなく各アプリのカスタムダイアログ） */
  confirmDelete: (title: string, text: string, onConfirm: () => void) => void;
  /** false にすると、セクションの表示・非表示を呼び出し側（タブ切り替えなど）に任せる。既定は true（ログイン中だけ表示） */
  manageVisibility?: boolean;
}

export interface PrefNotesApi {
  /** ログイン状態が変わったときに呼ぶ（null でログアウト） */
  setUser: (uid: string | null) => void;
  /** 判断した場面から、対象を入れた状態で入力欄を開く */
  start: (subject: string) => void;
}

const svg = (inner: string): string =>
  `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
const HEART = svg('<path d="M32 54C14 42 8 33 8 23c0-7 5-12 12-12 5 0 9 3 12 8 3-5 7-8 12-8 7 0 12 5 12 12 0 10-6 19-24 31z"/>');
const SAD = svg('<circle cx="32" cy="32" r="22"/><circle cx="24" cy="27" r="2" fill="currentColor" stroke="none"/><circle cx="40" cy="27" r="2" fill="currentColor" stroke="none"/><path d="M23 44 Q32 36 41 44"/>');
/** 「好みをメモ」ボタン用のペンのアイコン */
export const PREF_PEN_ICON = svg('<path d="M40 12 L52 24 L24 52 H12 V40 Z"/><path d="M34 18 L46 30"/>');

const VERDICT_LABEL: Record<Verdict, string> = { like: '好き', dislike: '苦手' };

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export function initPrefNotes(deps: PrefNotesDeps): PrefNotesApi {
  const $ = (id: string): HTMLElement => {
    const el = document.getElementById(id);
    if (!el) throw new Error(`#${id} が見つかりません`);
    return el;
  };
  const sectionEl = $('prefnote-section');
  const formEl = $('pref-form') as HTMLFormElement;
  const verdictEl = $('pref-verdict');
  const subjectInput = $('pref-subject-input') as HTMLInputElement;
  const textInput = $('pref-text-input') as HTMLTextAreaElement;
  const submitBtn = $('pref-submit-btn') as HTMLButtonElement;
  const cancelBtn = $('pref-cancel-btn');
  const filterEl = $('pref-filter');
  const listEl = $('pref-list');
  const emptyEl = $('pref-empty-state');

  const manageVisibility = deps.manageVisibility !== false;
  let uid: string | null = null;
  let unsubscribe: (() => void) | null = null;
  let notes: PrefNote[] = [];
  let filter: 'all' | Verdict = 'all';
  let verdict: Verdict = 'like';
  let editingId: string | null = null;
  let submitting = false;

  function setVerdict(next: Verdict): void {
    verdict = next;
    verdictEl.querySelectorAll<HTMLElement>('.pref-verdict__btn').forEach((btn) => {
      const on = btn.dataset.verdict === next;
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-pressed', String(on));
    });
  }

  function resetForm(): void {
    editingId = null;
    formEl.reset();
    setVerdict('like');
    submitBtn.textContent = 'ノートに追加';
    cancelBtn.classList.add('hidden');
  }

  function formatDate(note: PrefNote): string {
    const d = note.createdAt?.toDate();
    return d ? `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}` : '';
  }

  function render(): void {
    const counts = {
      all: notes.length,
      like: notes.filter((n) => n.verdict === 'like').length,
      dislike: notes.filter((n) => n.verdict === 'dislike').length,
    };
    filterEl.querySelectorAll<HTMLElement>('.pref-filter__btn').forEach((btn) => {
      const key = btn.dataset.filter as 'all' | Verdict;
      btn.classList.toggle('is-active', key === filter);
      btn.setAttribute('aria-pressed', String(key === filter));
      const countEl = btn.querySelector<HTMLElement>('.pref-filter__count');
      if (countEl) countEl.textContent = String(counts[key]);
    });

    const list = notes.filter((n) => filter === 'all' || n.verdict === filter);
    if (list.length === 0) {
      listEl.innerHTML = '';
      emptyEl.textContent = notes.length === 0
        ? 'まだ好みノートがありません。好き・苦手がわかったら書き留めましょう。'
        : `「${VERDICT_LABEL[filter as Verdict]}」のメモはまだありません。`;
      emptyEl.classList.remove('hidden');
      return;
    }
    emptyEl.classList.add('hidden');

    listEl.innerHTML = list.map((note) => `
      <div class="pref-card pref-card--${note.verdict}" data-pref-id="${note.id}">
        <div class="pref-card__icon">${note.verdict === 'like' ? HEART : SAD}</div>
        <div class="pref-card__main">
          <div class="pref-card__title"><span class="pref-badge pref-badge--${note.verdict}">${VERDICT_LABEL[note.verdict]}</span>${note.subject ? ` ${escapeHtml(note.subject)}` : ''}</div>
          <div class="pref-card__text">${escapeHtml(note.text)}</div>
          <div class="pref-card__date">${formatDate(note)}</div>
        </div>
        <button type="button" class="pref-card__btn" data-edit-pref="${note.id}" aria-label="編集">${PREF_PEN_ICON}</button>
        <button type="button" class="pref-card__btn pref-card__btn--delete" data-delete-pref="${note.id}" aria-label="削除">&times;</button>
      </div>
    `).join('');
  }

  function startEditing(note: PrefNote): void {
    editingId = note.id;
    setVerdict(note.verdict);
    subjectInput.value = note.subject;
    textInput.value = note.text;
    submitBtn.textContent = '更新する';
    cancelBtn.classList.remove('hidden');
    formEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    textInput.focus({ preventScroll: true });
  }

  verdictEl.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('.pref-verdict__btn');
    if (btn?.dataset.verdict) setVerdict(btn.dataset.verdict as Verdict);
  });

  filterEl.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('.pref-filter__btn');
    if (!btn?.dataset.filter) return;
    filter = btn.dataset.filter as 'all' | Verdict;
    render();
  });

  listEl.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const editId = target.closest<HTMLElement>('[data-edit-pref]')?.dataset.editPref;
    if (editId) {
      const note = notes.find((n) => n.id === editId);
      if (note) startEditing(note);
      return;
    }
    const noteId = target.closest<HTMLElement>('[data-delete-pref]')?.dataset.deletePref;
    if (!noteId || !uid) return;
    deps.confirmDelete('好みノートを削除しますか？', 'この操作は取り消せません。', () => {
      if (!uid) return;
      deletePrefNote(uid, noteId)
        .then(() => {
          if (editingId === noteId) resetForm();
        })
        .catch(() => deps.showToast('削除に失敗しました'));
    });
  });

  cancelBtn.addEventListener('click', resetForm);

  formEl.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!uid || submitting) return;
    const text = textInput.value.trim();
    if (!text) {
      deps.showToast('好みのメモを入力してください');
      textInput.focus();
      return;
    }
    if (!editingId && notes.length >= MAX_PREF_NOTES) {
      deps.showToast(`好みノートは${MAX_PREF_NOTES}件まで登録できます`);
      return;
    }
    submitting = true;
    submitBtn.disabled = true;
    const note = { verdict, subject: subjectInput.value.trim(), text };
    try {
      if (editingId) {
        await updatePrefNote(uid, editingId, note);
        deps.showToast('好みノートを更新しました');
      } else {
        await addPrefNote(uid, note);
        deps.showToast('好みノートに追加しました');
      }
      resetForm();
    } catch {
      deps.showToast('保存に失敗しました');
    } finally {
      submitting = false;
      submitBtn.disabled = false;
    }
  });

  return {
    setUser(nextUid) {
      unsubscribe?.();
      unsubscribe = null;
      uid = nextUid;
      notes = [];
      resetForm();
      if (!nextUid) {
        if (manageVisibility) sectionEl.classList.add('hidden');
        render();
        return;
      }
      if (manageVisibility) sectionEl.classList.remove('hidden');
      unsubscribe = subscribePrefNotes(nextUid, (list) => {
        notes = list;
        render();
      });
    },
    start(subject) {
      resetForm();
      subjectInput.value = subject.trim().slice(0, MAX_PREF_SUBJECT);
      formEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      textInput.focus({ preventScroll: true });
    },
  };
}
