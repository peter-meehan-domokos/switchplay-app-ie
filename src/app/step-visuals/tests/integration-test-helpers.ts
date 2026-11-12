import { initialIntegration, integrationReducer, type IntegrationAction, type IntegrationState } from "../activities/integration-area/learning";
type Input<T> = T extends { revision: number } ? Omit<T, "revision"> : T;
export const act = (state: IntegrationState, action: Input<IntegrationAction>) => integrationReducer(state, { ...action, revision: state.revision } as IntegrationAction);
export const next = (state: IntegrationState) => act(state, { type: "next" });
export const previous = (state: IntegrationState) => act(state, { type: "previous" });
export const atStage = (target: number): IntegrationState => {
  let state = initialIntegration("seven-stage-tests");
  while (state.stage < target) {
    if (state.stage === 3) state = act(act(state, { type: "demonstrate", progress: 1 }), { type: "predict", multiplier: 4 });
    state = next(state);
  }
  return state;
};
export const check = (state: IntegrationState, value: string) => act(act(state, { type: "draft", value }), { type: "check" });
