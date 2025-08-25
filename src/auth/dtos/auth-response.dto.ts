import { ApiResponse } from '../../common/dto/api-response.dto';
import { AuthData, RefreshTokenData } from '../types/auth.types';

export type AuthResponseDto = ApiResponse<AuthData>;
export type RefreshTokenResponseDto = ApiResponse<RefreshTokenData>;
