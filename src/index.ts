import { connect } from '@kafka/client'
import { createLogger } from '@utils'
import { Orchestrator } from '@orchestrator'
import { envs } from '@configs/env'
// import { publishPrompt } from '.@utils'

const orchestrator_consumed_topics = envs.COSUMED_TOPICS

async function main() {
  createLogger('info')
  const { consumer, producer } = connect()
  const orchestrator = new Orchestrator()

  await producer.connect()
  await consumer.connect()
  for (const topic of orchestrator_consumed_topics)
    await consumer.subscribe({ topic, fromBeginning: true })

  await orchestrator.connect(consumer)
  Orchestrator.producer = producer

  // Prompt for manual testing:
  // publishPrompt(orchestrator_consumed_topics[1], producer)
}

main()
