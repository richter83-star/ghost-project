import cron from "node-cron";
import { config } from "./config.js";
import { log } from "./logger.js";
import { qaSweepOnce } from "./worker.js";
import { startServer } from "./server.js";

async function main() {
  log.info({ cron: config.qa.scanCron }, "QA Gate starting");

  // Optional HTTP control plane
  if (config.http.enabled) {
    startServer();
  }

  // Run once on boot
  await qaSweepOnce();

  // Then schedule
  cron.schedule(config.qa.scanCron, async () => {
    try {
      await qaSweepOnce();
    } catch (e: any) {
      log.error({ err: e?.message || String(e) }, "QA sweep error");
    }
  });
}

main().catch((e) => {
  log.error({ err: (e as any)?.message || String(e) }, "Fatal start error");
  process.exit(1);
});

