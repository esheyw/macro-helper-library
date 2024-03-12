import { localize } from "./helpers/stringHelpers.mjs";

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
    const type = !!value ? 'check' : 'xmark';
    return new Handlebars.SafeString(`<i class="fa-solid fa-square-${type}"></i>`)
  });  
}
