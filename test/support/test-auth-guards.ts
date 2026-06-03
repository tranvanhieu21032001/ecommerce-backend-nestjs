import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { ROLES_KEY } from '../../src/common/decorators/roles.decorator';

type TestRequest = {
  headers: Record<string, string | string[] | undefined>;
  user?: { id: string; role: Role };
};

@Injectable()
export class TestJwtAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<TestRequest>();
    const userId = request.headers['x-user-id'];

    if (typeof userId !== 'string') {
      throw new UnauthorizedException();
    }

    request.user = {
      id: userId,
      role: request.headers['x-user-role'] === Role.ADMIN ? Role.ADMIN : Role.USER,
    };
    return true;
  }
}

@Injectable()
export class TestRolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const request = context.switchToHttp().getRequest<TestRequest>();

    return !roles || Boolean(request.user && roles.includes(request.user.role));
  }
}
