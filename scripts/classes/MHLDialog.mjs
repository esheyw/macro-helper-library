import { LABELABLE_TAGS, fu } from "../constants.mjs";
import { MHLError, localizedBanner, mhlog, log, isEmpty } from "../helpers/errorHelpers.mjs";
import { localize } from "../helpers/stringHelpers.mjs";
import { htmlQuery, htmlQueryAll } from "../helpers/DOMHelpers.mjs";
const PREFIX = "MHL.Dialog";
const funcPrefix = `MHLDialog`;
export class MHLDialog extends Dialog {
  prefix = null;
  constructor(data, options = {}) {
    const func = `${funcPrefix}#constructor`;
    // gotta work around Application nuking the classes array with mergeObject
    let tempClasses;
    if ("classes" in options && Array.isArray(options.classes)) {
      tempClasses = options.classes;
      delete options.classes;
    }
    // sets this.data
    super(data, options);
    this.data ??= {};
    if (tempClasses) this.options.classes = [...new Set(this.options.classes.concat(tempClasses))];

    if (!this.data?.title) this.data.title = `Dialog ${this.appId}`; //mostly redundant but makes the next line cleaner
    if (!this.data?.prefix) this.data.prefix = String(this.data.prefix ?? this.data.title) + " | ";

    //validate the validator.
    if ("validator" in this.data) {
      this.data.validator = this.#processValidatorData(data.validator);
    }
    //make sure contentData doesnt have reserved keys (just buttons and content afaict)
    if ("contentData" in this.data) {
      const contentData = this.data.contentData;
      const disallowedKeys = ["buttons", "content"];
      if (!Object.keys(contentData).every((k) => !disallowedKeys.includes(k))) {
        throw MHLError(`${PREFIX}.Error.ReservedKeys`, {
          context: { keys: disallowedKeys.join(", ") },
          func: "MHLDialog: ",
          log: { contentData },
        });
      }
    }

    if ("cancelButtons" in this.data) {
      const cancelButtons = this.data.cancelButtons;
      if (!Array.isArray(cancelButtons) || !cancelButtons.every((b) => typeof b === "string")) {
        throw MHLError(`MHL.Error.Type.Array`, {
          context: { var: "cancelButtons", of: localize(`MHL.Error.Type.Of.ButtonLabelStrings`) },
          func,
          log: { cancelButtons },
        });
      }
    }
    this.data.cancelButtons ??= ["no", "cancel"];
  }

