import { createServer } from "../server";

const app = createServer();

// Vercel serverless function handler
export default async function handler(req: any, res: any) {
  return app(req, res);
}

