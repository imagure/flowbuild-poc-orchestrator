import { LooseObject } from '@/types'
import { NodeResult, Workflow } from '@orchestrator/types'

export type Message = {
  value: MinimumValue | string
}

export interface Actor {
  id: 'string'
  roles: Array<string>
  iat: number
}

export type MinimumValue = {
  workflow: Workflow
  actor: Actor
}

export interface StartMessage extends MinimumValue {
  input?: LooseObject
  process_id: string
}

export interface ContinueMessage extends MinimumValue {
  input?: LooseObject
  process_id: string
}

export interface NodeResultMessage extends StartMessage {
  process_id: string
  result: NodeResult
}
