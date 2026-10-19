import { startScheduler } from "./lib/scheduler";

const g = globalThis as unknown as { __vmScheduler?: boolean };
if (!g.__vmScheduler && process.env.DISABLE_SCHEDULER !== "true") {
  g.__vmScheduler = true;
  startScheduler();
}
