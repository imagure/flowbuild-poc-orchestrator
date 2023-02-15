import { Consumer, Kafka, Producer } from 'kafkajs'
import { v4 as uuid } from 'uuid'
import { envs } from '@configs/env'

const kafka = new Kafka({
  clientId: `orchestrator-${uuid()}`,
  brokers: [`${envs.BROKER_HOST}:${envs.BROKER_PORT}`],
})

const connect = () => {
  const producer: Producer = kafka.producer()
  const consumer: Consumer = kafka.consumer({
    groupId: 'orchestration-consumer-group',
  })

  return { consumer, producer }
}

export { connect }
