import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Without vitest's `globals: true` (which this project deliberately
// doesn't enable), @testing-library/react can't auto-detect a global
// afterEach to hook its DOM cleanup into, so each test would otherwise
// leak the previous test's rendered tree into the next one.
afterEach(cleanup);

// jsdom doesn't implement the Pointer Events / ResizeObserver APIs that
// Radix UI's Select, Dialog, and DropdownMenu primitives rely on for
// positioning and pointer capture. Without these stubs, interacting with
// those components in a component test throws (e.g.
// "target.hasPointerCapture is not a function").
if (!window.HTMLElement.prototype.hasPointerCapture) {
  window.HTMLElement.prototype.hasPointerCapture = () => false;
}
if (!window.HTMLElement.prototype.releasePointerCapture) {
  window.HTMLElement.prototype.releasePointerCapture = () => {};
}
if (!window.HTMLElement.prototype.scrollIntoView) {
  window.HTMLElement.prototype.scrollIntoView = () => {};
}
if (!("ResizeObserver" in window)) {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  // @ts-expect-error jsdom has no ResizeObserver implementation
  window.ResizeObserver = ResizeObserverStub;
}
