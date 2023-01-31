import { Consumer, Producer } from 'kafkajs'
import { ResultValue } from '../kafka/types';
import { RedisClient } from '../redis';
import { Action } from './types';

class Orchestrator {
    static _instance: Orchestrator
    static _producer: Producer

    static get instance(): Orchestrator {
        return Orchestrator._instance;
    }

    static set instance(instance: Orchestrator) {
        Orchestrator._instance = instance;
    }

    static get producer() : Producer {
        return Orchestrator._producer;
    }

    static set producer(producer: Producer) {
        Orchestrator._producer = producer;
    }

    private _topics : {[key: string]: any} = {
        http: 'http-nodes-topic',
        start: 'start-nodes-topic',
        finish: 'finish-nodes-topic',
    }

    private _redis : RedisClient = new RedisClient()

    constructor() {
        if(Orchestrator.instance) {
            return Orchestrator.instance
        }
        Orchestrator.instance = this
        return this
    }

    async saveResultToProcess(process_id: string, result: any) {
        const history = await this._redis.get(process_id)
        if(history) {
            const parsedHistory = JSON.parse(history)
            parsedHistory.push(result)
            await this._redis.set(process_id, JSON.stringify(parsedHistory), { EX: 50 })
            return
        }
        await this._redis.set(process_id, JSON.stringify([result]), { EX: 50 })
    }

    async startProcess(inputMessage: ResultValue) {
        const { input, workflow_name } = inputMessage
        
        const blueprint = await this._redis.get(workflow_name)
        const { blueprint_spec: { nodes } } = JSON.parse(blueprint)

        const startNode = nodes.find((n : any) => n.type==='Start')
        const action : Action = {
            execution_data: { bag: {}, input: input, external_input: {}, actor_data: {}, environment: {}, parameters: {} },
            node_spec: startNode,
            workflow_name,
            process_id: `wf-${workflow_name}-pid-${Math.floor(Math.random()*100000000000)}`,
        }
        
        await Orchestrator.producer.send({
            topic: this._topics['start'],
            messages: [{ value: JSON.stringify(action) }],
        })
    }

    async resultProcess(inputMessage: ResultValue) : Promise<void> {
        const { result, workflow_name, process_id } = inputMessage

        this.saveResultToProcess(process_id, result)

        if(!result.next_node_id) {
            return
        }

        const blueprint = await this._redis.get(workflow_name)
        const { blueprint_spec: { nodes } } = JSON.parse(blueprint)

        const nextNode = nodes.find((n : any) => n.id===result.next_node_id)
        const nodeResolution = (nextNode.category || nextNode.type).toLowerCase()

        const action : Action = {
            execution_data: { bag: result.bag, input: result.result, external_input: {}, actor_data: {}, environment: {}, parameters: {} },
            node_spec: nextNode,
            workflow_name,
            process_id
        }
        
        await Orchestrator.producer.send({
            topic: this._topics[nodeResolution],
            messages: [{ value: JSON.stringify(action) }],
        })
        return
    }

    async runAction(topic: string, inputMessage: ResultValue) {
        if(topic==='orchestrator-start-process-topic') {
            return await this.startProcess(inputMessage)
        }

        if(topic==='orchestrator-result-topic') {
            return await this.resultProcess(inputMessage)
        }

        if(topic==='orchestrator-finish-topic') {
            //ToDo
            return null
        }
    }

    async connect(consumer: Consumer) {
        await consumer.run({
            eachMessage: async ({ topic, partition, message }) : Promise<void>=> {
                const receivedMessage = message.value?.toString() || ''

                console.info(`\nMessage received on Orchestrator.connect -> ${JSON.stringify({ partition, offset: message.offset, value: receivedMessage })}`)

                try {
                    const inputMessage = JSON.parse(receivedMessage)
                    this.runAction(topic, inputMessage)
                } catch(err) {
                    console.error(err)
                }
            },
        })
    }
}

export {
    Orchestrator
}