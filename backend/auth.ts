import { createClient } from '@supabase/supabase-js';
import type { RequestHandler } from 'express';

const supabase = createClient(
  process.env.SUPABASE_URL ?? '',
  process.env.SUPABASE_ANON_KEY ?? ''
);

export const requireAuth: RequestHandler = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ detail: 'Missing or invalid token format' });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      res.status(401).json({ detail: 'Invalid or expired token' });
      return;
    }

    req.userId = user.id;
    next(); // Pass control to the next handler
  } catch (err) {
    console.error('[auth] Verification error:', err instanceof Error ? err.message : err);
    res.status(401).json({ detail: 'Token verification failed' });
  }
};
