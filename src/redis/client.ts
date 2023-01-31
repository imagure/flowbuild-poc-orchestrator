import { createClient, RedisClientType, SetOptions } from 'redis'

class RedisClient {
    static _instance: RedisClient

    static get instance(): RedisClient {
        return RedisClient._instance;
    }

    static set instance(instance: RedisClient) {
        RedisClient._instance = instance;
    }

    private _client: RedisClientType = createClient({
        url: `redis://:eYVX7EwVmmxKPCDmwMtyKVge8oLd2t81@${process.env.REDIS_HOST || 'localhost'}:6379`,
    })

    constructor() {
        if(RedisClient.instance) {
            return RedisClient.instance
        }
        
        this._client.connect()
        this._client.on('error', err => console.error('Redis Client Error', err))
        
        // for reference:
        // await client.disconnect()

        RedisClient.instance = this
        return this
    }

    async get(key: string) : Promise<string> {
        return await this._client.get(key) as string
    }

    async set(key: string, value: any, options: SetOptions) {
        return await this._client.setEx(key, options.EX || -1 , value)
    }
}

export {
    RedisClient
}