import { Kafka } from 'kafkajs'
import { v4 as uuid } from 'uuid'
import { envs } from '../configs/env'
import { Orchestrator } from '../orchestrator'

const kafka = new Kafka({
  clientId: `orchestrator-${uuid()}`,
  brokers: [`${envs.BROKER_HOST}:${envs.BROKER_PORT}`]
})

const producer = kafka.producer()
const consumer = kafka.consumer({ groupId: 'orchestration-consumer-group' })

const connect = async (topics: Array<string>) => {
  const orchestrator = new Orchestrator()

  await producer.connect()
  await consumer.connect()
  for(let topic of topics) await consumer.subscribe({ topic, fromBeginning: true })

  await orchestrator.connect(consumer)
  Orchestrator.producer = producer

  return { consumer, producer }
}

export {
    connect
}