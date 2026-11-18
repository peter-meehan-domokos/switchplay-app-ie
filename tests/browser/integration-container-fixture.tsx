import { useLayoutEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import HostedIntegration from "../../src/app/step-visuals/activities/integration-area/HostedIntegration";
import IntroStages from "../../src/app/step-visuals/activities/integration-area/intro-stages";
import LaterStages from "../../src/app/step-visuals/activities/integration-area/later-stages";
import { createIntegrationHostedState, reduceIntegrationHostedState, integrationSnapshot, type IntegrationHostedState } from "../../src/app/step-visuals/activities/integration-area/hostState";
import type { IntegrationAction } from "../../src/app/step-visuals/activities/integration-area/learning";
import { integrationPresentation } from "../../src/app/step-visuals/activities/integration-area/presentation";
import { analyseRegion } from "../../src/app/step-visuals/activities/integration-area/model";
import { integrationContainerStyle } from "../../src/app/step-visuals/activities/integration-area/container-layout";
import styles from "../../src/app/step-visuals/activities/integration-area/integration.module.css";

type Action = IntegrationAction extends infer A ? A extends { revision: number } ? Omit<A, "revision"> : A : never;
const act = (s: IntegrationHostedState, a: Action) => reduceIntegrationHostedState(s, { ...a, revision: s.state.revision } as IntegrationAction);
export const panels = ["1", "2-flat", "2-rising", "3-question", "3-feedback", "3-square", "4-rising", "4-square", "4-rule", "5", "6", "7", "7-incorrect", "7-finished"];
function scenario(panel: string) {
  const target = Number(panel[0]);
  let s = createIntegrationHostedState("container-fixture");
  while (s.state.stage < target) {
    if (s.state.stage === 3) s = act(act(s, { type: "demonstrate", progress: 1 }), { type: "predict", multiplier: 4 });
    s = act(s, { type: "next" });
  }
  if (panel === "2-rising") s = act(s, { type: "function", function: "rising" });
  if (panel === "3-square") s = act(s, { type: "function", function: "square" });
  if (target === 3) s = act(s, { type: "demonstrate", progress: 1 });
  if (panel === "3-feedback" || panel === "3-square") s = act(s, { type: "predict", multiplier: 4 });
  if (panel.startsWith("4-")) s = act(s, { type: "division-subsection", subsection: panel.slice(2) as "rising" | "square" | "rule" });
  if (panel === "7-incorrect" || panel === "7-finished") {
    s = act(act(s, { type: "draft", value: panel === "7-finished" ? String(analyseRegion(s.state.region).area) : "-999" }), { type: "check" });
    if (panel === "7-finished") s = act(s, { type: "finish" });
  }
  return s;
}
declare global { interface Window { integrationFixture: {
  configure: (value: { width: number; height: number; panel: string; mode: "adapter" | "presentation" }) => void;
  resize: (height: number) => void;
  saveCount: () => number;
}; } }
let saves = 0;
const save = async () => { saves++; };
const controls = () => {};
function App() {
  const [config, configure] = useState({ width: 366, height: 732, panel: "2-flat", mode: "adapter" as "adapter" | "presentation" });
  useLayoutEffect(() => {
    window.integrationFixture = { configure, resize: height => configure(previous => ({ ...previous, height })), saveCount: () => saves };
  }, []);
  const heading = useRef<HTMLHeadingElement>(null), state = scenario(config.panel);
  const dimensions = { width: config.width, height: config.height };
  const props = { state: state.state, presentation: integrationPresentation(state.state), active: true, dispatch: () => {}, headingRef: heading, hosted: true };
  return <div style={{ position: "fixed", inset: 0, background: "#f7f8f3" }}><div data-fixture-slot="" style={{ position: "absolute", left: 12, top: 56, ...dimensions }}>
    {config.mode === "adapter" ? <HostedIntegration key={config.panel} attemptId="container-fixture" initialSnapshot={integrationSnapshot(state)} dimensions={dimensions} onControls={controls} onChange={save} /> :
      <section className={`${styles.activity} ${styles.container}`} style={integrationContainerStyle(dimensions)}>
        {state.state.stage <= 2 ? <IntroStages {...props} /> : <LaterStages {...props} />}
      </section>}
  </div></div>;
}
createRoot(document.getElementById("root")!).render(<App />);
