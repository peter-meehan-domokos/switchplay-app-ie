import { createFrameworkAccess, type Framework } from "./configurationContracts";
export * from "./configurationContracts";

// Sample curriculum for development/manual acceptance. Array order and identities
// are stable; actual Card template IDs can be entered below. Not a production curriculum.
const catalogue: readonly Framework[] = Object.freeze([
  {
    id: "leaving-cert-hl",
    title: "Leaving Cert Higher Level Maths",
    areas: [
      {
        id: "algebra",
        title: "Algebra",
        items: [
          {
            id: "quadratic-equations",
            title: "Quadratic Equations",
            cardTemplateIds: ["card-978dd6c8-683b-476e-bd18-50f99018fe16", "card-a8e7ca26-2422-44b0-8f32-518ab483751f", "card-2ce6e32f-354a-420a-8766-abae800e1a0e", "card-0a2da2c9-8d4b-4779-a2f8-9e468313443a"],
          },
          {
            id: "factor-theorem",
            title: "Factor Theorem",
            cardTemplateIds: [],
          },
          {
            id: "solving-cubics",
            title: "Solving Cubic Equations",
            cardTemplateIds: [],
          },
        ],
      },
      {
        id: "calculus",
        title: "Calculus",
        items: [
          {
            id: "differentiation",
            title: "Differentiation",
            cardTemplateIds: [],
          },
          {
            id: "stationary-points",
            title: "Stationary Points",
            cardTemplateIds: [],
          },
          {
            id: "integration",
            title: "Integration",
            cardTemplateIds: [], //leave blank for now
          },
        ],
      },
      {
        id: "trigonometry",
        title: "Trigonometry",
        items: [], // no items for now
      },
    ],
  },
]);
export const { getFrameworks, getFramework, getFrameworkItem } = createFrameworkAccess(catalogue);
