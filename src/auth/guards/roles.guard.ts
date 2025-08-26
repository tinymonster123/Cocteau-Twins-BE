import { Injectable, CanActivate, ExecutionContext, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role, ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);

  constructor(private reflector: Reflector) { }

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();

    if (!user) {
      this.logger.warn('权限检查失败：用户未认证');
      return false;
    }

    if (!user.role) {
      this.logger.warn(`权限检查失败：用户 ${user.id} 没有角色信息`);
      return false;
    }

    const hasPermission = requiredRoles.includes(user.role as Role);

    if (!hasPermission) {
      this.logger.warn(
        `权限检查失败：用户 ${user.id} (角色: ${user.role}) 尝试访问需要 [${requiredRoles.join(', ')}] 权限的资源`
      );
    } else {
      this.logger.log(
        `权限检查通过：用户 ${user.id} (角色: ${user.role}) 访问需要 [${requiredRoles.join(', ')}] 权限的资源`
      );
    }

    return hasPermission;
  }
}