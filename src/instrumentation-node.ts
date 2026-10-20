import { startScheduler } from "./lib/scheduler";

const g = globalThis as unknown as { __vmScheduler?: boolean };
// On Vercel there is no long-running process; vercel.json schedules /api/cron instead.
if (!g.__vmScheduler && process.env.DISABLE_SCHEDULER !== "true" && !process.env.VERCEL) {
  g.__vmScheduler = true;
  startScheduler();
}
