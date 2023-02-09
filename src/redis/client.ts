import { createClient, RedisClientType, SetOptions } from 'redis'
import { envs } from '../configs/env';
import { LooseObject } from '../types';

class RedisClient {
    static _instance: RedisClient

    static get instance(): RedisClient {
        return RedisClient._instance;
    }

    static set instance(instance: RedisClient) {
        RedisClient._instance = instance;
    }

    private _client: RedisClientType = createClient({
        url: `redis://:${envs.REDIS_PASSWORD}@${envs.REDIS_HOST || 'localhost'}:${envs.REDIS_PORT}`,
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

    async get(key: string) : Promise<LooseObject | string > {
        const data = await this._client.get(key) as string
        try {
            return JSON.parse(data)
        } catch(e) {
            return data
        }
    }

    async set(key: string, value: any, options: SetOptions) {
        return await this._client.setEx(key, options.EX || -1 , value)
    }
}

export {
    RedisClient
}