import { IProjection } from './';

/**
 * Passed to things like [[toJson]]. If you pass an object as context `toJson` (for example), the full content
 * of the context object is passed to things like `@Json({toJson})` and methods decorated with `@ToJson`.
 *
 * `context`: the context to apply (if not provided, the context is set to `default`).
 * `projection`: defines how resulting json should be projected from things like `toJson`.
 */
export interface IContext {
  [key: string]: any;

  context?: string;
  projection?: IProjection;
}
