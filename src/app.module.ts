import { Module } from "@nestjs/common";
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_FILTER } from '@nestjs/core';
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from './users/users.module';
import { PrismaModule } from './prisma/prisma.module';
import { JwtGuard } from './auth/guards/jwt.guard';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { RedisModule } from './redis/redis.module';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
        }),
        RedisModule,
        AuthModule,
        UsersModule,
        PrismaModule
    ],
    providers: [
        {
            provide: APP_GUARD,
            useClass: JwtGuard,
        },
    ],
})
export class AppModule { }