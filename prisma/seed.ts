import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({
  adapter,
});

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

function generateSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]/g, '');
}

async function main() {
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

  console.log(`Seeded ${tags.length} tags.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
