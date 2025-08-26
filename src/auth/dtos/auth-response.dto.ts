import { ApiResponse } from '../../common/dto/api-response.dto';
import { AuthData, RefreshTokenData } from '../type/auth.types';

export type AuthResponseDto = ApiResponse<AuthData>;
export type RefreshTokenResponseDto = ApiResponse<RefreshTokenData>;
