import { NodeResultMessage } from '@kafka/types'
import { Orchestrator } from '@orchestrator/orchestrator'
import { Action, Node, ProcessHistory, States } from '@orchestrator/types'

export async function processResult(
  orchestrator: Orchestrator,
  inputMessage: NodeResultMessage
): Promise<void> {
  const { result, workflow, process_id, actor } = inputMessage

  const { name: workflow_name } = workflow
  const history = (await orchestrator.redis.get(
    `process_history:${process_id}`
  )) as ProcessHistory

  const bag = { ...(history?.bag || {}), [result.node_id]: result.bag || {} }

  const {
    blueprint_spec: { nodes, lanes },
  } = workflow

  orchestrator.saveResultToProcess(
    { history, workflow_name, process_id, bag },
    result
  )
  orchestrator.emitProcessState(actor.id, {
    process_id,
    workflow_name,
    state: result,
  })

  if (
    !result?.next_node_id ||
    [States.WAITING, States.ERROR].includes(result.status as States)
  ) {
    return
  }

  const nextNode = nodes.find((n: Node) => n.id === result.next_node_id)
  const nodeResolution = (nextNode?.category || nextNode?.type)?.toLowerCase()

  if (nextNode && nodeResolution) {
    const action: Action = {
      execution_data: {
        bag: bag,
        input: result.result,
        external_input: null,
        actor_data: actor,
        environment: {},
        parameters: nextNode?.parameters || {},
      },
      node_spec: nextNode,
      workflow,
      process_id,
      actor,
    }

    const { isValid, forbiddenState } = orchestrator.validateActor({
      node: nextNode,
      lanes,
      actor,
    })
    if (!isValid) {
      orchestrator.saveResultToProcess(
        { history, workflow_name, process_id: process_id },
        forbiddenState
      )
      orchestrator.emitProcessState(actor.id, {
        process_id: action.process_id,
        workflow_name,
        state: forbiddenState,
      })
      return
    }

    await Orchestrator.producer.send({
      topic: Orchestrator.topics[nodeResolution],
      messages: [
        {
          value: JSON.stringify(action),
        },
      ],
    })
  }
  return
}
