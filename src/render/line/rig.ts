import { z } from 'zod';

const Point = z.tuple([z.number(), z.number()]);

/** Number of samples along every line. */
export const RIG_POINTS = 128;

/** A creature's line, sampled into 128 points. Base center is (0, 0), height is 1, y grows upward. */
export const RigSchema = z.object({
  id: z.string().min(1),
  /** 128 `x, y` pairs. */
  points: z.array(z.number()).length(RIG_POINTS * 2),
  /** One value per point: 0 head, 1 body, 2 base. */
  region: z.array(z.union([z.literal(0), z.literal(1), z.literal(2)])).length(RIG_POINTS),
  markers: z.object({
    eyeL: Point,
    eyeR: Point,
    blush: Point,
    prop: Point.optional(),
  }),
  /** Path length in rig units. */
  length: z.number().positive(),
});

export type Rig = z.infer<typeof RigSchema>;
