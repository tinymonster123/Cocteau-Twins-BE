import {
    BadRequestException,
    Body,
    Controller,
    Post,
    Request,
    UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthGuard } from '@nestjs/passport';
import { RegisterDto } from './dtos/register.dto';
import { LoginResponseDTO } from './dtos/login-response.dto';
import { RegisterResponseDTO } from './dtos/register-response.dto';

@Controller('auth')
export class AuthController {
    constructor(private authService: AuthService) { }
    @UseGuards(AuthGuard('local'))
    @Post('login')
    async login(@Request() req: any): Promise<LoginResponseDTO | BadRequestException> {
        return this.authService.login(req.user);
    }
    @Post('register')
    async register(
        @Body() registerBody: RegisterDto,
    ): Promise<RegisterResponseDTO | BadRequestException> {
        return await this.authService.register(registerBody);
    }
}