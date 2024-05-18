import { IconFontsHandler } from "./IconFontsHandler.mjs";

export const DEFAULT_CONFIG = {};
Object.defineProperty(DEFAULT_CONFIG, "iconFonts", {
  writable: false,
  configurable: false,
  value: new Proxy(new Array(), new IconFontsHandler()),
});
