import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Role } from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';
import { JwtAuthGuard } from '../src/common/guards/jwt-auth-guard';
import { RolesGuard } from '../src/common/guards/roles.guard';
import { BrandsController } from '../src/modules/brands/brands.controller';
import { BrandsService } from '../src/modules/brands/brands.service';
import { CategoriesController } from '../src/modules/categories/categories.controller';
import { CategoriesService } from '../src/modules/categories/categories.service';
import { CouponsController } from '../src/modules/coupons/coupons.controller';
import { CouponsService } from '../src/modules/coupons/coupons.service';
import { ProductsController } from '../src/modules/products/products.controller';
import { ProductsService } from '../src/modules/products/products.service';
import { TagsController } from '../src/modules/tags/tags.controller';
import { TagsService } from '../src/modules/tags/tags.service';
import { VariantsController } from '../src/modules/variants/variants.controller';
import { VariantsService } from '../src/modules/variants/variants.service';
import { TestJwtAuthGuard, TestRolesGuard } from './support/test-auth-guards';

describe('Catalog API (e2e)', () => {
  let app: INestApplication<App>;
  const productsService = { findAll: jest.fn(), create: jest.fn() };
  const categoriesService = { findAll: jest.fn(), create: jest.fn() };
  const brandsService = { findAll: jest.fn(), create: jest.fn() };
  const tagsService = { findAll: jest.fn(), create: jest.fn() };
  const variantsService = { findAll: jest.fn(), create: jest.fn() };
  const couponsService = { validate: jest.fn(), findAll: jest.fn() };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [
        ProductsController,
        CategoriesController,
        BrandsController,
        TagsController,
        VariantsController,
        CouponsController,
      ],
      providers: [
        { provide: ProductsService, useValue: productsService },
        { provide: CategoriesService, useValue: categoriesService },
        { provide: BrandsService, useValue: brandsService },
        { provide: TagsService, useValue: tagsService },
        { provide: VariantsService, useValue: variantsService },
        { provide: CouponsService, useValue: couponsService },
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

  it('GET /products passes search filters to the catalog service', async () => {
    const response = { data: [{ id: 'product-1' }], meta: { total: 1 } };
    productsService.findAll.mockResolvedValue(response);

    await request(app.getHttpServer())
      .get('/api/v1/products?search=watch&isActive=true&page=1&limit=5')
      .expect(200)
      .expect(response);

    expect(productsService.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ search: 'watch', isActive: true, page: 1, limit: 5 }),
    );
  });

  it.each([
    ['/api/v1/categories', categoriesService],
    ['/api/v1/brands', brandsService],
    ['/api/v1/tags', tagsService],
    ['/api/v1/variants', variantsService],
  ])('GET %s returns public catalog filters', async (path, service) => {
    service.findAll.mockResolvedValue({ data: [], meta: { total: 0 } });

    await request(app.getHttpServer()).get(path).expect(200);

    expect(service.findAll).toHaveBeenCalledTimes(1);
  });

  it('POST /coupons/validate is public and validates checkout discount input', async () => {
    const discount = { code: 'FLASH50', discountAmount: 50, finalAmount: 150 };
    couponsService.validate.mockResolvedValue(discount);

    await request(app.getHttpServer())
      .post('/api/v1/coupons/validate')
      .send({ code: 'FLASH50', subtotal: 200 })
      .expect(201)
      .expect(discount);

    expect(couponsService.validate).toHaveBeenCalledWith({
      code: 'FLASH50',
      subtotal: 200,
    });
  });

  it('POST /products blocks non-admin catalog mutations', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/products')
      .set('x-user-id', 'customer-1')
      .send({})
      .expect(403);

    expect(productsService.create).not.toHaveBeenCalled();
  });

  it('GET /coupons is available only to an administrator', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/coupons')
      .set('x-user-id', 'customer-1')
      .expect(403);

    couponsService.findAll.mockResolvedValue({ data: [], meta: { total: 0 } });
    await request(app.getHttpServer())
      .get('/api/v1/coupons')
      .set('x-user-id', 'admin-1')
      .set('x-user-role', Role.ADMIN)
      .expect(200);
  });
});