  #processValidatorData(validator) {
    switch (typeof validator) {
      case "function":
        break;
      case "string":
        validator = [validator];
      case "object":
        if (Array.isArray(validator) && validator.every((f) => typeof f === "string")) {
          const fields = validator;
          validator = (html) => {
            const formValues = MHLDialog.getFormData(html);
            const emptyFields = fields.filter((f) => isEmpty(formValues[f]));
            if (emptyFields.length) {
              const fieldsError = fields
                .map((f) =>
                  emptyFields.includes(f)
                    ? `<span style="text-decoration: var(--mhl-text-error-decoration)">${f}</span>`
                    : f
                )
                .join(", ");
              // don't use MHLBanner for genericity, use data.prefix for specificity
              localizedBanner(`${PREFIX}.Warning.RequiredFields`, {
                context: { fields: fieldsError },
                type: "warn",
                console: false,
                prefix: this.data.prefix,
              });
              log({ formValues }, { type: "warn", prefix: this.data.prefix });
              return false;
            }
            return true;
          };
          break;
        }
      default:
        throw MHLError(`${PREFIX}.Error.BadValidator`, { func: "MHLDialog: ", log: { validator } });
    }
    return validator;
  }
  #_validate() {
    if (!("validator" in this.data)) return true;
    return this.data.validator(this.options.jQuery ? this.element : this.element[0]);
  }

  getData() {
    return fu.mergeObject(super.getData(), {
      idPrefix: `mhldialog-${this.appId}-`,
      ...(this.data.contentData ?? {}),
    });
  }

  static get defaultOptions() {
    const options = super.defaultOptions;
    options.jQuery = false;
    options.classes.push('mhl-dialog');
    return options;
  }

  submit(button, event) {
    if (this.data.cancelButtons.includes(event.currentTarget.dataset.button) || this.#_validate()) {
      super.submit(button, event);
    } else {
      return false;
    }
  }

  // this exists just to not drop all new keys in data. also allows passing options as the 2nd argument like normal, and renderOptions as 3rd
  static async prompt(data = {}, altOptions = {}, altRenderOptions = {}) {
    //destructure buttons so it doesn't go into ...rest
    let { title, content, label, callback, render, rejectClose, options, renderOptions, buttons, ...rest } = data;
    rejectClose ??= false;
    options ??= {};
    options = fu.mergeObject(options, altOptions);
    renderOptions ??= {};
    renderOptions = fu.mergeObject(renderOptions, altRenderOptions);
    return this.wait(
      {
        title,
        content,
        render,
        default: "ok",
        close: () => {
          if (rejectClose) return;
          return null;
        },
        buttons: {
          ok: { icon: '<i class="fa-solid fa-check"></i>', label, callback },
        },
        ...rest,
      },
      options
    );
  }

  // this exists just to not drop all new keys in data. also allows passing options as the 2nd argument like normal, and renderOptions as 3rd
  static async confirm(data, altOptions = {}, altRenderOptions = {}) {
    //destructure buttons so it doesn't go into ...rest
    let { title, content, yes, no, render, defaultYes, rejectClose, options, renderOptions, buttons, ...rest } = data;
    renderOptions ??= {};
    renderOptions = fu.mergeObject(renderOptions, altRenderOptions);
    defaultYes ??= true;
    rejectClose ??= false;
    options ??= {};
    options.mhlConfirm = true;
    options = fu.mergeObject(options, altOptions);
    return this.wait(
      {
        title,
        content,
        render,
        focus: true,
        default: defaultYes ? "yes" : "no",
        close: () => {
          if (rejectClose) return;
          return null;
        },
        buttons: {
          yes: {
            icon: '<i class="fa-solid fa-check"></i>',
            label: game.i18n.localize("Yes"),
            callback: (html) => (yes ? yes(html) : true),
          },
          no: {
            icon: '<i class="fa-solid fa-xmark"></i>',
            label: game.i18n.localize("No"),
            callback: (html) => (no ? no(html) : false),
          },
        },
        ...rest,
      },
      options
    );
  }

  async _renderInner(data) {
    if (data?.content) {
      const originalContent = fu.deepClone(data.content);
      if (/\.(hbs|html)$/.test(data.content)) {
        data.content = await renderTemplate(originalContent, data);
      } else {
        data.content = Handlebars.compile(originalContent)(data, {
          allowProtoMethodsByDefault: true,
          allowProtoPropertiesByDefault: true,
        });
      }
      data.content ||= localize(`${PREFIX}.Error.TemplateFailure`);
    }
    return super._renderInner(data);
  }

  static getFormData(html) {
    return Object.values(MHLDialog.getFormsData(html))[0];
  }

  static getFormsData(html) {
    const func = `${funcPrefix}.getFormsData`;
    html = html instanceof jQuery ? html[0] : html;
    const forms = htmlQueryAll(html, "form");
    return forms.reduce((acc, form, i) => {
      const data = new FormDataExtended(form).object;
      acc[i] = data;
      const name = form.getAttribute("name");
      if (name) acc[name] = data;
      acc.length++;
      return acc;
    }, {length:0});
  }

  static getLabelMap(html) {
    html = html instanceof jQuery ? html[0] : html;
    const named = htmlQueryAll(html, "[name][id]");
    if (!named.length) return {};
    const namedIDs = named.map((e) => e.getAttribute("id"));
    const allLabels = htmlQueryAll(html, "label");
    if (!allLabels.length) return {};
    return allLabels.reduce((acc, curr) => {
      const forAttr = curr.getAttribute("for");
      if (forAttr) {
        if (!namedIDs.includes(forAttr)) return acc;
        acc[curr.getAttribute("name")] = curr.innerText;
      } else {
        const labelableChild = htmlQuery(curr, LABELABLE_TAGS.map((t) => `${t}[name]`).join(", "));
        if (!labelableChild) return acc;
        acc[labelableChild.getAttribute("name")] = curr.innerText;
      }
      return acc;
    }, {});
  }
}
