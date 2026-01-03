// Type definitions for extended Hono context
import type { Context } from "hono";

declare module "hono" {
  interface ContextVariableMap {
    validatedBody: any;
    validatedQuery: any;
    validatedParams: any;
    user: any;
  }
}
