/**
 * WebGL islands. Import the Lazy* components (see lazy.tsx for why they are the
 * only entry points); the scene bus lives in "@/three/bus" and never pulls three.
 */
export { LazyBudgetFlow, LazySceneBackdrop } from "./lazy";
export type { BudgetFlowProps } from "./BudgetFlow";
export type { FlowAllocation } from "./BudgetFlowFallback";
