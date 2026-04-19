import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

class ResizeObserverMock {
  observe() {}

  unobserve() {}

  disconnect() {}
}

vi.stubGlobal('ResizeObserver', ResizeObserverMock);

Object.defineProperty(window.HTMLElement.prototype, 'scrollIntoView', {
  value: vi.fn(),
  writable: true,
});

const storage = (() => {
  const values = new Map<string, string>();

  return {
    getItem(key: string) {
      return values.has(key) ? values.get(key)! : null;
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
    removeItem(key: string) {
      values.delete(key);
    },
    clear() {
      values.clear();
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: storage,
  writable: true,
});
