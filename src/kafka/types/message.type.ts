import { NodeResult } from "../../orchestrator/types"

export type Message = {
    value: MinimumValue | string
}

export type MinimumValue = {
    workflow_name: string
}

export interface StartMessage extends MinimumValue {
    workflow_name: string
    input?: { [key: string]: any }
}

export interface NodeResultMessage extends StartMessage {
    process_id: string
    result: NodeResult
}