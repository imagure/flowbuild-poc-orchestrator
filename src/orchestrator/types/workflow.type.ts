export type Lane = {
    id: string,
    roles: Array<string>
}

export type Node = {
    id: string,
    name: string,
    next: string,
    type: string,
    category: string,
    lane_id: string,
    parameters: {[key: string]: string},
}

export type Blueprint = {
    nodes: Array<Node>,
    lanes: Array<Lane>
    environment: {[key: string]: string}
}

export type Workflow = {
    name: string,
    description: string,
    blueprint_spec: Blueprint
}

