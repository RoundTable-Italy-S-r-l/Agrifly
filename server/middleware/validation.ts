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
    console.log('🔍 [VALIDATION] Starting validation middleware for:', c.req.path);
    let body;
    try {
      console.log('🔍 [VALIDATION] Attempting to parse JSON body');
      body = await c.req.json();
      console.log('✅ [VALIDATION] JSON parsed successfully, body type:', typeof body);
    } catch (parseError) {
      console.error('❌ [VALIDATION] JSON parse error:', parseError);
      console.error('❌ [VALIDATION] Raw body might be invalid');
      return c.json({
        error: 'Invalid JSON',
        message: 'Il corpo della richiesta non è un JSON valido'
      }, 400);
    }

    try {
      console.log('🔍 [VALIDATION] Starting Zod validation');
      // Validate and optionally transform
      let validatedData: z.infer<T>;

      if (options.transform) {
        console.log('🔍 [VALIDATION] Using transform mode');
        validatedData = schema.parse(body);
      } else {
        console.log('🔍 [VALIDATION] Using standard validation mode');
        schema.parse(body);
        validatedData = body as z.infer<T>;
      }

      // Strip unknown properties if requested
      if (options.stripUnknown && typeof validatedData === 'object') {
        console.log('🔍 [VALIDATION] Stripping unknown properties');
        const schemaKeys = new Set(Object.keys(schema.shape || {}));
        validatedData = Object.fromEntries(
          Object.entries(validatedData).filter(([key]) => schemaKeys.has(key))
        ) as z.infer<T>;
      }

      console.log('✅ [VALIDATION] Validation successful, storing validatedBody');
      // Store validated data in context
      c.set('validatedBody', validatedData);

      console.log('🔍 [VALIDATION] Calling next()');
      await next();
      console.log('✅ [VALIDATION] Middleware completed successfully');
    } catch (error) {
      console.error('❌ [VALIDATION] Error in validation block:', error);
      console.error('❌ [VALIDATION] Error type:', error.constructor.name);
      console.error('❌ [VALIDATION] Body status:', body ? 'defined' : 'undefined');

      if (error instanceof z.ZodError) {
        console.error('❌ [VALIDATION] Zod validation failed:', {
          errors: error.errors,
          body: body ? JSON.stringify(body).substring(0, 200) : 'undefined'
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

      // Handle transform errors (like invalid number formats)
      console.error('❌ [VALIDATION] Transform error:', error);
      console.error('❌ [VALIDATION] Error stack:', error.stack);
      return c.json({
        error: 'Validation failed',
        message: 'I dati forniti contengono valori non validi',
        details: [{ field: 'unknown', message: error.message, code: 'transform_error' }]
      }, 400);
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
