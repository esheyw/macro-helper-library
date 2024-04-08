import { mhlog } from "./helpers/index.mjs";
import { getFAString, localize, sluggify } from "./helpers/stringHelpers.mjs";

export function registerHandlebarsHelpers() {
  Handlebars.registerHelper("mhlocalize", (value, options) => {
    if (value instanceof Handlebars.SafeString) value = value.toString();
    const data = options.hash;
    return new Handlebars.SafeString(localize(value, data));
  });
  Handlebars.registerHelper("mhlIsColor", (value) => {
    if (value instanceof Handlebars.SafeString) value = value.toString();
    return /^#[a-f0-9]{6}$/i.test(value);
  });
  Handlebars.registerHelper("mhlYesOrNo", (value) => {
    return !!value ? localize("Yes") : localize("No");
  });
  Handlebars.registerHelper("mhlCheckOrX", (value) => {
    const type = !!value ? "check" : "xmark";
    return new Handlebars.SafeString(`<i class="fa-solid fa-square-${type}"></i>`);
  });

  Handlebars.registerHelper("faIcon", (glyph, options) => {
    const { style, sharp, fw } = options.hash;
    const text =
      String(glyph).toLowerCase() +
      (style ? String(style).toLowerCase() : "") +
      (sharp ? String(sharp).toLowerCase() : "") +
      (fw ? String(fw).toLowerCase() : "");
    return new Handlebars.SafeString(getFAString(text));
  });

  function mhlSluggify(value, options = {}) {
    return sluggify(String(value), { camel: options?.hash?.camel ?? null });
  }
  Handlebars.registerHelper("mhlSluggify", mhlSluggify);

  //the following are provided by pf2e at least, maybe other systems; only register if necessary
  if (!("capitalize" in Handlebars.helpers)) {
    Handlebars.registerHelper("capitalize", (value) => String(value).capitalize());
  }
  if (!("sluggify" in Handlebars.helpers)) {
    Handlebars.registerHelper("sluggify", mhlSluggify);
  }
}
