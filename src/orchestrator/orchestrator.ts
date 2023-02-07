import { v4 as uuid } from 'uuid'
import { Consumer, Producer } from 'kafkajs'
import { StartMessage, NodeResultMessage } from '../kafka/types'
import { RedisClient } from '../redis'
import { Action, NodeResult, Workflow, Node } from './types'
import { envs } from '../configs/env'
import { log } from '../utils'
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

    private _topics : {[key: string]: string} = {
        http: 'http-nodes-topic',
        start: 'start-nodes-topic',
        finish: 'finish-nodes-topic',
        form: 'form-request-nodes-topic',
        flow: 'flow-nodes-topic',
        script: 'js-script-task-nodes-topic',
        timer: 'timer-nodes-topic',
        user: 'user-task-nodes-topic',
    }

    private _redis : RedisClient = new RedisClient()
    private _phEX : number = envs.PROCESS_HISTORY_EXPIRATION

    constructor() {
        if(Orchestrator.instance) {
            return Orchestrator.instance
        }
        Orchestrator.instance = this
        return this
    }

    async saveResultToProcess(process_id: string, result: NodeResult) {
        const history = await this._redis.get(`process_history:${process_id}`)
        if(history) {
            const parsedHistory = JSON.parse(history)
            parsedHistory.steps.push(result)
            parsedHistory.executing = result.next_node_id
            await this._redis.set(`process_history:${process_id}`, JSON.stringify(parsedHistory), { EX: this._phEX })
            return
        }
        await this._redis.set(`process_history:${process_id}`, JSON.stringify({
            executing: result.node_id || 'unknown',
            steps: []
        }), { EX: this._phEX })
    }

    async startProcess(inputMessage: StartMessage) {
        const { input, workflow_name } = inputMessage
        
        const workflow = await this._redis.get(`workflows:${workflow_name}`)
        const { blueprint_spec: { nodes } } = JSON.parse(workflow) as Workflow

        const startNode = nodes.find((n : Node) => n.type==='Start')
        const action : Action = {
            execution_data: { bag: {}, input: input, external_input: {}, actor_data: {}, environment: {}, parameters: {} },
            node_spec: startNode,
            workflow_name,
            process_id: uuid(),
        }
        
        await Orchestrator.producer.send({
            topic: this._topics['start'],
            messages: [{ value: JSON.stringify(action) }],
        })

        this.saveResultToProcess(action.process_id, { node_id: startNode?.id } as NodeResult)
    }

    async processResult(inputMessage: NodeResultMessage) : Promise<void> {
        const { result, workflow_name, process_id } = inputMessage

        this.saveResultToProcess(process_id, result)

        if(!result?.next_node_id) {
            return
        }

        const blueprint = await this._redis.get(`workflows:${workflow_name}`)
        const { blueprint_spec: { nodes } } = JSON.parse(blueprint) as Workflow

        const nextNode = nodes.find((n : Node) => n.id===result.next_node_id)
        const nodeResolution = (nextNode?.category || nextNode?.type)?.toLowerCase()

        if(nodeResolution) {
            const action : Action = {
                execution_data: { 
                    bag: result.bag, 
                    input: result.result, 
                    external_input: {}, 
                    actor_data: {}, 
                    environment: {}, 
                    parameters: nextNode?.parameters || {} 
                },
                node_spec: nextNode,
                workflow_name,
                process_id
            }
            
            await Orchestrator.producer.send({
                topic: this._topics[nodeResolution],
                messages: [
                    { 
                        value: JSON.stringify(action)
                    }
                ],
            })
        }
        return
    }

    async runAction(topic: string, inputMessage: NodeResultMessage) {
        if(topic==='orchestrator-start-process-topic') {
            return await this.startProcess(inputMessage)
        }

        if(topic==='orchestrator-result-topic') {
            return await this.processResult(inputMessage)
        }
    }

    async connect(consumer: Consumer) {
        await consumer.run({
            eachMessage: async ({ topic, partition, message }) : Promise<void>=> {
                const receivedMessage = message.value?.toString() || ''

                log({
                    level: 'info',
                    message: `Message received on Orchestrator.connect -> ${JSON.stringify({ partition, offset: message.offset, value: receivedMessage })}`
                })

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