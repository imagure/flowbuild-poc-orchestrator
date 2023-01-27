import { Kafka } from 'kafkajs'
import { Orchestrator } from '../orchestrator'

const kafka = new Kafka({
  clientId: `orchestrator-${Math.floor(Math.random()*100000)}`,
  brokers: [`${process.env.BROKER_HOST || 'localhost'}:9092`]
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