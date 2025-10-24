import app from "./server.js";
import { log } from "./server.js";
import fs from "fs";

const settings = JSON.parse(fs.readFileSync("./settings.json", "utf-8"));
const PORT = process.env.PORT || settings.port;
const IS_VERCEL = !!process.env.VERCEL;

if (!IS_VERCEL) {
  app.listen(PORT, "0.0.0.0", () => {
    log.success(`Server running on http://localhost:${PORT}`);
    log.info(`Rate Limit: ${settings.rateLimit.maxRequests} req/${settings.rateLimit.windowMs / 60000}min`);
    log.info(`Cache: ${settings.cache.maxSize} items, TTL ${settings.cache.ttl / 1000}s`);
    log.info(`Environment: ${IS_VERCEL ? "VERCEL" : "SELF-HOSTED"}`);
    log.info(`Total Endpoints: ${app.locals.endpoints.length}`);
  });
} else {
  // For Vercel, just export the app
  log.info("Running on Vercel");
  log.info(`Total Endpoints: ${app.locals.endpoints.length}`);
}

// Export for Vercel serverless
export default app;
