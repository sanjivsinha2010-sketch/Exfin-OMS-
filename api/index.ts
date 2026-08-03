import type { VercelRequest, VercelResponse } from '@vercel/node';
import { app } from '../server';

export default function handler(req: VercelRequest, res: VercelResponse) {
  console.log(`[Vercel Function] ${req.method} ${req.url}`);
  return app(req, res);
}
