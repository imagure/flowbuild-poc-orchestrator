export enum States {
    RUNNING = 'running',
    WAITING = 'waiting',
    PENDING = 'pending',
    FINISHED = 'finished',
}

export type ProcessState = {
    node_id: string,
    bag: {[key: string]: string},
    external_input: {[key: string]: string},
    result: {[key: string]: string},
    error: {[key: string]: string} | string,
    status: States,
    next_node_id: string,
    time_elapsed: number
}