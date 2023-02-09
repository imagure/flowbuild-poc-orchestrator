import { v4 as uuid } from 'uuid'
import { Consumer, Producer } from 'kafkajs'
import { StartMessage, NodeResultMessage } from '../kafka/types'
import { RedisClient } from '../redis'
import { Action, NodeResult, Workflow, Node, Lane, ProcessHistory, ProcessData, States } from './types'
import { envs } from '../configs/env'
import { log } from '../utils'
import { Actor, ContinueMessage } from '../kafka/types/message.type'
import { LooseObject } from '../types'
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
        usertask: 'user-task-nodes-topic',
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
                    external_input: {},
                    result: {},
                    error: 'Forbidden Lane',
                    status: 'forbidden',
                    next_node_id: node.next,
                    time_elapsed: 0,
                }  as NodeResult
             }
    }

    async emitProcessState(actor_id: string, process_data: LooseObject) {
        await Orchestrator.producer.send({
            topic: `process-states-topic`,
            messages: [
                { 
                    value: JSON.stringify({ actor_id, process_data })
                }
            ],
        })
    }

    async saveResultToProcess(process_data: ProcessData, result: NodeResult) {
        const {
            process_id,
            workflow_name,
            history
        } = process_data
        if(history) {
            const clonedHistory = JSON.parse(JSON.stringify(history))
            clonedHistory.states.push(result)
            if(result.bag) {
                clonedHistory.bag = {...clonedHistory.bag, [result.node_id]: result.bag || {} }
            }
            clonedHistory.executing = result.next_node_id
            await this._redis.set(`process_history:${process_id}`, JSON.stringify(clonedHistory), { EX: this._phEX })
            return
        }
        await this._redis.set(`process_history:${process_id}`, JSON.stringify({
            workflow_name,
            executing: result.node_id || 'unknown',
            bag: {},
            states: result.status ? [result] : []
        }), { EX: this._phEX })
    }

    async startProcess(inputMessage: StartMessage) {
        const { input, workflow_name, actor } = inputMessage
        
        const workflow = await this._redis.get(`workflows:${workflow_name}`) as Workflow
        const { blueprint_spec: { nodes, lanes } } = workflow

        const startNode = nodes.find((n : Node) => n.type==='start')
        const action : Action = {
            execution_data: { bag: {}, input: input, external_input: null, actor_data: {}, environment: {}, parameters: {} },
            node_spec: startNode,
            workflow_name,
            process_id: uuid(),
            actor
        }

        const { isValid, forbiddenState } = this.validateActor({ node: startNode!, lanes, actor })
        if(!isValid) {
            this.saveResultToProcess({ workflow_name, process_id: action.process_id }, forbiddenState!)
            this.emitProcessState(actor.id, { process_id: action.process_id, workflow_name, state: forbiddenState! })
            return
        }
        
        await Orchestrator.producer.send({
            topic: this._topics['start'],
            messages: [{ value: JSON.stringify(action) }],
        })

        const nodeResult = { node_id: startNode?.id } as NodeResult
        this.saveResultToProcess({ workflow_name, process_id: action.process_id }, nodeResult)
        this.emitProcessState(actor.id, { process_id: action.process_id, workflow_name, state: nodeResult })
    }

    async continueProcess(inputMessage: ContinueMessage) {
        const { input, workflow_name, actor, process_id } = inputMessage

        const [workflow, history] = await Promise.all([
            this._redis.get(`workflows:${workflow_name}`) as Promise<Workflow>,
            this._redis.get(`process_history:${process_id}`) as Promise<ProcessHistory>,
        ])

        const { blueprint_spec: { nodes, lanes } } = workflow
        const { bag, executing } = history

        const continueNode = nodes.find((n : Node) => n.id===executing)
        const action : Action = {
            execution_data: { bag: bag, input: {}, external_input: input, actor_data: actor, environment: {}, parameters: {} },
            node_spec: continueNode,
            workflow_name,
            process_id,
            actor
        }

        const { isValid, forbiddenState } = this.validateActor({ node: continueNode!, lanes, actor })
        if(!isValid) {
            this.saveResultToProcess({ history, workflow_name, process_id: action.process_id }, forbiddenState!)
            this.emitProcessState(actor.id, { process_id: action.process_id, workflow_name, state: forbiddenState! })
            return
        }
        
        const nodeResolution = (continueNode?.category || continueNode?.type)?.toLowerCase()
        if(nodeResolution) {
            await Orchestrator.producer.send({
                topic: this._topics[nodeResolution],
                messages: [{ value: JSON.stringify(action) }],
            })
        }
        return
    }

    async processResult(inputMessage: NodeResultMessage) : Promise<void> {
        const { result, workflow_name, process_id, actor } = inputMessage


        const [workflow, history] = await Promise.all([
            this._redis.get(`workflows:${workflow_name}`) as Promise<Workflow>,
            this._redis.get(`process_history:${process_id}`) as Promise<ProcessHistory>,
        ])
        const { bag } = history
        const { blueprint_spec: { nodes, lanes } } = workflow

        this.saveResultToProcess({ history, workflow_name, process_id }, result)
        this.emitProcessState(actor.id, { process_id: process_id, workflow_name, state: result })

        if(!result?.next_node_id || result.status === States.WAITING) {
            return
        }

        const nextNode = nodes.find((n : Node) => n.id===result.next_node_id)
        const nodeResolution = (nextNode?.category || nextNode?.type)?.toLowerCase()

        if(nodeResolution) {
            const action : Action = {
                execution_data: { 
                    bag: bag, 
                    input: result.result, 
                    external_input: null,
                    actor_data: actor, 
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
                this.saveResultToProcess({ history, workflow_name, process_id: process_id }, forbiddenState!)
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

        if(topic==='orchestrator-continue-process-topic') {
            return await this.continueProcess(inputMessage)
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