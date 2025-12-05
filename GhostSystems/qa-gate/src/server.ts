import express from "express";
import { config } from "./config.js";
import { qaOne, qaSweepOnce } from "./worker.js";

export function startServer() {
  const app = express();
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_req, res) => res.json({ ok: true }));

  app.post("/qa/one/:id", async (req, res) => {
    try {
      const out = await qaOne(req.params.id);
      res.json({ ok: true, out });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e?.message || String(e) });
    }
  });

  app.post("/qa/sweep", async (_req, res) => {
    try {
      const out = await qaSweepOnce();
      res.json({ ok: true, out });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e?.message || String(e) });
    }
  });

  app.listen(config.http.port, () => {
    // eslint-disable-next-line no-console
    console.log(`QA Gate listening on :${config.http.port}`);
  });
}

