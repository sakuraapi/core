import * as express from 'express';
import * as colors from 'colors';

export class SakuraApi {

  private _port: number = 3000;

  get port(): number {
    return this._port;
  }

  constructor(public app: express.Express) {
    if (!this.app) {
      throw new Error('cannot instantiate a new SakuraApi without providing an Express object');
    }
  }

  listen<T>(port?: number, next?: (() => Promise<T>) | string): Promise<null> {
    return new Promise((resolve, reject) => {
      this._port = port || this.port;

      let msg = null;
      if (typeof next === 'string') {
        msg = next;
        next = null;
      }

      this.app.listen(this.port, () => {
        msg = msg || `SakuraAPI started on port: ${this.port}`;
        if (!next) {
          console.log(colors.green(msg));
          return resolve();
        }

        (next as any)()
          .then(resolve)
          .catch(reject);
      });
    });
  }
}
