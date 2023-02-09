import { ContinueMessage } from "../../kafka/types"
import { Action, Workflow, Node, ProcessHistory } from "../types"
import { Orchestrator } from '../orchestrator'

export async function continueProcess(orchestrator: Orchestrator, inputMessage: ContinueMessage) {
    const { input, workflow_name, actor, process_id } = inputMessage

    const [workflow, history] = await Promise.all([
        orchestrator._redis.get(`workflows:${workflow_name}`) as Promise<Workflow>,
        orchestrator._redis.get(`process_history:${process_id}`) as Promise<ProcessHistory>,
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

    const { isValid, forbiddenState } = orchestrator.validateActor({ node: continueNode!, lanes, actor })
    if(!isValid) {
        orchestrator.saveResultToProcess({ history, workflow_name, process_id: action.process_id }, forbiddenState!)
        orchestrator.emitProcessState(actor.id, { process_id: action.process_id, workflow_name, state: forbiddenState! })
        return
    }
    
    const nodeResolution = (continueNode?.category || continueNode?.type)?.toLowerCase()
    if(nodeResolution) {
        await Orchestrator.producer.send({
            topic: orchestrator._topics[nodeResolution],
            messages: [{ value: JSON.stringify(action) }],
        })
    }
    return
}