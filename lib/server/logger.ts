import "server-only";
import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: {
    paths: ["apiToken", "token", "authorization", "headers.authorization", "password"],
    censor: "[REDACTED]",
  },
});
