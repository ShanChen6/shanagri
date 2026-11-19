const storageKey = 'shanagri.lastReceipt.v1';
export const lookupTokenPattern = /^[a-f0-9]{64}$/;
type SavedReceipt = { batch: string; token: string };

export function lastReceipt(): SavedReceipt | null {
  try {
    const raw = window.sessionStorage.getItem(storageKey);
    if (!raw) return null;
    const item = JSON.parse(raw);
    return typeof item?.batch === 'string' && typeof item.token === 'string' &&
      lookupTokenPattern.test(item.token) ? item : null;
  } catch {
    return null;
  }
}

export function rememberReceipt(receipt: SavedReceipt) {
  try {
    window.sessionStorage.setItem(storageKey, JSON.stringify(receipt));
  } catch {
    // The link remains usable when storage is unavailable.
  }
}

export function forgetReceipt(token: string): boolean {
  if (lastReceipt()?.token !== token) return true;
  try {
    window.sessionStorage.removeItem(storageKey);
    return true;
  } catch {
    return false;
  }
}
