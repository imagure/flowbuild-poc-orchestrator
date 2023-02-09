import { NodeResult } from "../../orchestrator/types"
import { LooseObject } from "../../types/LooseObject.type"

export type Message = {
    value: MinimumValue | string
}

export interface Actor {
    id: 'string',
    roles: Array<string>,
    iat: number
}

export type MinimumValue = {
    workflow_name: string,
    actor: Actor
}

export interface StartMessage extends MinimumValue {
    input?: LooseObject
}

export interface ContinueMessage extends MinimumValue {
    input?: LooseObject
    process_id: string
}

export interface NodeResultMessage extends StartMessage {
    process_id: string
    result: NodeResult
}