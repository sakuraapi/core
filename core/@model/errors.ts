export class SapiMissingIdErr extends Error {

  constructor(msg: string, public target: any) {
    super(msg);
  }

}
