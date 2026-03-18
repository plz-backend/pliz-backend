import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Seed Categories
  const categories = [
    {
      name: 'Food',
      slug: 'food',
      description: 'Need money for food or groceries',
      icon: '🍔',
      sortOrder: 1,
    },
    {
      name: 'Transport',
      slug: 'transport',
      description: 'Need money for transport fare or fuel',
      icon: '🚗',
      sortOrder: 2,
    },
    {
      name: 'Rent',
      slug: 'rent',
      description: 'Need help paying rent or housing costs',
      icon: '🏠',
      sortOrder: 3,
    },
    {
      name: 'Medical',
      slug: 'medical',
      description: 'Need money for medical expenses or healthcare',
      icon: '🏥',
      sortOrder: 4,
    },
    {
      name: 'Education',
      slug: 'education',
      description: 'Need money for school fees or educational materials',
      icon: '📚',
      sortOrder: 5,
    },
    {
      name: 'Emergency',
      slug: 'emergency',
      description: 'Urgent unexpected expenses',
      icon: '🚨',
      sortOrder: 6,
    },
    {
      name: 'Other',
      slug: 'other',
      description: 'Other needs not listed above',
      icon: '💭',
      sortOrder: 7,
    },
  ];

  for (const category of categories) {
    await prisma.category.upsert({
      where: { slug: category.slug },
      update: {},
      create: category,
    });
  }

  console.log('✅ Categories seeded');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });