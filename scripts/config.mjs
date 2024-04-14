import { mhlog } from "./helpers/errorHelpers.mjs";
import { getIconListFromCSS } from "./helpers/otherHelpers.mjs";
const fields = foundry.data.fields;

class MHLConfigModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      iconLists: new fields.ArrayField(
        new fields.SchemaField(
          {
            name: new fields.StringField({ required: true, nullable: false }),
            prefix: new fields.StringField({ required: true, nullable: false }),
            list: new fields.ArrayField(new fields.StringField({ required: false, nullable: true })),
            sort: new fields.NumberField({
              required: true,
              nullable: false,
              min: 0,
              integer: true,
              initial: (data) => {
                mhlog({ data }, {type: "error", prefix: "data passed to initial"});
                return 1;
              },
            }),
          },
          { required: false, nullable: true }
        )
      ),
    };
  }
}
export const DEFAULT_CONFIG = new MHLConfigModel({});
DEFAULT_CONFIG.iconLists.push({
  name: "fontawesome",
  prefix: "fa-",
  list: getIconListFromCSS("fontawesome", "fa-"),
  sort: 0,
});
DEFAULT_CONFIG.iconLists.push({
  name: "game-icons-net",
  prefix: "ginf-",
  list: getIconListFromCSS("game-icons-net", "ginf-"),
  // sort: 1,
});
