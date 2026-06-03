import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { OrderStatus, Role } from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';
import { JwtAuthGuard } from '../src/common/guards/jwt-auth-guard';
import { RolesGuard } from '../src/common/guards/roles.guard';
import { CartController } from '../src/modules/cart/cart.controller';
import { CartService } from '../src/modules/cart/cart.service';
import { OrdersController } from '../src/modules/orders/orders.controller';
import { OrdersService } from '../src/modules/orders/orders.service';
import { PaymentsController } from '../src/modules/payments/payments.controller';
import { PaymentsService } from '../src/modules/payments/payments.service';
import { WishlistController } from '../src/modules/wishlist/wishlist.controller';
import { WishlistService } from '../src/modules/wishlist/wishlist.service';
import { TestJwtAuthGuard, TestRolesGuard } from './support/test-auth-guards';

describe('Shopping API (e2e)', () => {
  let app: INestApplication<App>;
  const cartService = {
    findOpenCart: jest.fn(),
    addItem: jest.fn(),
  };
  const wishlistService = {
    findAll: jest.fn(),
    addItem: jest.fn(),
  };
  const ordersService = {
    findAll: jest.fn(),
    create: jest.fn(),
    updateStatus: jest.fn(),
  };
  const paymentsService = {
    createPaymentLink: jest.fn(),
    handleWebhook: jest.fn(),
    confirmWebhook: jest.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [CartController, WishlistController, OrdersController, PaymentsController],
      providers: [
        { provide: CartService, useValue: cartService },
        { provide: WishlistService, useValue: wishlistService },
        { provide: OrdersService, useValue: ordersService },
        { provide: PaymentsService, useValue: paymentsService },
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

  it('GET /cart requires a logged-in customer', async () => {
    await request(app.getHttpServer()).get('/api/v1/cart').expect(401);

    cartService.findOpenCart.mockResolvedValue({ id: 'cart-1', items: [] });
    await request(app.getHttpServer())
      .get('/api/v1/cart')
      .set('x-user-id', 'customer-1')
      .expect(200)
      .expect({ id: 'cart-1', items: [] });
  });

  it('POST /cart/items validates and forwards a selected product', async () => {
    const payload = { productId: 'product-1', variationId: 'variation-1', quantity: 2 };
    cartService.addItem.mockResolvedValue({ itemCount: 2 });

    await request(app.getHttpServer())
      .post('/api/v1/cart/items')
      .set('x-user-id', 'customer-1')
      .send(payload)
      .expect(201);

    expect(cartService.addItem).toHaveBeenCalledWith('customer-1', payload);
  });

  it('POST /wishlist/items saves a product for the logged-in customer', async () => {
    wishlistService.addItem.mockResolvedValue({ itemCount: 1 });

    await request(app.getHttpServer())
      .post('/api/v1/wishlist/items')
      .set('x-user-id', 'customer-1')
      .send({ productId: 'product-1' })
      .expect(201)
      .expect({ itemCount: 1 });

    expect(wishlistService.addItem).toHaveBeenCalledWith('customer-1', {
      productId: 'product-1',
    });
  });

  it('GET /orders scopes the customer request through their authenticated identity', async () => {
    ordersService.findAll.mockResolvedValue({ data: [], meta: { total: 0 } });

    await request(app.getHttpServer())
      .get('/api/v1/orders?status=PENDING&page=1')
      .set('x-user-id', 'customer-1')
      .expect(200);

    expect(ordersService.findAll).toHaveBeenCalledWith(
      'customer-1',
      Role.USER,
      expect.objectContaining({ status: OrderStatus.PENDING, page: 1 }),
    );
  });

  it('PATCH /orders/:id/status rejects customer fulfillment updates', async () => {
    await request(app.getHttpServer())
      .patch('/api/v1/orders/order-1/status')
      .set('x-user-id', 'customer-1')
      .send({ status: OrderStatus.SHIPPED })
      .expect(403);

    expect(ordersService.updateStatus).not.toHaveBeenCalled();
  });

  it('POST /payments/payos/orders/:id/payment-link creates checkout data for a user order', async () => {
    const payload = {
      returnUrl: 'http://localhost:3000/checkout/success',
      cancelUrl: 'http://localhost:3000/checkout/cancel',
    };
    paymentsService.createPaymentLink.mockResolvedValue({ paymentLinkId: 'link-1' });

    await request(app.getHttpServer())
      .post('/api/v1/payments/payos/orders/order-1/payment-link')
      .set('x-user-id', 'customer-1')
      .send(payload)
      .expect(201)
      .expect({ paymentLinkId: 'link-1' });

    expect(paymentsService.createPaymentLink).toHaveBeenCalledWith(
      'order-1',
      'customer-1',
      Role.USER,
      payload,
    );
  });

  it('POST /payments/payos/webhook accepts a valid provider payload publicly', async () => {
    const payload = {
      code: '00',
      desc: 'success',
      success: true,
      data: { orderCode: 123 },
      signature: 'provider-signature',
    };
    paymentsService.handleWebhook.mockResolvedValue({ success: true });

    await request(app.getHttpServer())
      .post('/api/v1/payments/payos/webhook')
      .send(payload)
      .expect(200)
      .expect({ success: true });

    expect(paymentsService.handleWebhook).toHaveBeenCalledWith(payload);
  });
});
