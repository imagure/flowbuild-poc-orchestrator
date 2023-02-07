export type NodeResult = {
    node_id: string
    bag: {[key: string]: any}
    external_result: any
    result: any
    error: any
    status: string
    next_node_id: string
    time_elapsed: number
}