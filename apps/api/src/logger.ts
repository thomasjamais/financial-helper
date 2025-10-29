import pino from 'pino'

export function createLogger(level?: string): pino.Logger {
  const isDev = process.env.NODE_ENV !== 'production'
  return pino({
    level: level ?? 'info',
    transport: isDev
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss.l',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
    formatters: {
      level: (label) => {
        return { level: label.toUpperCase() }
      },
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  })
}

export type Logger = pino.Logger
