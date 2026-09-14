import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Role } from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';
import { JwtAuthGuard } from '../src/common/guards/jwt-auth-guard';
import { RolesGuard } from '../src/common/guards/roles.guard';
import { FlashSalesController } from '../src/modules/flash-sales/flash-sales.controller';
import { FlashSalesService } from '../src/modules/flash-sales/flash-sales.service';
import { TestJwtAuthGuard, TestRolesGuard } from './support/test-auth-guards';

describe('FlashSalesController (e2e)', () => {
  let app: INestApplication<App>;
  const flashSalesService = {
    findActive: jest.fn(),
    create: jest.fn(),
    findReports: jest.fn(),
    findReport: jest.fn(),
    reserve: jest.fn(),
    findReservation: jest.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [FlashSalesController],
      providers: [
        {
          provide: FlashSalesService,
          useValue: flashSalesService,
        },
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

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /flash-sales/active returns currently available campaigns publicly', async () => {
    const activeSales = [{ id: 'sale-1', name: 'Lunch Sale', items: [] }];
    flashSalesService.findActive.mockResolvedValue(activeSales);

    await request(app.getHttpServer())
      .get('/api/v1/flash-sales/active')
      .expect(200)
      .expect(activeSales);

    expect(flashSalesService.findActive).toHaveBeenCalledTimes(1);
  });

  it('POST /flash-sales lets an admin create a campaign', async () => {
    const payload = {
      name: 'Lunch Sale',
      startsAt: '2026-06-01T05:00:00.000Z',
      endsAt: '2026-06-01T06:00:00.000Z',
      items: [
        {
          productId: 'product-1',
          salePrice: 79000,
          stockLimit: 20,
          perUserLimit: 1,
        },
      ],
    };
    flashSalesService.create.mockResolvedValue({ id: 'sale-1', ...payload });

    await request(app.getHttpServer())
      .post('/api/v1/flash-sales')
      .set('x-user-id', 'admin-1')
      .set('x-user-role', Role.ADMIN)
      .send(payload)
      .expect(201)
      .expect({ id: 'sale-1', ...payload });

    expect(flashSalesService.create).toHaveBeenCalledWith(payload);
  });

  it('GET /flash-sales/reports rejects a regular customer', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/flash-sales/reports')
      .set('x-user-id', 'customer-1')
      .expect(403);

    expect(flashSalesService.findReports).not.toHaveBeenCalled();
  });

  it('POST /flash-sales/items/:itemId/reservations reserves stock for the logged-in user', async () => {
    const reservation = {
      id: 'reservation-1',
      itemId: 'item-1',
      userId: 'customer-1',
      quantity: 2,
    };
    flashSalesService.reserve.mockResolvedValue(reservation);

    await request(app.getHttpServer())
      .post('/api/v1/flash-sales/items/item-1/reservations')
      .set('x-user-id', 'customer-1')
      .send({ quantity: 2 })
      .expect(201)
      .expect(reservation);

    expect(flashSalesService.reserve).toHaveBeenCalledWith('item-1', 'customer-1', 2);
  });

  it('POST /flash-sales/items/:itemId/reservations validates quantity before reserving', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/flash-sales/items/item-1/reservations')
      .set('x-user-id', 'customer-1')
      .send({ quantity: 0 })
      .expect(400);

    expect(flashSalesService.reserve).not.toHaveBeenCalled();
  });

  it('POST /flash-sales/items/:itemId/reservations requires authentication', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/flash-sales/items/item-1/reservations')
      .send({ quantity: 1 })
      .expect(401);

    expect(flashSalesService.reserve).not.toHaveBeenCalled();
  });
});
