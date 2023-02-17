import { StartMessage } from '@kafka/types'
import { Orchestrator } from '@orchestrator/orchestrator'
import { Action, NodeResult, Node } from '@orchestrator/types'

export async function startProcess(
  orchestrator: Orchestrator,
  inputMessage: StartMessage
) {
  const { input, workflow, actor, process_id } = inputMessage

  console.log(inputMessage)

  const {
    name: workflow_name,
    blueprint_spec: { nodes, lanes },
  } = workflow

  const startNode = nodes.find((n: Node) => n.type === 'start')

  if (startNode) {
    const action: Action = {
      execution_data: {
        bag: { ...input },
        input: input,
        external_input: null,
        actor_data: {},
        environment: {},
        parameters: {},
      },
      node_spec: startNode,
      workflow,
      process_id,
      actor,
    }

    const { isValid, forbiddenState } = orchestrator.validateActor({
      node: startNode,
      lanes,
      actor,
    })
    if (!isValid) {
      orchestrator.saveResultToProcess(
        { workflow_name, process_id },
        forbiddenState
      )
      orchestrator.emitProcessState(actor.id, {
        process_id,
        workflow_name,
        state: forbiddenState,
      })
      return
    }

    await Orchestrator.producer.send({
      topic: Orchestrator.topics['start'],
      messages: [{ value: JSON.stringify(action) }],
    })

    const nodeResult = { node_id: startNode?.id } as NodeResult
    orchestrator.saveResultToProcess(
      { workflow_name, process_id, bag: { ...input } },
      nodeResult
    )
    orchestrator.emitProcessState(actor.id, {
      process_id,
      workflow_name,
      state: nodeResult,
    })
  }
}
