export const storage = {
  get(key: string) {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(key);
  },
  set(key: string, value: string) {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(key, value);
  },
  remove(key: string) {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(key);
  },
};
