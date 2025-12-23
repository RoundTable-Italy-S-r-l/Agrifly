// Type augmentation for Express Request
// This extends the Express Request interface to include user info from JWT auth

declare namespace Express {
  export interface Request {
    user?: {
      userId: string;
      orgId: string;
      role: string;
      isAdmin: boolean;
    };
  }
}
