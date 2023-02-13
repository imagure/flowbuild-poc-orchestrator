import { Actor } from "@kafka/types"

export type Action = {
    node_spec: any
    execution_data: any
    workflow_name: string
    process_id: string
    actor: Actor
}