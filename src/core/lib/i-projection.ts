/**
 * 0 specifically excludes a field
 * 1 includes a field at the exclusion of all others that are not explicitly included
 *
 * id is returned by default, unless specifically excluded
 *
 * IProjetions allow sub documents to be projected.
 */
export interface IProjection {
  [key: string]: boolean | number | IProjection;
}

