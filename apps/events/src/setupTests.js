// Extends Jest's expect with DOM matchers like toBeInTheDocument(), toBeVisible(), etc.
import '@testing-library/jest-dom';

// Polyfill window.matchMedia for libraries like react-slick that require it
if (typeof window.matchMedia !== 'function') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
}
