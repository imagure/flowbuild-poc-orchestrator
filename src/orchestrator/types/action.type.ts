/* eslint-disable @typescript-eslint/no-explicit-any */
import { Actor } from '@kafka/types'
import { Workflow } from '@orchestrator/types'

export type Action = {
  node_spec: any
  execution_data: any
  workflow: Workflow
  process_id: string
  actor: Actor
}
