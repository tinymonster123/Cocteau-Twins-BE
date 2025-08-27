import { Injectable, OnModuleDestroy, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: Redis;
  private readonly logger = new Logger(RedisService.name);

  constructor(private configService: ConfigService) { }

  onModuleInit() {
    const redisUrl = this.configService.get<string>('REDIS_URL');
    this.logger.log(`正在尝试连接到 Redis，URL: ${redisUrl}`);
    if (!redisUrl) {
      this.logger.error('环境变量 REDIS_URL 未配置，Redis 功能不可用');
      return;
    }
    this.client = new Redis(redisUrl, {
      connectTimeout: 10000,
      maxRetriesPerRequest: 5,
      enableOfflineQueue: false,
    });

    this.client.on('connect', () => this.logger.log('已连接到 Redis'));
    this.client.on('ready', () => this.logger.log('Redis 已准备就绪，可接受命令'));
    this.client.on('error', (err: Error) => this.logger.error(`Redis 连接错误: ${err.message}`, err.stack));
  }

  onModuleDestroy() {
    if (this.client) {
      this.client.quit();
    }
  }

  public async addToBlacklist(jti: string, expiresIn: number): Promise<void> {
    if (!this.client || this.client.status !== 'ready') {
      this.logger.warn('Redis 不可用，无法加入黑名单');
      return;
    }
    await this.client.set(`blacklist:${jti}`, 'true', 'EX', Math.max(1, expiresIn));
  }

  public async isBlacklisted(jti: string): Promise<boolean> {
    if (!this.client || this.client.status !== 'ready') {
      this.logger.warn('Redis 不可用，默认认为令牌未在黑名单中');
      return false;
    }
    const result = await this.client.get(`blacklist:${jti}`);
    return result === 'true';
  }
}
