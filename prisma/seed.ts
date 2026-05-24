import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { DiscountType, PrismaClient, Role, UserStatus } from '@prisma/client';
import * as argon2 from 'argon2';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({
  adapter,
});

const brandLogoUrl =
  'https://res.cloudinary.com/dpow8afng/image/upload/v1779438510/ecommerce/brands/vro3e6xzhtcnge3mya3q.jpg';

const brandNames = [
  'Nike',
  'Adidas',
  'Zara',
  'H&M',
  'Uniqlo',
  'Gucci',
  'Prada',
  'Louis Vuitton',
  'Chanel',
  'Dior',
];

const categoryNames = ['Men', 'Women', 'Kids', 'Shoes', 'Accessories'];

const productImageUrl =
  'https://res.cloudinary.com/dpow8afng/image/upload/v1779438510/ecommerce/products/placeholder.jpg';

const tagNames = [
  'New Arrival',
  'Best Seller',
  'Hot Deal',
  'Flash Sale',
  'Limited Edition',
  'Trending',
  'Featured',
  'Recommended',
  'Premium',
  'Budget Friendly',
  'Eco Friendly',
  'Exclusive',
  'Clearance',
  'Pre Order',
  'Back In Stock',
  'Free Shipping',
  'High Rated',
  'Staff Pick',
  'Online Only',
  'Gift Idea',
  'Bundle Deal',
  'Seasonal',
  'Summer Collection',
  'Winter Collection',
  'Holiday Special',
  'Office Essential',
  'Gaming',
  'Smart Home',
  'Wireless',
  'Portable',
  'Water Resistant',
  'Fast Charging',
  'Noise Cancelling',
  'Lightweight',
  'Durable',
  'Compact',
  'Luxury',
  'Minimalist',
  'Kids Friendly',
  'Travel Ready',
  'Fitness',
  'Shoes',
  'Outdoor',
  'Home Decor',
  'Kitchen Essential',
  'Fashion',
  'Beauty',
  'Skincare',
  'Health',
  'Accessories',
  'Warranty Included',
];

const seedUsers = Array.from({ length: 20 }, (_, index) => {
  const userNumber = index + 1;

  return {
    email: `user${userNumber}@example.com`,
    firstName: `User`,
    lastName: `${userNumber}`,
    phoneNumber: `+849000000${userNumber.toString().padStart(2, '0')}`,
    birthday: new Date(1990 + (index % 15), index % 12, (index % 28) + 1),
    role: Role.USER,
    status: UserStatus.ACTIVE,
    emailVerifiedAt: new Date(),
  };
});

