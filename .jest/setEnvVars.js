process.env.BROKER_HOST = 'TEST_BROKER'
process.env.BROKER_PORT = 'TEST_BROKER_PORT'
process.env.PROCESS_HISTORY_EXPIRATION = 60
process.env.REDIS_PASSWORD = 'REDIS_PASSWORD'
process.env.REDIS_HOST = 'REDIS_HOST'
process.env.REDIS_PORT = '6379'
process.env.COSUMED_TOPICS = `[
  "orchestrator-result-topic",
  "orchestrator-start-process-topic",
  "orchestrator-continue-process-topic"
]`