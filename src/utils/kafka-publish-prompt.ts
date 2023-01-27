import readline from 'readline'
import { Producer } from 'kafkajs'
import { Message } from '../kafka/types';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
})

async function readLineAsync(message: string) {
    return new Promise((resolve, reject) => {
        rl.question(message, (answer) => {
            resolve(answer);
        });
    });
} 
  

const publishPrompt = async (topic: string, producer: Producer) => {
    while(true) {
        const answer = await readLineAsync('What should be published? R: ') as string
        const messages = [{ value: answer }]

        await producer.send({
            topic,
            messages,
        })
    }
}

export {
    publishPrompt
}