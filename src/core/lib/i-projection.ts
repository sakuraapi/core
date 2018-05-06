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

export class InvalidQueryError extends Error {

  constructor(public entry?: any) {
    super('invalid_query');
  }
}

/**
 * Takes a JSON parsable query string that is either an IProjection object, or a projection array.
 *
 * Array projections follow these formatting rules:
 *    - exclude a field: `['-id']`
 *    - exclude multiple fields: `['-id', '-name']`
 *    - exclude a field from a sub document: `['-subDocument.firstName']` or `['-subDocument.name.firstName']`
 *    - explicitly include a field: `['id']` (remember, this follows the rules of an [[IProjection]] (see [[toJson]])
 *    - explicitly include multiple fields: `['id', 'name']`
 *    - explicitly include from a sub document: `['subDocument.firstName']` or `['subDocument.name.firstName']`
 */
export function projectionFromQuery(query: string) {

  let json;
  try {
    json = JSON.parse(query);
  } catch {
    throw new InvalidQueryError();
  }

  if (!Array.isArray(json)) {
    return json;
  }

  const projection: IProjection = {};

  for (const entry  of json as string[]) {

    if (entry.length === 0 || entry === '-') {
      continue;
    }

    const parts = entry.split('.');

    if (parts.length === 1) {

      if (entry.startsWith && entry.startsWith('-')) {
        projection[entry.substr(1)] = 0;
      } else {
        projection[entry] = 1;
      }

    } else {

      const val = (entry.startsWith && entry.startsWith('-')) ? 0 : 1;
      if (val === 0) {
        parts[0] = parts[0].substr(1);
      }

      addNestedProjection(projection, parts, val);

    }
  }

  return projection;
}

function addNestedProjection(base: any, fields: string[], value: number): void {
  // credit: https://stackoverflow.com/a/11433067/2305837

  for (const field of fields) {
    if (field.length === 0 || field === '-') {
      return;
    }
  }

  const lastEntry = fields.pop();

  for (let i = 0; i < fields.length; i++) {
    base = base[fields[i]] = base[fields[i]] || {};
  }

  base[lastEntry] = value;
}
