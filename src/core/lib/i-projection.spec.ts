import { projectionFromQuery } from './i-projection';

describe('projectionFromQuery', () => {

  describe('error handling', () => {

    it('throws with invalid query', () => {
      expect(() => {
        projectionFromQuery('!%@$');
      }).toThrowError('invalid_query');
    });

    it('skips empty entries', () => {
      const queryString = JSON.stringify(['', 'test']);
      const result = projectionFromQuery(queryString);

      expect(Object.keys(result).length).toBe(1);
      expect(result.test).toBe(1);
    });

    it('skips negated entries that are empty', () => {
      const queryString = JSON.stringify(['-', '-test']);
      const result = projectionFromQuery(queryString);

      expect(Object.keys(result).length).toBe(1);
      expect(result.test).toBe(0);
    });

    it('skips empty nested entries (test 1)', () => {
      const queryString = JSON.stringify(['root.', 'test']);
      const result = projectionFromQuery(queryString);

      expect(Object.keys(result).length).toBe(1);
      expect(result.test).toBe(1);
    });

    it('skips empty nested entries (test 2)', () => {
      const queryString = JSON.stringify(['..', 'test']);
      const result = projectionFromQuery(queryString);

      expect(Object.keys(result).length).toBe(1);
      expect(result.test).toBe(1);
    });

    it('skips nested negated entries that are empty (test 1)', () => {
      const queryString = JSON.stringify(['root.-', '-test']);
      const result = projectionFromQuery(queryString);

      expect(Object.keys(result).length).toBe(1);
      expect(result.test).toBe(0);
    });

    it('skips nested negated entries that are empty (test 2)', () => {
      const queryString = JSON.stringify(['..-', '-test']);
      const result = projectionFromQuery(queryString);

      expect(Object.keys(result).length).toBe(1);
      expect(result.test).toBe(0);
    });

  });

  describe('query as JSON IProjection', () => {
    it('accepts query as json string of IProjection object', () => {
      const query = {
        id: 0,
        user: {
          firstName: 1,
          lastName: 1
        }
      };
      const queryString = JSON.stringify(query);
      const result = projectionFromQuery(queryString);

      expect(result.id).toBe(0);
      expect(result.user.firstName).toBe(1);
      expect(result.user.lastName).toBe(1);
    });
  });

  describe('query as array with flat IProjection', () => {

    it('builds flat IProjection object from array', () => {
      const query = ['firstName', 'lastName'];
      const queryString = JSON.stringify(query);

      const result = projectionFromQuery(queryString);

      expect(result.firstName).toBe(1);
      expect(result.lastName).toBe(1);
    });

    it('builds flat IProjection object from array with negations', () => {
      const query = ['-firstName', '-lastName'];
      const queryString = JSON.stringify(query);

      const result = projectionFromQuery(queryString);

      expect(result.firstName).toBe(0);
      expect(result.lastName).toBe(0);
    });

    it('builds flat IProjection object from array with negations and inclusions', () => {
      const query = ['-firstName', 'lastName'];
      const queryString = JSON.stringify(query);

      const result = projectionFromQuery(queryString);

      expect(result.firstName).toBe(0);
      expect(result.lastName).toBe(1);
    });
  });

  describe('query as array with parent and sub document', () => {

    it('interprets dot notation as sub document', () => {
      const query = ['id', 'user.firstName', 'user.lastName'];
      const queryString = JSON.stringify(query);

      const result = projectionFromQuery(queryString);

      expect(result.id).toBe(1);
      expect(result.user.firstName).toBe(1);
      expect(result.user.lastName).toBe(1);
    });

    it('interprets dot notation as sub document of sub document', () => {
      const query = ['id', 'user.name.firstName', 'user.name.lastName'];
      const queryString = JSON.stringify(query);

      const result = projectionFromQuery(queryString);

      expect(result.id).toBe(1);
      expect(result.user.name.firstName).toBe(1);
      expect(result.user.name.lastName).toBe(1);
    });

    it('interprets dot notation as sub document with negations and inclusions', () => {
      const query = ['id', '-age', 'user.firstName', '-user.lastName'];
      const queryString = JSON.stringify(query);

      const result = projectionFromQuery(queryString);

      expect(result.id).toBe(1);
      expect(result.age).toBe(0);
      expect(result.user.firstName).toBe(1);
      expect(result.user.lastName).toBe(0);
    });
  });
});
