export function CycleButtonMixin(BaseApplication) {
  class CycleButtonApplication extends BaseApplication {
    #cycleButtons = {
      toggleExample: {
        icons: ["fa-check", "fa-xmark"],
      },
      statesExampleInferAll: {
        state1: "fa-check",
        state2: "fa-search",
        state3: "fa-xmark",
        state4: "fa-regular fa-square",
      },
    };
  }
  return CycleButtonApplication;
}
