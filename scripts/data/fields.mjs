import { localeSort } from "../helpers/stringHelpers.mjs";


// Lifted and de-TSified from the pf2e system
export class DataUnionField extends foundry.data.fields.DataField {
  constructor(fields, options) {
    super(options);
    this.fields = fields;
  }

  _cast(value) {
    if (typeof value === "string") value = value.trim();
    return value;
  }

  clean(value, options) {
    if (Array.isArray(value) && this.fields.some((f) => f instanceof foundry.data.fields.ArrayField)) {
      const arrayField = this.fields.find((f) => f instanceof foundry.data.fields.ArrayField);
      return arrayField?.clean(value, options) ?? value;
    }
    return super.clean(value, options);
  }

  validate(value, options) {
    for (const field of this.fields) {
      if (field.validate(value, options) instanceof foundry.data.validation.DataModelValidationFailure) {
        continue;
      } else if (field instanceof foundry.data.fields.StringField && typeof value !== "string") {
        continue;
      } else {
        return;
      }
    }
    return this.fields[0].validate(value, options);
  }

  initialize(value, model, options) {
    const field = this.fields.find((f) => !f.validate(value));
    return field?.initialize(value, model, options);
  }
}

export class FunctionField extends foundry.data.fields.DataField {
  _validateType(value) {
    return typeof value === "function";
  }
  _cast(value) {
    // wrap in pointless arrow function so that DataModel#initalize doesn't run it when accessed by the getter
    return () => value;
  }
}

export class GroupsOptionSortField extends FunctionField {
  _cast(value) {
    if (!value) return () => () => 0;
    if (value === true || value === "a") return () => localeSort;
    return () => value;
  }
}
