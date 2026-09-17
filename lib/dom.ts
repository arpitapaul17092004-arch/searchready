import { parseDocument } from "htmlparser2";
import * as cssSelect from "css-select";
import * as domutils from "domutils";
import type { Element } from "domhandler";

/**
 * Tiny DOM-query wrapper over htmlparser2 + css-select.
 * Pure JavaScript (no WASM dependencies) so it runs anywhere.
 * Exposes just enough selector surface for the analysis engine.
 */
export interface ParsedPage {
  count(selector: string): number;
  textOf(selector: string): string;
  allTexts(selector: string): string[];
  attrOf(selector: string, name: string): string | undefined;
  bodyText(): string;
  remove(selector: string): void;
  exists(selector: string): boolean;
}

export function parsePage(html: string): ParsedPage {
  const doc = parseDocument(html);
  // css-select expects Elements; a Document node itself is not one.
  const roots = doc.children as Element[];

  const select = (selector: string) => cssSelect.selectAll(selector, roots);

  return {
    count(selector) {
      return select(selector).length;
    },
    textOf(selector) {
      const el = select(selector)[0];
      return el
        ? domutils
            .textContent(el)
            .replace(/\s+/g, " ")
            .trim()
        : "";
    },
    allTexts(selector) {
      return select(selector).map((el) =>
        domutils
          .textContent(el)
          .replace(/\s+/g, " ")
          .trim(),
      );
    },
    attrOf(selector, name) {
      const el = select(selector)[0] as Element | undefined;
      return el ? domutils.getAttributeValue(el, name) : undefined;
    },
    bodyText() {
      const body = cssSelect.selectOne("body", roots);
      return body
        ? domutils
            .textContent(body)
            .replace(/\s+/g, " ")
            .trim()
        : "";
    },
    remove(selector) {
      for (const el of select(selector)) domutils.removeElement(el);
    },
    exists(selector) {
      return select(selector).length > 0;
    },
  };
}
