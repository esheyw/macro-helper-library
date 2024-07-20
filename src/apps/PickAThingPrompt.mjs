import { localize } from "../helpers/stringHelpers.mjs";
export class PickAThingPrompt extends Application {
  constructor(data) {
    this.title = data.title ?? localize(`MHL.PickAThing.DefaultTitle`);
    this.prompt = data.prompt ?? localize(`MHL.PickAThing.DefaultPrompt`)
  }
}