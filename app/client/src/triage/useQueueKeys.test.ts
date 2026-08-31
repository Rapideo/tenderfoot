// @vitest-environment jsdom
import { afterEach, expect, test, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { createElement } from "react";
import { useQueueKeys } from "./useQueueKeys";

/* No global cleanup exists in this repo (vitest.config.ts has no
 * setupFiles), so each mount()'s window "keydown" listener -- and its
 * rendered <textarea> -- survives past the test unless this file tears it
 * down itself. Left unhandled, a second test's getByLabelText("Reason")
 * would throw on finding two matching textareas, not on the thing the test
 * actually names. `cleanup()` unmounts every render(), which runs React's
 * effect-cleanup (removeEventListener) for that mount. */
afterEach(cleanup);

function mount(handlers: Parameters<typeof useQueueKeys>[0]) {
  const Probe = () => {
    useQueueKeys(handlers);
    return createElement("textarea", { "aria-label": "Reason" });
  };
  return render(createElement(Probe));
}

function press(key: string, target: EventTarget = document.body) {
  target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
}

test("i marks interested, p passes, u undoes, enter opens", () => {
  const h = {
    onInterested: vi.fn(), onPass: vi.fn(), onUndo: vi.fn(), onOpen: vi.fn(),
  };
  mount(h);
  press("i");
  press("p");
  press("u");
  press("Enter");
  expect(h.onInterested).toHaveBeenCalledOnce();
  expect(h.onPass).toHaveBeenCalledOnce();
  expect(h.onUndo).toHaveBeenCalledOnce();
  expect(h.onOpen).toHaveBeenCalledOnce();
});

/* The reason box is a text field on the same screen as single-letter
 * shortcuts. Typing "pass on this" must not fire Pass four times. */
test("typing in the reason box does not trigger shortcuts", () => {
  const h = {
    onInterested: vi.fn(), onPass: vi.fn(), onUndo: vi.fn(), onOpen: vi.fn(),
  };
  const { getByLabelText } = mount(h);
  press("p", getByLabelText("Reason"));
  expect(h.onPass).not.toHaveBeenCalled();
});

test("a modified key is the browser's, not ours", () => {
  const h = {
    onInterested: vi.fn(), onPass: vi.fn(), onUndo: vi.fn(), onOpen: vi.fn(),
  };
  mount(h);
  document.body.dispatchEvent(
    new KeyboardEvent("keydown", { key: "p", metaKey: true, bubbles: true }),
  );
  expect(h.onPass).not.toHaveBeenCalled();
});
