import { connect } from './kafka'
// import { publishPrompt } from './utils'

const orchestrator_consumed_topics = ['orchestrator-result-topic', 'orchestrator-start-process-topic', 'orchestrator-finish-topic']

async function main() {
    const { producer } = await connect(orchestrator_consumed_topics)

    // Prompt for manual testing:
    // publishPrompt(orchestrator_consumed_topics[1], producer)
}

main()