import { Consumer, EachMessagePayload, Producer } from 'kafkajs'
import { Orchestrator } from '@orchestrator'
import { connect } from '@kafka'
import { createLogger } from '@utils'

const consumerMock = {
  run: jest.fn(() => {
    return
  }),
}
const producerMock = {
  connect: jest.fn(() => {
    return
  }),
  send: jest.fn(() => {
    return
  }),
}

jest.mock('@kafka', () => {
  return {
    connect: () => {
      return {
        consumer: consumerMock,
        producer: producerMock,
      }
    },
  }
})

const startProcess = jest.fn(() => {
  return
})
const continueProcess = jest.fn(() => {
  return
})
const processResult = jest.fn(() => {
  return
})
jest.mock('@orchestrator/actions', () => {
  return {
    startProcess: () => startProcess(),
    continueProcess: () => continueProcess(),
    processResult: () => processResult(),
  }
})

let orchestrator: Orchestrator
let consumer: Consumer, producer: Producer

beforeAll(async () => {
  createLogger('test')
  ;({ consumer, producer } = connect())
  orchestrator = new Orchestrator()
  Orchestrator.producer = producer
})

it('should correctly RUN consumer connection', async () => {
  await orchestrator.connect(consumer)
  expect(consumerMock.run).toHaveBeenCalledTimes(1)
})

it('should correctly call startProcess action', async () => {
  const eachMessage = orchestrator.eachMessage(orchestrator)
  eachMessage({
    topic: 'orchestrator-start-process-topic',
    partition: 1,
    message: { value: '{"testMessageKey":"testMessageValue"}' },
  } as unknown as EachMessagePayload)
  expect(startProcess).toHaveBeenCalledTimes(1)
})

it('should correctly call continueProcess action', async () => {
  const eachMessage = orchestrator.eachMessage(orchestrator)
  eachMessage({
    topic: 'orchestrator-continue-process-topic',
    partition: 1,
    message: { value: '{"testMessageKey":"testMessageValue"}' },
  } as unknown as EachMessagePayload)
  expect(continueProcess).toHaveBeenCalledTimes(1)
})

it('should correctly call processResult action', async () => {
  const eachMessage = orchestrator.eachMessage(orchestrator)
  eachMessage({
    topic: 'orchestrator-result-topic',
    partition: 1,
    message: { value: '{"testMessageKey":"testMessageValue"}' },
  } as unknown as EachMessagePayload)
  expect(processResult).toHaveBeenCalledTimes(1)
})
