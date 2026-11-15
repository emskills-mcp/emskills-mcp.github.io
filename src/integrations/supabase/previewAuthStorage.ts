// No longer hosted on Lovable preview domains — always use localStorage.
export function brokeredPreviewStorage() {
  if (typeof window === 'undefined') return undefined;
  return localStorage;
}
