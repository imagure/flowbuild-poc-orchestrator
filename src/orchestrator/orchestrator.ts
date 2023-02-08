import { v4 as uuid } from 'uuid'
import { Consumer, Producer } from 'kafkajs'
import { StartMessage, NodeResultMessage } from '../kafka/types'
import { RedisClient } from '../redis'
import { Action, NodeResult, Workflow, Node, Lane } from './types'
import { envs } from '../configs/env'
import { log } from '../utils'
import { Actor } from '../kafka/types/message.type'
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

    validateActor(
        { node, lanes, actor } : 
        { node : Node, lanes: Array<Lane>, actor: Actor }
        ): { isValid: Boolean, forbiddenState?: NodeResult } {
            const { roles: actorRoles } = actor
            const { roles: laneRoles } = lanes.find((lane: Lane) => lane.id === node.lane_id) || { roles: [] }
            const roleMatches = laneRoles.find((laneRole: string) => actorRoles.includes(laneRole))
            return roleMatches 
            ? {
                isValid: true
            } 
            : { 
                isValid: false, 
                forbiddenState: {
                    node_id: node.id,
                    bag: {},
                    external_result: {},
                    result: {},
                    error: 'Forbidden Lane',
                    status: 'forbidden',
                    next_node_id: node.next,
                    time_elapsed: 0,
                }  as NodeResult
             }
    }

    async emitProcessState(actor_id: string, process_data: {[key: string]: any}) {
        await Orchestrator.producer.send({
            topic: `process-states-topic`,
            messages: [
                { 
                    value: JSON.stringify({ actor_id, process_data })
                }
            ],
        })
    }

    async saveResultToProcess(process_id: string, result: NodeResult) {
        const history = await this._redis.get(`process_history:${process_id}`)
        if(history) {
            const parsedHistory = JSON.parse(history)
            parsedHistory.states.push(result)
            parsedHistory.executing = result.next_node_id
            await this._redis.set(`process_history:${process_id}`, JSON.stringify(parsedHistory), { EX: this._phEX })
            return
        }
        await this._redis.set(`process_history:${process_id}`, JSON.stringify({
            executing: result.node_id || 'unknown',
            states: result.status ? [result] : []
        }), { EX: this._phEX })
    }

    async startProcess(inputMessage: StartMessage) {
        const { input, workflow_name, actor } = inputMessage
        
        const workflow = await this._redis.get(`workflows:${workflow_name}`)
        const { blueprint_spec: { nodes, lanes } } = JSON.parse(workflow) as Workflow

        const startNode = nodes.find((n : Node) => n.type==='start')
        const action : Action = {
            execution_data: { bag: {}, input: input, external_input: {}, actor_data: {}, environment: {}, parameters: {} },
            node_spec: startNode,
            workflow_name,
            process_id: uuid(),
            actor
        }

        const { isValid, forbiddenState } = this.validateActor({ node: startNode!, lanes, actor })
        if(!isValid) {
            this.saveResultToProcess(action.process_id, forbiddenState!)
            this.emitProcessState(actor.id, { process_id: action.process_id, workflow_name, state: forbiddenState! })
            return
        }
        
        await Orchestrator.producer.send({
            topic: this._topics['start'],
            messages: [{ value: JSON.stringify(action) }],
        })

        const nodeResult = { node_id: startNode?.id } as NodeResult
        this.saveResultToProcess(action.process_id, nodeResult)
        this.emitProcessState(actor.id, { process_id: action.process_id, workflow_name, state: nodeResult })
    }

    async processResult(inputMessage: NodeResultMessage) : Promise<void> {
        const { result, workflow_name, process_id, actor } = inputMessage

        this.saveResultToProcess(process_id, result)
        this.emitProcessState(actor.id, { process_id: process_id, workflow_name, state: result })

        if(!result?.next_node_id) {
            return
        }

        const blueprint = await this._redis.get(`workflows:${workflow_name}`)
        const { blueprint_spec: { nodes, lanes } } = JSON.parse(blueprint) as Workflow

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
                process_id,
                actor
            }

            const { isValid, forbiddenState } = this.validateActor({ node: nextNode!, lanes, actor })
            if(!isValid) {
                this.saveResultToProcess(action.process_id, forbiddenState!)
                this.emitProcessState(actor.id, { process_id: action.process_id, workflow_name, state: forbiddenState! })
                return
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