const envs = {
    BROKER_HOST: process.env.BROKER_HOST || 'localhost',
    BROKER_PORT: process.env.BROKER_PORT || '9092',
    PROCESS_HISTORY_EXPIRATION: parseInt(process.env.PROCESS_HISTORY_EXPIRATION || '60', 10),
    REDIS_PASSWORD: process.env.REDIS_PASSWORD || 'eYVX7EwVmmxKPCDmwMtyKVge8oLd2t81',
    REDIS_HOST: process.env.REDIS_HOST || 'localhost',
    REDIS_PORT: process.env.REDIS_PORT || '6379'
}
export {
    envs
}