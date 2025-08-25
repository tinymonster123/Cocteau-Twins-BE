import { IsString, IsEmail, IsNotEmpty, MinLength } from 'class-validator';

export class RegisterDto {
    @IsString()
    @IsNotEmpty()
    @MinLength(3)
    readonly username: string;

    @IsEmail()
    @IsNotEmpty()
    readonly email: string;

    @IsString()
    @MinLength(8)
    readonly password: string;
}