import { MODULE_ID, fu } from "../constants.mjs";
const PREFIX = "MHL.SettingMenu"
const funcPrefix = "MHLSettingMenu";
export class MHLSettingMenu extends FormApplication {

  constructor(object={}, options={}) {
    const func = `${funcPrefix}#constructor`
    // gotta work around Application nuking the classes array with mergeObject
    let tempClasses;
    if ("classes" in options && Array.isArray(options.classes)) {
      tempClasses = options.classes;
      delete options.classes;
    }    
    super(object, options);
    if (tempClasses) this.options.classes = [...new Set(this.options.classes.concat(tempClasses))];
  }

  static get defaultOptions() {
    return fu.mergeObject(super.defaultOptions, {
      title: "MHL Setting Menu Test",
      template: `modules/${MODULE_ID}/templates/SettingMenu.hbs`,
      classes: [...super.defaultOptions.classes, "mhl-setting-menu"]
    })
  }


  // async _renderInner(data) {
  //   if (this.template === MHLSettingMenu.defaultOptions.template) {
  //     return super._renderInner(data)
  //   }
  //   const compiled = Handlebars.compile(this.template)(data, {
  //     allowProtoMethodsByDefault: true,
  //     allowProtoPropertiesByDefault: true,
  //   });
  //   return $(compiled)
  // }
  
}