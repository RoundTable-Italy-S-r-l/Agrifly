import { MiddlewareHandler } from 'hono';
import { verifyJWT } from '../utils/auth';

export const authMiddleware: MiddlewareHandler = async (c, next) => {
  try {
    const authHeader = c.req.header('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('🔒 Auth middleware: No Authorization header');
      return c.json({ error: 'Authorization header missing or invalid' }, 401);
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    console.log('🔒 Auth middleware: Verifying token...', token.substring(0, 50) + '...');

    const decoded = verifyJWT(token);

    if (!decoded) {
      console.log('🔒 Auth middleware: Token verification failed');
      return c.json({ error: 'Invalid token' }, 401);
    }

    console.log('🔒 Auth middleware: Token decoded successfully', {
      userId: decoded.userId,
      orgId: decoded.orgId,
      role: decoded.role
    });

    // Map orgId to organizationId for compatibility
    const user = {
      ...decoded,
      organizationId: decoded.orgId || decoded.organizationId
    };

    // Add user to context
    c.set('user', user);

    await next();
  } catch (error: any) {
    console.error('🔒 Auth middleware error:', error.message, error.stack);
    return c.json({ error: 'Authentication failed' }, 401);
  }
};
