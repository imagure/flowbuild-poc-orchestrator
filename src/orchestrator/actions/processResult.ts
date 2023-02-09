import { NodeResultMessage } from "../../kafka/types"
import { Action, Workflow, Node, ProcessHistory, States } from "../types"
import { Orchestrator } from '../orchestrator'

export async function processResult(orchestrator: Orchestrator, inputMessage: NodeResultMessage) : Promise<void> {
    const { result, workflow_name, process_id, actor } = inputMessage


    const [workflow, history] = await Promise.all([
        orchestrator.redis.get(`workflows:${workflow_name}`) as Promise<Workflow>,
        orchestrator.redis.get(`process_history:${process_id}`) as Promise<ProcessHistory>,
    ])
    const { bag } = history
    const { blueprint_spec: { nodes, lanes } } = workflow

    orchestrator.saveResultToProcess({ history, workflow_name, process_id }, result)
    orchestrator.emitProcessState(actor.id, { process_id: process_id, workflow_name, state: result })

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

        const { isValid, forbiddenState } = orchestrator.validateActor({ node: nextNode!, lanes, actor })
        if(!isValid) {
            orchestrator.saveResultToProcess({ history, workflow_name, process_id: process_id }, forbiddenState!)
            orchestrator.emitProcessState(actor.id, { process_id: action.process_id, workflow_name, state: forbiddenState! })
            return
        }

        await Orchestrator.producer.send({
            topic: Orchestrator.topics[nodeResolution],
            messages: [
                { 
                    value: JSON.stringify(action)
                }
            ],
        })
    }
    return
}