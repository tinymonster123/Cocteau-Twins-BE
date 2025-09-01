import { ApiResponse } from '../../common/dto/api-response.dto';

export interface RegisterUser {
    id: string;
    username: string;
    email: string;
    role: string;
    isActive: boolean;
    createdAt: string;
}

export type RegisterResponseDto = ApiResponse<RegisterUser>;
