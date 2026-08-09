import { z } from 'zod';

export const continuationSchema = z
  .string()
  .min(1, 'Continuation token must not be empty')
  .max(2048, 'Continuation token exceeds the size limit')
  .optional()
  .describe('Paste-ready continuation token from the previous result.');