const seedProducts = [
  {
    name: 'Nike Air Runner Jacket',
    sku: 'SEED-NIKE-AIR-RUNNER-JACKET',
    price: 129.99,
    stock: 45,
    categoryName: 'Men',
    brandName: 'Nike',
    tagNames: ['New Arrival', 'Flash Sale', 'Fitness'],
  },
  {
    name: 'Adidas Training Hoodie',
    sku: 'SEED-ADIDAS-TRAINING-HOODIE',
    price: 89.99,
    stock: 60,
    categoryName: 'Men',
    brandName: 'Adidas',
    tagNames: ['Best Seller', 'Fitness', 'Budget Friendly'],
  },
  {
    name: 'Zara Linen Shirt',
    sku: 'SEED-ZARA-LINEN-SHIRT',
    price: 49.99,
    stock: 80,
    categoryName: 'Men',
    brandName: 'Zara',
    tagNames: ['Summer Collection', 'Minimalist', 'Fashion'],
  },
  {
    name: 'Uniqlo Smart Ankle Pants',
    sku: 'SEED-UNIQLO-SMART-ANKLE-PANTS',
    price: 59.99,
    stock: 70,
    categoryName: 'Men',
    brandName: 'Uniqlo',
    tagNames: ['Office Essential', 'Recommended', 'Minimalist'],
  },
  {
    name: 'Gucci Signature Belt',
    sku: 'SEED-GUCCI-SIGNATURE-BELT',
    price: 399.99,
    stock: 20,
    categoryName: 'Accessories',
    brandName: 'Gucci',
    tagNames: ['Luxury', 'Premium', 'Gift Idea'],
  },
  {
    name: 'Prada Nylon Crossbody Bag',
    sku: 'SEED-PRADA-NYLON-CROSSBODY-BAG',
    price: 899.99,
    stock: 12,
    categoryName: 'Accessories',
    brandName: 'Prada',
    tagNames: ['Luxury', 'Travel Ready', 'Limited Edition'],
  },
  {
    name: 'Louis Vuitton Card Holder',
    sku: 'SEED-LV-CARD-HOLDER',
    price: 349.99,
    stock: 18,
    categoryName: 'Accessories',
    brandName: 'Louis Vuitton',
    tagNames: ['Luxury', 'Compact', 'Gift Idea'],
  },
  {
    name: 'Chanel Classic Sunglasses',
    sku: 'SEED-CHANEL-CLASSIC-SUNGLASSES',
    price: 549.99,
    stock: 15,
    categoryName: 'Accessories',
    brandName: 'Chanel',
    tagNames: ['Premium', 'Summer Collection', 'Fashion'],
  },
  {
    name: 'Dior Silk Scarf',
    sku: 'SEED-DIOR-SILK-SCARF',
    price: 299.99,
    stock: 25,
    categoryName: 'Women',
    brandName: 'Dior',
    tagNames: ['Luxury', 'Gift Idea', 'Featured'],
  },
  {
    name: 'H&M Cotton Dress',
    sku: 'SEED-HM-COTTON-DRESS',
    price: 39.99,
    stock: 100,
    categoryName: 'Women',
    brandName: 'H&M',
    tagNames: ['Budget Friendly', 'Summer Collection', 'Fashion'],
  },
  {
    name: 'Zara Satin Blazer',
    sku: 'SEED-ZARA-SATIN-BLAZER',
    price: 119.99,
    stock: 40,
    categoryName: 'Women',
    brandName: 'Zara',
    tagNames: ['Office Essential', 'Trending', 'Featured'],
  },
  {
    name: 'Uniqlo Ultra Light Down Vest',
    sku: 'SEED-UNIQLO-DOWN-VEST',
    price: 79.99,
    stock: 55,
    categoryName: 'Women',
    brandName: 'Uniqlo',
    tagNames: ['Winter Collection', 'Lightweight', 'Travel Ready'],
  },
  {
    name: 'Nike Kids Sports Set',
    sku: 'SEED-NIKE-KIDS-SPORTS-SET',
    price: 64.99,
    stock: 75,
    categoryName: 'Kids',
    brandName: 'Nike',
    tagNames: ['Kids Friendly', 'Fitness', 'Durable'],
  },
  {
    name: 'Adidas Kids Sneakers',
    sku: 'SEED-ADIDAS-KIDS-SNEAKERS',
    price: 69.99,
    stock: 65,
    categoryName: 'Kids',
    brandName: 'Adidas',
    tagNames: ['Kids Friendly', 'Shoes', 'Best Seller'],
  },
  {
    name: 'H&M Kids Denim Jacket',
    sku: 'SEED-HM-KIDS-DENIM-JACKET',
    price: 34.99,
    stock: 90,
    categoryName: 'Kids',
    brandName: 'H&M',
    tagNames: ['Kids Friendly', 'Budget Friendly', 'Durable'],
  },
  {
    name: 'Nike Air Max Pulse',
    sku: 'SEED-NIKE-AIR-MAX-PULSE',
    price: 159.99,
    stock: 50,
    categoryName: 'Shoes',
    brandName: 'Nike',
    tagNames: ['Best Seller', 'High Rated', 'Flash Sale'],
  },
  {
    name: 'Adidas Ultraboost Light',
    sku: 'SEED-ADIDAS-ULTRABOOST-LIGHT',
    price: 189.99,
    stock: 35,
    categoryName: 'Shoes',
    brandName: 'Adidas',
    tagNames: ['Premium', 'Fitness', 'Lightweight'],
  },
  {
    name: 'Gucci Leather Loafers',
    sku: 'SEED-GUCCI-LEATHER-LOAFERS',
    price: 749.99,
    stock: 10,
    categoryName: 'Shoes',
    brandName: 'Gucci',
    tagNames: ['Luxury', 'Office Essential', 'Premium'],
  },
  {
    name: 'Prada Cloudbust Sneakers',
    sku: 'SEED-PRADA-CLOUDBUST-SNEAKERS',
    price: 1099.99,
    stock: 8,
    categoryName: 'Shoes',
    brandName: 'Prada',
    tagNames: ['Luxury', 'Limited Edition', 'Trending'],
  },
  {
    name: 'Dior B27 Low-Top Sneakers',
    sku: 'SEED-DIOR-B27-LOW-TOP',
    price: 1199.99,
    stock: 9,
    categoryName: 'Shoes',
    brandName: 'Dior',
    tagNames: ['Luxury', 'Exclusive', 'High Rated'],
  },
];

const seedCoupons = [
  {
    code: 'FLASH50',
    description: '50% off flash sale orders',
    discountType: DiscountType.PERCENTAGE,
    discountValue: 50,
    minOrderAmount: 100,
    maxDiscountAmount: 75,
    usageLimit: 200,
  },
  {
    code: 'WELCOME10',
    description: '10% off first purchase',
    discountType: DiscountType.PERCENTAGE,
    discountValue: 10,
    minOrderAmount: 30,
    maxDiscountAmount: 25,
    usageLimit: 500,
  },
  {
    code: 'FREESHIP25',
    description: 'Fixed discount for shipping support',
    discountType: DiscountType.FIXED_AMOUNT,
    discountValue: 25,
    minOrderAmount: 80,
    usageLimit: 300,
  },
  {
    code: 'VIP100',
    description: 'VIP fixed discount for premium carts',
    discountType: DiscountType.FIXED_AMOUNT,
    discountValue: 100,
    minOrderAmount: 500,
    usageLimit: 100,
  },
  {
    code: 'SUMMER20',
    description: '20% summer campaign discount',
    discountType: DiscountType.PERCENTAGE,
    discountValue: 20,
    minOrderAmount: 60,
    maxDiscountAmount: 40,
    usageLimit: 250,
  },
];

function generateSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]/g, '');
}

async function main() {
  const categories = categoryNames.map((name) => ({
    name,
    slug: generateSlug(name),
    description: `${name} fashion products.`,
    isActive: true,
  }));

  for (const category of categories) {
    await prisma.category.upsert({
      where: { slug: category.slug },
      update: {
        name: category.name,
        description: category.description,
        isActive: category.isActive,
      },
      create: category,
    });
  }

  const brands = brandNames.map((name) => ({
    name,
    slug: generateSlug(name),
    description: `${name} brand products.`,
    logoUrl: brandLogoUrl,
    isActive: true,
  }));

  for (const brand of brands) {
    await prisma.brand.upsert({
      where: { slug: brand.slug },
      update: {
        name: brand.name,
        description: brand.description,
        logoUrl: brand.logoUrl,
        isActive: brand.isActive,
      },
      create: brand,
    });
  }

  const tags = tagNames.map((name) => ({
    name,
    slug: generateSlug(name),
    description: `Products tagged as ${name}.`,
    isActive: true,
  }));

  for (const tag of tags) {
    await prisma.tag.upsert({
      where: { slug: tag.slug },
      update: {
        name: tag.name,
        description: tag.description,
        isActive: tag.isActive,
      },
      create: tag,
    });
  }

  const [createdCategories, createdBrands, createdTags] = await Promise.all([
    prisma.category.findMany({
      where: { slug: { in: categories.map((category) => category.slug) } },
    }),
    prisma.brand.findMany({
      where: { slug: { in: brands.map((brand) => brand.slug) } },
    }),
    prisma.tag.findMany({
      where: { slug: { in: tags.map((tag) => tag.slug) } },
    }),
  ]);

  const categoryByName = new Map(createdCategories.map((category) => [category.name, category]));
  const brandByName = new Map(createdBrands.map((brand) => [brand.name, brand]));
  const tagByName = new Map(createdTags.map((tag) => [tag.name, tag]));

  for (const seedProduct of seedProducts) {
    const category = categoryByName.get(seedProduct.categoryName);
    const brand = brandByName.get(seedProduct.brandName);

    if (!category || !brand) {
      throw new Error(`Missing category or brand for product ${seedProduct.sku}`);
    }

    const product = await prisma.product.upsert({
      where: { sku: seedProduct.sku },
      update: {
        name: seedProduct.name,
        description: `${seedProduct.name} from ${seedProduct.brandName}.`,
        price: seedProduct.price,
        stock: seedProduct.stock,
        imageUrl: productImageUrl,
        categoryId: category.id,
        brandId: brand.id,
        isActive: true,
      },
      create: {
        name: seedProduct.name,
        description: `${seedProduct.name} from ${seedProduct.brandName}.`,
        price: seedProduct.price,
        stock: seedProduct.stock,
        sku: seedProduct.sku,
        imageUrl: productImageUrl,
        categoryId: category.id,
        brandId: brand.id,
        isActive: true,
      },
    });

    await prisma.productImage.deleteMany({
      where: { productId: product.id },
    });

    await prisma.productImage.createMany({
      data: [
        {
          productId: product.id,
          imageUrl: productImageUrl,
          sortOrder: 0,
          isPrimary: true,
        },
      ],
    });

    await prisma.productTag.deleteMany({
      where: { productId: product.id },
    });

    await prisma.productTag.createMany({
      data: seedProduct.tagNames.map((tagName) => {
        const tag = tagByName.get(tagName);

        if (!tag) {
          throw new Error(`Missing tag ${tagName} for product ${seedProduct.sku}`);
        }

        return {
          productId: product.id,
          tagId: tag.id,
        };
      }),
    });
  }

  const couponStartsAt = new Date('2026-05-24T00:00:00.000Z');
  const couponExpiresAt = new Date('2030-12-31T23:59:59.000Z');

  for (const coupon of seedCoupons) {
    await prisma.coupon.upsert({
      where: { code: coupon.code },
      update: {
        ...coupon,
        startsAt: couponStartsAt,
        expiresAt: couponExpiresAt,
        isActive: true,
      },
      create: {
        ...coupon,
        startsAt: couponStartsAt,
        expiresAt: couponExpiresAt,
        isActive: true,
      },
    });
  }

  const hashedPassword = await argon2.hash('Password@123');

  for (const user of seedUsers) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {
        firstName: user.firstName,
        lastName: user.lastName,
        phoneNumber: user.phoneNumber,
        birthday: user.birthday,
        role: user.role,
        status: user.status,
        emailVerifiedAt: user.emailVerifiedAt,
      },
      create: {
        ...user,
        password: hashedPassword,
      },
    });
  }

  console.log(`Seeded ${categories.length} categories.`);
  console.log(`Seeded ${brands.length} brands.`);
  console.log(`Seeded ${tags.length} tags.`);
  console.log(`Seeded ${seedProducts.length} products.`);
  console.log(`Seeded ${seedCoupons.length} coupons.`);
  console.log(`Seeded ${seedUsers.length} users.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
