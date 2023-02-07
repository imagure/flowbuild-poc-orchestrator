const envs = {
    BROKER_HOST: process.env.BROKER_HOST || 'localhost',
    BROKER_PORT: process.env.BROKER_PORT || '9092',
    PROCESS_HISTORY_EXPIRATION: parseInt(process.env.PROCESS_HISTORY_EXPIRATION || '60', 10)
}
export {
    envs
}