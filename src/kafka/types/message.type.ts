import { NodeResult } from "../../orchestrator/types"

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
    input?: { [key: string]: any }
}

export interface ContinueMessage extends MinimumValue {
    input?: { [key: string]: any }
    process_id: string
}

export interface NodeResultMessage extends StartMessage {
    process_id: string
    result: NodeResult
}