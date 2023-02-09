import { ProcessState } from "./process_state.type"

export type ProcessHistory = {
    workflow_name: string,
    executing: string,
    bag: {[key: string]: string}
    states: Array<ProcessState>
}

export type ProcessData = {
    process_id?: string,
    workflow_name: string,
    history?: ProcessHistory
}