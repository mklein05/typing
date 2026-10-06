// Ambient augmentation for the fields this app attaches to an Express request.
//
// `requireAuth` (auth.ts) sets `userId` after verifying the Supabase token, and
// `requireQuota` (entitlements.ts) sets `quota` when it consumes an allowance.

import type { QuotaResult } from './entitlements.js';

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      quota?: QuotaResult;
    }
  }
}

export {};
