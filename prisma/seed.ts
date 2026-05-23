import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Role, UserStatus } from '@prisma/client';
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
