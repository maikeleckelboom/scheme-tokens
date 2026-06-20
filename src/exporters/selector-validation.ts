import { parse } from "css-tree";

export function isValidCssSelector(selector: string): boolean {
  if (selector.trim() !== selector || selector.length === 0) return false;
  if (/[{};]/u.test(selector)) return false;

  try {
    parse(selector, { context: "selector" });
    return true;
  } catch {
    return false;
  }
}
