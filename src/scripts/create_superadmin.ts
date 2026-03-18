import bcrypt from 'bcryptjs';
import prisma from '../config/database';
import { UserRole } from '../modules/auth/types/user.interface';

/**
 * Create the first superadmin user
 * Run: npx ts-node src/scripts/create_superadmin.ts
 */
async function createSuperAdmin() {
  try {
    console.log('🔧 Creating SuperAdmin...\n');

    const email = 'superadmin@pliz.app';
    const username = 'superadmin';
    const password = 'SuperAdmin123!@#';  

    // Check if superadmin already exists
    const existing = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { username }],
      },
    });

    if (existing) {
      console.log('❌ SuperAdmin already exists');
      console.log('📧 Email:', existing.email);
      console.log('👤 Username:', existing.username);
      console.log('🆔 User ID:', existing.id);
      return;
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create superadmin
    const superadmin = await prisma.user.create({
      data: {
        username,
        email,
        passwordHash,
        role: UserRole.superadmin,
        isEmailVerified: true,
        isProfileComplete: true,
      },
    });

    console.log('✅ SuperAdmin created successfully!\n');
    console.log('═══════════════════════════════════════');
    console.log('📧 Email:', email);
    console.log('👤 Username:', username);
    console.log('🔑 Password:', password);
    console.log('🆔 User ID:', superadmin.id);
    console.log('═══════════════════════════════════════\n');
    console.log('⚠️  IMPORTANT: Change this password immediately after first login!');
  } catch (error) {
    console.error('❌ Error creating superadmin:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createSuperAdmin();