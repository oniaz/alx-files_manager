import { createClient } from 'redis';
import { promisify } from 'util';

class RedisClient {
  constructor() {
    this.client = createClient();
    this.connected = true;

    this.client.on('error', (err) => {
      this.connected = false;
      console.error('Redis client error:', err);
    });

    this.asyncGet = promisify(this.client.get).bind(this.client);
    this.asyncSet = promisify(this.client.set).bind(this.client);
    this.asyncDel = promisify(this.client.del).bind(this.client);

    this.client.on('ready', () => {
      this.connected = true;
    });
  }

  isAlive() {
    return this.connected;
  }

  async get(key) {
    const value = await this.asyncGet(key);
    return value;
  }

  async set(key, value, duration) {
    await this.asyncSet(key, value, 'EX', duration);
  }

  async del(key) {
    await this.asyncDel(key);
  }
}

const redisClient = new RedisClient();
module.exports = redisClient;
