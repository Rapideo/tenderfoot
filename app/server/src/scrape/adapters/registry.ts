/* The adapter registry -- one map, shared by every caller that names an
 * adapter by source string.
 *
 * Controller ruling 1 (task-9): the original task-9 brief had `routes/admin.ts`
 * declare its own `ADAPTERS` map, duplicating the one `scrape/cli.ts` already
 * had. Two registries drift -- add a source to one and the other silently
 * falls behind, and nothing would catch it since each has its own tests.
 * This module is the single source of truth; `cli.ts` and `routes/admin.ts`
 * both import it rather than each declaring their own. */
import { fakeAdapter } from "./fake.js";
import { samAdapter } from "./sam.js";
import { usaSpendingAdapter } from "./usaspending.js";
import type { Adapter } from "../adapter.js";

export const ADAPTERS: Record<string, () => Adapter> = {
  fake: () => fakeAdapter(25, 10),
  sam: () => samAdapter(),
  usaspending: () => usaSpendingAdapter(),
};
