// src/middleware/auth.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { IJWTPayload } from '../modules/auth/types/user.interface'; // Import centralized type

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

//  REMOVE THIS DUPLICATE DECLARATION
// declare global {
//   namespace Express {
//     interface Request {
//       user?: {
//         id: string;
//         email: string;
//       };
//     }
//   }
// }

/**
 * Middleware to authenticate required routes
 * Returns 401 if no valid token
 */
export const authenticateRequired = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = extractToken(req);
    
    if (!token) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'NO_TOKEN',
      });
    }
    
    const decoded = jwt.verify(token, JWT_SECRET) as IJWTPayload; // ✅ Use IJWTPayload
    
    // Assign the full decoded payload
    req.user = decoded;
    
    next();
  } catch (error) {
    return res.status(401).json({
      error: 'Invalid or expired token',
      code: 'INVALID_TOKEN',
    });
  }
};

/**
 * Middleware to optionally authenticate
 * Continues without error if no token present
 */
export const authenticateOptional = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = extractToken(req);
    
    if (!token) {
      return next(); // No token, continue as anonymous
    }
    
    const decoded = jwt.verify(token, JWT_SECRET) as IJWTPayload; // Use IJWTPayload
    
    // Assign the full decoded payload
    req.user = decoded;
    
    next(); 
  } catch (error) {
    // Invalid token, but continue as anonymous
    next();
  }
};

/**
 * Extract JWT token from Authorization header
 */
function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return null;
  }
  
  // Format: "Bearer <token>"
  const parts = authHeader.split(' ');
  
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }
  
  return parts[1];
}