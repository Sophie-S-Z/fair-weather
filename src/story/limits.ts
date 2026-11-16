// The "Where this model is wrong" page (spec 19.1, ADR 0014 item 13): its words come from
// content/notes/model-limits.json. A limit may have no source, unlike a margin note.
import { z } from 'zod';
// With the import attribute, so tools/content-validate can load this file in Node.
import limitsJson from '../../content/notes/model-limits.json' with { type: 'json' };
import { SourceSchema } from './schema.ts';

const line = z.string().min(1);
export const ModelLimitsSchema = z.strictObject({
  title: line,
  items: z.array(z.strictObject({ heading: line, text: line, sources: z.array(SourceSchema) })).min(1),
});
export type ModelLimits = z.infer<typeof ModelLimitsSchema>;

export const MODEL_LIMITS: ModelLimits = ModelLimitsSchema.parse(limitsJson);
