import { IJWTPayload } from '../../modules/auth/types/user.interface';

declare global {
  namespace Express {
    interface Request {
      user?: IJWTPayload;  // Single source of truth
    }
  }
}

export {};