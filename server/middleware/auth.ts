import { Request, Response, NextFunction } from "express";
import { verifyJWT } from "../utils/auth";

// Estende Request per includere user info
export interface AuthRequest extends Request {
  user?: {
    userId: string;
    orgId: string;
    role: string;
    isAdmin: boolean;
  };
}

// Middleware per verificare JWT token
export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token non fornito' });
  }

  const token = authHeader.substring(7);
  const payload = verifyJWT(token);

  if (!payload) {
    return res.status(401).json({ error: 'Token non valido o scaduto' });
  }

  req.user = payload as any;
  next();
}

// Middleware opzionale (non blocca se non c'è token)
export function optionalAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const payload = verifyJWT(token);
    if (payload) {
      req.user = payload as any;
    }
  }

  next();
}

