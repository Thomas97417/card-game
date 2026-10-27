import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();
crons.interval(
  "purge finished combat logs",
  { hours: 1 },
  internal.combatCleanup.sweepFinishedGames,
  {},
);
export default crons;
