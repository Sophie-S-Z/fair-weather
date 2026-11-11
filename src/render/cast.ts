import { z } from 'zod';

/**
 * A named cast member's data (`content/cast/<id>.json`). `scale` sizes its body over a villager's,
 * so the cast reads as the stars. The object is open: later tasks add fields to the same files.
 */
export const CastSchema = z.object({
  id: z.string().min(1),
  scale: z.number().positive(),
});

export type Cast = z.infer<typeof CastSchema>;
