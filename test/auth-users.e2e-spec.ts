import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Role } from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';
import { JwtAuthGuard } from '../src/common/guards/jwt-auth-guard';
import { RolesGuard } from '../src/common/guards/roles.guard';
import { JwtRefreshAuthGuard } from '../src/common/guards/jwt-refresh-auth.guard';
import { AuthController } from '../src/modules/auth/auth.controller';
import { AuthService } from '../src/modules/auth/auth.service';
import { UsersController } from '../src/modules/users/users.controller';
import { UsersService } from '../src/modules/users/users.service';
import { TestJwtAuthGuard, TestRolesGuard } from './support/test-auth-guards';

describe('Auth and Users API (e2e)', () => {
  let app: INestApplication<App>;
  const authService = {
    login: jest.fn(),
    register: jest.fn(),
    loginWithGoogle: jest.fn(),
    logout: jest.fn(),
    refreshTokens: jest.fn(),
    confirmEmail: jest.fn(),
  };
  const usersService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    updateUser: jest.fn(),
    changePassword: jest.fn(),
    remove: jest.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AuthController, UsersController],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: UsersService, useValue: usersService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useClass(TestJwtAuthGuard)
      .overrideGuard(JwtRefreshAuthGuard)
      .useClass(TestJwtAuthGuard)
      .overrideGuard(RolesGuard)
      .useClass(TestRolesGuard)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();
  });

  beforeEach(() => jest.clearAllMocks());

  afterAll(async () => app.close());

  it('POST /auth/login returns the user and writes auth cookies', async () => {
    authService.login.mockResolvedValue({
      status: true,
      message: 'Login successful',
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      user: { id: 'user-1', email: 'buyer@example.com', role: Role.USER },
    });

    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'buyer@example.com', password: 'Password@1' })
      .expect(200);

    expect(response.body.user.id).toBe('user-1');
    expect(response.body.accessToken).toBeUndefined();
    const cookies = String(response.headers['set-cookie']);
    expect(cookies).toContain('the-hole.access_token=');
    expect(cookies).toContain('the-hole.refresh_token=');
  });

  it('POST /auth/login rejects an invalid email payload', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'not-an-email', password: 'Password@1' })
      .expect(400);

    expect(authService.login).not.toHaveBeenCalled();
  });

  it('PATCH /users/me updates the authenticated customer profile', async () => {
    const payload = {
      email: 'buyer@example.com',
      firstName: 'Minh',
      lastName: 'Tran',
      phoneNumber: '0901234567',
      birthday: '1995-12-31',
    };
    usersService.updateUser.mockResolvedValue({ id: 'user-1', ...payload });

    await request(app.getHttpServer())
      .patch('/api/v1/users/me')
      .set('x-user-id', 'user-1')
      .send(payload)
      .expect(200)
      .expect({ id: 'user-1', ...payload });

    expect(usersService.updateUser).toHaveBeenCalledWith('user-1', payload);
  });

  it('PATCH /users/me/password validates password policy', async () => {
    await request(app.getHttpServer())
      .patch('/api/v1/users/me/password')
      .set('x-user-id', 'user-1')
      .send({ currentPassword: 'OldPassword@1', newPassword: 'weak' })
      .expect(400);

    expect(usersService.changePassword).not.toHaveBeenCalled();
  });

  it('GET /users only allows an administrator', async () => {
    await request(app.getHttpServer()).get('/api/v1/users').set('x-user-id', 'user-1').expect(403);

    usersService.findAll.mockResolvedValue([{ id: 'user-1' }]);
    await request(app.getHttpServer())
      .get('/api/v1/users')
      .set('x-user-id', 'admin-1')
      .set('x-user-role', Role.ADMIN)
      .expect(200)
      .expect([{ id: 'user-1' }]);
  });
});
