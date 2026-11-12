// The tuning story reads (spec 9). Story may not import src/sim as values (spec 14.2), so it cannot
// run TuningSchema here; the typed import checks the shape at compile time, and TuningSchema
// validates the same file in validate-content and in the worker's init.
import tuningJson from '../../content/tuning.json';
import type { Tuning } from '../sim/types.ts';

export const tuning: Tuning = tuningJson;
