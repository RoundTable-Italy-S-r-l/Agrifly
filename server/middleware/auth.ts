import { MiddlewareHandler } from "hono";
import { verifyJWT } from "../utils/auth";

export const authMiddleware: MiddlewareHandler = async (c, next) => {
  try {
    console.log(
      "🔒 [AUTH MIDDLEWARE] ===========================================",
    );
    console.log("🔒 [AUTH MIDDLEWARE] Path:", c.req.path);
    console.log("🔒 [AUTH MIDDLEWARE] Method:", c.req.method);

    const authHeader = c.req.header("Authorization");
    console.log("🔒 [AUTH MIDDLEWARE] Has Authorization header:", !!authHeader);
    console.log(
      "🔒 [AUTH MIDDLEWARE] Authorization header starts with Bearer:",
      authHeader?.startsWith("Bearer "),
    );

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.log(
        "❌ [AUTH MIDDLEWARE] No Authorization header or invalid format",
      );
      console.log(
        "🔒 [AUTH MIDDLEWARE] ===========================================",
      );
      return c.json({ error: "Authorization header missing or invalid" }, 401);
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    console.log(
      "🔒 [AUTH MIDDLEWARE] Verifying token...",
      token.substring(0, 50) + "...",
    );

    const decoded = verifyJWT(token);

    if (!decoded) {
      console.log("❌ [AUTH MIDDLEWARE] Token verification failed");
      console.log(
        "🔒 [AUTH MIDDLEWARE] ===========================================",
      );
      return c.json({ error: "Invalid token" }, 401);
    }

    console.log("✅ [AUTH MIDDLEWARE] Token decoded successfully", {
      userId: decoded.userId,
      orgId: decoded.orgId,
      role: decoded.role,
      organizationId: decoded.orgId || decoded.organizationId,
    });

    // Map orgId to organizationId for compatibility
    const user = {
      ...decoded,
      organizationId: decoded.orgId || decoded.organizationId,
    };

    console.log("✅ [AUTH MIDDLEWARE] User object:", {
      ...user,
      token: "[REDACTED]",
    });

    // Add user to context
    c.set("user", user);

    console.log("✅ [AUTH MIDDLEWARE] Calling next()");
    console.log(
      "🔒 [AUTH MIDDLEWARE] ===========================================",
    );

    await next();
  } catch (error: any) {
    console.error("❌ [AUTH MIDDLEWARE] Error:", error.message);
    console.error("❌ [AUTH MIDDLEWARE] Stack:", error.stack);
    console.log(
      "🔒 [AUTH MIDDLEWARE] ===========================================",
    );
    return c.json({ error: "Authentication failed" }, 401);
  }
};
