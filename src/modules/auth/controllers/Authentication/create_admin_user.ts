import { Request, Response } from 'express';
import { UserService } from '../../services/user.service';
import { IApiResponse, ICreateAdminRequest, UserRole } from '../../types/user.interface';
import logger from '../../../../config/logger';

/**
 * @route   POST /api/auth/admin/create-user
 * @desc    Create admin or superadmin user (RESTRICTED)
 * @access  Admin/Superadmin only
 */
export const createAdminUser = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { username, email, password, confirmPassword, role }: ICreateAdminRequest = req.body;
    const currentUserRole = req.user?.role;
    const currentUserId = req.user?.userId;

    logger.info('Admin user creation attempt', {
      requestedBy: currentUserId,
      requestedRole: role,
      currentUserRole,
    });

    // ============================================
    // VALIDATION
    // ============================================

    // Validate all required fields
    if (!username || !email || !password || !confirmPassword || !role) {
      const response: IApiResponse = {
        success: false,
        message: 'All fields are required',
      };
      res.status(400).json(response);
      return;
    }

    // Validate role is admin or superadmin
    if (role !== UserRole.admin && role !== UserRole.superadmin) {
      const response: IApiResponse = {
        success: false,
        message: 'Invalid role. Must be admin or superadmin',
      };
      res.status(400).json(response);
      return;
    }

    // ============================================
    // PERMISSION CHECK
    // ============================================

    // Only superadmin can create superadmin
    if (role === UserRole.superadmin && currentUserRole !== UserRole.superadmin) {
      logger.warn('Unauthorized superadmin creation attempt', {
        requestedBy: currentUserId,
        currentRole: currentUserRole,
      });

      const response: IApiResponse = {
        success: false,
        message: 'Only superadmins can create other superadmins',
      };
      res.status(403).json(response);
      return;
    }

    // ============================================
    // PASSWORD VALIDATION
    // ============================================

    // Check if passwords match
    if (password !== confirmPassword) {
      const response: IApiResponse = {
        success: false,
        message: 'Passwords do not match',
      };
      res.status(400).json(response);
      return;
    }

    // Validate password strength
    if (password.length < 8) {
      const response: IApiResponse = {
        success: false,
        message: 'Password must be at least 8 characters long',
      };
      res.status(400).json(response);
      return;
    }

    // ============================================
    // CHECK IF USER EXISTS
    // ============================================

    const existingUser = await UserService.findByEmailOrUsername(email, username);

    if (existingUser) {
      const response: IApiResponse = {
        success: false,
        message: existingUser.email === email.toLowerCase()
          ? 'Email already registered'
          : 'Username already taken',
      };
      res.status(409).json(response);
      return;
    }

    // ============================================
    // CREATE ADMIN USER
    // ============================================

    const user = await UserService.createUser({
      username,
      email,
      password,
      role,  // admin or superadmin
    });

    // Note: Admin accounts are auto-verified (no email verification needed)
    if (user) {
      await UserService.verifyEmail(user.email);
    }

    logger.info('Admin user created successfully', {
      userId: user.id,
      username: user.username,
      role: user.role,
      createdBy: currentUserId,
    });

    const response: IApiResponse = {
      success: true,
      message: `${role} user created successfully`,
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          isEmailVerified: true,
        },
      },
    };

    res.status(201).json(response);
  } catch (error: any) {
    logger.error('Admin user creation error', {
      error: error.message,
      stack: error.stack,
      requestedBy: req.user?.userId,
    });

    const response: IApiResponse = {
      success: false,
      message: 'Failed to create admin user',
    };

    res.status(500).json(response);
  }
};