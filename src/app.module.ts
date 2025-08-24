import { Module } from "@nestjs/common";
import { AuthModule } from "./users/auth/auth.module";
import { UsersModule } from './users/users.module';

@Module({
    imports: [AuthModule, UsersModule]
})

export class AppModule { }