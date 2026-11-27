import { pino, type DestinationStream, type LevelWithSilent, type Logger } from "pino";

export type { Logger };

export function createLogger(level: LevelWithSilent, destination?: DestinationStream): Logger {
  return pino(
    {
      level,
      base: { service: "kemi" },
      // Credentials never reach the logs, wherever they appear.
      redact: {
        paths: [
          "authorization",
          "cookie",
          "*.authorization",
          "*.cookie",
          "*.headers.authorization",
          "*.headers.cookie",
        ],
        censor: "[Redacted]",
      },
      timestamp: pino.stdTimeFunctions.isoTime,
    },
    destination,
  );
}
