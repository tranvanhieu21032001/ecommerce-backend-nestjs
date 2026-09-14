import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);

  constructor(@Inject('REDIS_CLIENT') private readonly redis: Redis) {}

  async onModuleInit() {
    try {
      await this.redis.set('testkey', 'testvalue');
      const val = await this.redis.get('testkey');

      if (val) {
        this.logger.log('Redis is working!');
      }
    } catch (error) {
      this.logger.error('Redis connection failed', error);
    }
  }

  async onModuleDestroy() {
    await this.redis.quit();
    this.logger.log('Redis disconnected successfully!');
  }
}
