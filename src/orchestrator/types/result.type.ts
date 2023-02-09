import { LooseObject } from '../../types'

export type NodeResult = {
    node_id: string
    bag: LooseObject
    external_input: LooseObject
    result: any
    error: any
    status: string
    next_node_id: string
    time_elapsed: number
}