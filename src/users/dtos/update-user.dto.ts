import { IsString, IsEmail, IsOptional, MinLength, IsBoolean } from 'class-validator';

export class UpdateUserDto {
    @IsOptional()
    @IsString()
    @MinLength(3)
    readonly username?: string;

    @IsOptional()
    @IsEmail()
    readonly email?: string;
}

export class UpdateUserStatusDto {
    @IsBoolean()
    readonly is_active: boolean;
}