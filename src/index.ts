import { connect } from '@kafka/client'
import { createLogger } from '@utils'
// import { publishPrompt } from '.@utils'

const orchestrator_consumed_topics = [
    'orchestrator-result-topic',
    'orchestrator-start-process-topic',
    'orchestrator-continue-process-topic',
]

async function main() {
    createLogger('info')
    const { producer } = await connect(orchestrator_consumed_topics)

    // Prompt for manual testing:
    // publishPrompt(orchestrator_consumed_topics[1], producer)
}

main()