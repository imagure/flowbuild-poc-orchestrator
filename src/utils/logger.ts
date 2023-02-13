import winston, { Logger } from 'winston'

type LOG_MESSAGE = {
  label?: string
  level: string
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  message: any
}

const myformat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp(),
  winston.format.align(),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`
  )
)

let logger: Logger

function createLogger(logerLevel: string) {
  logger = winston.createLogger({
    level: logerLevel || 'info',
    transports: [
      new winston.transports.Console({
        format: myformat,
      }),
    ],
  })
}

function log(logMessage: LOG_MESSAGE) {
  const label = logMessage.label || 'ORCHESTRATOR'
  const level = logMessage.level || 'info'
  //ToDo LOG_LEVEL
  logger.log({
    level,
    message: `[${label}] ${JSON.stringify(logMessage.message)}`,
  })
}

export { log, createLogger }
