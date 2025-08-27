import {
  Body,
  Controller,
  Post,
  Request,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtGuard } from './guards/jwt.guard';
import { RegisterDto } from './dtos/register.dto';
import { LoginDto } from './dtos/login.dto';
import { RefreshTokenDto } from './dtos/refreshToken.dto';
import {
  AuthResponseDto,
  RefreshTokenResponseDto,
} from './dtos/auth-response.dto';
import { RegisterResponseDto } from './dtos/register-response.dto';
import { Public } from './decorators/public.decorator';
import { ApiResponse } from '../common/dto/api-response.dto';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.authService.validateUser(
      loginDto.email,
      loginDto.password,
    );
    return this.authService.login(user);
  }

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body() registerBody: RegisterDto,
  ): Promise<RegisterResponseDto> {
    return await this.authService.register(registerBody);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refreshTokens(
    @Body() refreshTokenDto: RefreshTokenDto,
  ): Promise<RefreshTokenResponseDto> {
    return await this.authService.refreshTokens(refreshTokenDto);
  }

  @UseGuards(JwtGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Request() req: any): Promise<ApiResponse<{ message: string }>> {
    await this.authService.logoutUser(req.user.id);
    return ApiResponse.success('登出成功', { message: '登出成功' });
  }
}
