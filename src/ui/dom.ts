const lastHtml = new WeakMap<Element, string>();

/**
 * Sets innerHTML only when it actually changed, so buttons under the
 * cursor are not replaced mid-click on every tick.
 */
export function setHtml(el: Element, html: string): void {
  if (lastHtml.get(el) === html) return;
  lastHtml.set(el, html);
  el.innerHTML = html;
}
