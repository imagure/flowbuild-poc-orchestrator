import { Consumer, Producer } from 'kafkajs'
import { NodeResultMessage } from '../kafka/types'
import { RedisClient } from '../redis'
import { NodeResult, Node, Lane, ProcessData } from './types'
import { envs } from '../configs/env'
import { log } from '../utils'
import { Actor } from '../kafka/types/message.type'
import { LooseObject } from '../types'
import { 
    startProcess, 
    continueProcess, 
    processResult 
} from './actions'

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

    _topics : {[key: string]: string} = {
        http: 'http-nodes-topic',
        start: 'start-nodes-topic',
        finish: 'finish-nodes-topic',
        form: 'form-request-nodes-topic',
        flow: 'flow-nodes-topic',
        script: 'js-script-task-nodes-topic',
        timer: 'timer-nodes-topic',
        usertask: 'user-task-nodes-topic',
    }

    _redis : RedisClient = new RedisClient()
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

    async runAction(topic: string, inputMessage: NodeResultMessage) {
        if(topic==='orchestrator-start-process-topic') {
            return await startProcess(this, inputMessage)
        }

        if(topic==='orchestrator-continue-process-topic') {
            return await continueProcess(this, inputMessage)
        }

        if(topic==='orchestrator-result-topic') {
            return await processResult(this, inputMessage)
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