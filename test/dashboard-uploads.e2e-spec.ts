import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Role } from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';
import { JwtAuthGuard } from '../src/common/guards/jwt-auth-guard';
import { RolesGuard } from '../src/common/guards/roles.guard';
import { DashboardController } from '../src/modules/dashboard/dashboard.controller';
import { DashboardService } from '../src/modules/dashboard/dashboard.service';
import { UploadsController } from '../src/modules/uploads/uploads.controller';
import { UploadsService } from '../src/modules/uploads/uploads.service';
import { TestJwtAuthGuard, TestRolesGuard } from './support/test-auth-guards';

describe('Dashboard and Uploads API (e2e)', () => {
  let app: INestApplication<App>;
  const dashboardService = { analytics: jest.fn() };
  const uploadsService = { uploadImage: jest.fn() };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [DashboardController, UploadsController],
      providers: [
        { provide: DashboardService, useValue: dashboardService },
        { provide: UploadsService, useValue: uploadsService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
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

  it('GET /dashboard/analytics returns reporting data for an administrator', async () => {
    dashboardService.analytics.mockResolvedValue({ summary: { revenue: 100000 } });

    await request(app.getHttpServer())
      .get('/api/v1/dashboard/analytics?days=30')
      .set('x-user-id', 'admin-1')
      .set('x-user-role', Role.ADMIN)
      .expect(200)
      .expect({ summary: { revenue: 100000 } });

    expect(dashboardService.analytics).toHaveBeenCalledWith(30);
  });

  it('GET /dashboard/analytics rejects invalid ranges and non-admin access', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/dashboard/analytics?days=10')
      .set('x-user-id', 'admin-1')
      .set('x-user-role', Role.ADMIN)
      .expect(400);

    await request(app.getHttpServer())
      .get('/api/v1/dashboard/analytics?days=30')
      .set('x-user-id', 'customer-1')
      .expect(403);
  });

  it('POST /uploads/image uploads authenticated multipart image data', async () => {
    uploadsService.uploadImage.mockResolvedValue({
      imageUrl: 'https://images.example/product.png',
    });

    await request(app.getHttpServer())
      .post('/api/v1/uploads/image?folder=products')
      .set('x-user-id', 'admin-1')
      .attach('file', Buffer.from('image-bytes'), {
        filename: 'product.png',
        contentType: 'image/png',
      })
      .expect(201)
      .expect({ imageUrl: 'https://images.example/product.png' });

    expect(uploadsService.uploadImage).toHaveBeenCalledWith(
      expect.objectContaining({ originalname: 'product.png' }),
      'products',
    );
  });

  it('POST /uploads/image requires authentication', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/uploads/image')
      .attach('file', Buffer.from('image-bytes'), 'product.png')
      .expect(401);
  });
});
