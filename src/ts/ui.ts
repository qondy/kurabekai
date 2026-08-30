// ============================================================
// Toast / overlay
// ============================================================
export function showToast(message: string): void {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('is-visible');
  window.setTimeout(() => toast.classList.remove('is-visible'), 2200);
}

export function openOverlay(overlay: HTMLElement): void {
  overlay.classList.add('is-open');
}

export function closeOverlay(overlay: HTMLElement): void {
  overlay.classList.remove('is-open');
}

// ============================================================
// 汎用の確認ダイアログ（confirm() の代わり）
// ============================================================
let confirmAction: (() => void) | null = null;

export function openConfirmDialog(title: string, text: string, confirmLabel: string, onConfirm: () => void): void {
  const overlay = document.getElementById('confirm-dialog-overlay') as HTMLElement;
  const titleEl = document.getElementById('confirm-dialog-title') as HTMLElement;
  const textEl = document.getElementById('confirm-dialog-text') as HTMLElement;
  const okBtn = document.getElementById('btn-confirm-ok') as HTMLButtonElement;
  titleEl.textContent = title;
  textEl.textContent = text;
  okBtn.textContent = confirmLabel;
  confirmAction = onConfirm;
  openOverlay(overlay);
}

export function initConfirmDialog(): void {
  const overlay = document.getElementById('confirm-dialog-overlay') as HTMLElement;
  const cancelBtn = document.getElementById('btn-confirm-cancel') as HTMLButtonElement;
  const okBtn = document.getElementById('btn-confirm-ok') as HTMLButtonElement;

  cancelBtn.addEventListener('click', () => {
    confirmAction = null;
    closeOverlay(overlay);
  });

  okBtn.addEventListener('click', () => {
    const action = confirmAction;
    confirmAction = null;
    closeOverlay(overlay);
    action?.();
  });
}

// ============================================================
// 簡易チップ入力（評価軸の編集）
// ============================================================
export interface ChipInputController {
  getValues(): string[];
  setValues(values: string[]): void;
}

export function createChipInput(
  container: HTMLElement,
  placeholder: string,
  datalistId?: string,
): ChipInputController {
  let values: string[] = [];

  const field = document.createElement('input');
  field.type = 'text';
  field.className = 'chip-editor__field';
  field.placeholder = placeholder;
  if (datalistId) field.setAttribute('list', datalistId);

  function render(): void {
    container.querySelectorAll('.chip').forEach((el) => el.remove());
    values.forEach((value) => {
      const chip = document.createElement('span');
      chip.className = 'chip';
      const label = document.createElement('span');
      label.textContent = value;
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'chip__remove';
      remove.textContent = '×';
      remove.addEventListener('click', () => {
        values = values.filter((v) => v !== value);
        render();
      });
      chip.append(label, remove);
      container.insertBefore(chip, field);
    });
  }

  function addValue(raw: string): void {
    const trimmed = raw.trim();
    if (!trimmed || values.includes(trimmed)) return;
    values = [...values, trimmed];
    render();
  }

  field.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addValue(field.value);
      field.value = '';
    } else if (e.key === 'Backspace' && field.value === '' && values.length > 0) {
      values = values.slice(0, -1);
      render();
    }
  });
  field.addEventListener('blur', () => {
    if (field.value.trim()) {
      addValue(field.value);
      field.value = '';
    }
  });

  container.append(field);
  render();

  return {
    getValues: () => values,
    setValues: (next: string[]) => {
      values = [...next];
      render();
    },
  };
}

// ============================================================
// 日付整形
// ============================================================
export function formatDate(ts: { toDate: () => Date } | null): string {
  if (!ts) return '';
  const d = ts.toDate();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;
}
