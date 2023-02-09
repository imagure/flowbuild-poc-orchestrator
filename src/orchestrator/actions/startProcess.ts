import { v4 as uuid } from 'uuid'
import { StartMessage } from "../../kafka/types"
import { Action, NodeResult, Workflow, Node } from "../types"
import { Orchestrator } from '../orchestrator'

export async function startProcess(orchestrator: Orchestrator, inputMessage: StartMessage) {
    const { input, workflow_name, actor } = inputMessage
    
    const workflow = await orchestrator.redis.get(`workflows:${workflow_name}`) as Workflow
    const { blueprint_spec: { nodes, lanes } } = workflow

    const startNode = nodes.find((n: Node) => n.type === 'start')
    const action : Action = {
        execution_data: { bag: {...input}, input: input, external_input: null, actor_data: {}, environment: {}, parameters: {} },
        node_spec: startNode,
        workflow_name,
        process_id: uuid(),
        actor
    }

    const { isValid, forbiddenState } = orchestrator.validateActor({ node: startNode!, lanes, actor })
    if(!isValid) {
        orchestrator.saveResultToProcess({ workflow_name, process_id: action.process_id }, forbiddenState!)
        orchestrator.emitProcessState(actor.id, { process_id: action.process_id, workflow_name, state: forbiddenState! })
        return
    }
    
    await Orchestrator.producer.send({
        topic: Orchestrator.topics['start'],
        messages: [{ value: JSON.stringify(action) }],
    })

    const nodeResult = { node_id: startNode?.id } as NodeResult
    orchestrator.saveResultToProcess({ workflow_name, process_id: action.process_id, bag: { ...input } }, nodeResult)
    orchestrator.emitProcessState(actor.id, { process_id: action.process_id, workflow_name, state: nodeResult })
}