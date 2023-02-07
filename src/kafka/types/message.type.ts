export type Message = {
    value: MinimumValue | string
}

export type MinimumValue = {
    workflow_name: string
}

export interface StartValue extends MinimumValue {
    workflow_name: string
    input?: { [key: string]: any }
}

export interface NodeResultValue extends StartValue {
    process_id: string
    result: { [key: string]: any }
}