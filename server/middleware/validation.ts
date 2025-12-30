import { MiddlewareHandler } from 'hono';
import { z } from 'zod';

// Validation middleware factory
export const validateBody = <T extends z.ZodSchema>(
  schema: T,
  options: {
    transform?: boolean;
    stripUnknown?: boolean;
  } = {}
): MiddlewareHandler => {
  return async (c, next) => {
    try {
      const body = await c.req.json();

      // Validate and optionally transform
      let validatedData: z.infer<T>;

      if (options.transform) {
        validatedData = schema.parse(body);
      } else {
        // Just validate without transforming
        schema.parse(body);
        validatedData = body as z.infer<T>;
      }

      // Strip unknown properties if requested
      if (options.stripUnknown && typeof validatedData === 'object') {
        const schemaKeys = new Set(Object.keys(schema.shape || {}));
        validatedData = Object.fromEntries(
          Object.entries(validatedData).filter(([key]) => schemaKeys.has(key))
        ) as z.infer<T>;
      }

      // Store validated data in context
      c.set('validatedBody', validatedData);

      await next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error('❌ [VALIDATION] Validation failed:', {
          errors: error.errors,
          body: await c.req.json().catch(() => 'Unable to parse body')
        });

        return c.json({
          error: 'Validation failed',
          message: 'I dati forniti non sono validi',
          details: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
            code: err.code
          }))
        }, 400);
      }

      // Re-throw non-validation errors
      throw error;
    }
  };
};

// Query parameter validation middleware
export const validateQuery = <T extends z.ZodSchema>(
  schema: T
): MiddlewareHandler => {
  return async (c, next) => {
    try {
      const query = Object.fromEntries(
        Object.entries(c.req.queries()).map(([key, value]) => [
          key,
          Array.isArray(value) ? value[0] : value
        ])
      );

      const validatedData = schema.parse(query);
      c.set('validatedQuery', validatedData);

      await next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return c.json({
          error: 'Invalid query parameters',
          details: error.errors
        }, 400);
      }
      throw error;
    }
  };
};

// Parameter validation middleware
export const validateParams = <T extends z.ZodSchema>(
  schema: T
): MiddlewareHandler => {
  return async (c, next) => {
    try {
      const params = c.req.param();
      const validatedData = schema.parse(params);
      c.set('validatedParams', validatedData);

      await next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return c.json({
          error: 'Invalid URL parameters',
          details: error.errors
        }, 400);
      }
      throw error;
    }
  };
};
