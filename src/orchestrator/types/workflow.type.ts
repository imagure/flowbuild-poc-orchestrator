/* eslint-disable @typescript-eslint/no-explicit-any */
export type WfEvent = {
  category: string
  family: string
  definition: string
}

export type Lane = {
  id: string
  roles: Array<string>
}

export type Node = {
  id: string
  name: string
  next: string
  type: string
  category: string
  lane_id: string
  parameters: {
    [key: string]: any
    events: Array<WfEvent>
  }
}

export type Blueprint = {
  nodes: Array<Node>
  lanes: Array<Lane>
  environment: { [key: string]: string }
}

export type Workflow = {
  name: string
  description: string
  blueprint_spec: Blueprint
}
