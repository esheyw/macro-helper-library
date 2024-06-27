import { mhlocalize } from "../helpers/stringHelpers.mjs";
export class PickAThingPrompt extends Application {
  constructor(data) {
    this.title = data.title ?? mhlocalize(`MHL.PickAThing.DefaultTitle`);
    this.prompt = data.prompt ?? mhlocalize(`MHL.PickAThing.DefaultPrompt`)
  }
}