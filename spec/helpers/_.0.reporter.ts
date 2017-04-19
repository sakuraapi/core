import {
  DisplayProcessor,
  SpecReporter
} from 'jasmine-spec-reporter';
import SuiteInfo = jasmine.SuiteInfo;

class CustomProcessor extends DisplayProcessor {
  public displayJasmineStarted(info: SuiteInfo, log: string): string {
    return `TypeScript ${log}`;
  }
}

if (process.env.JASMINE_REPORTER !== 'plain') {
  jasmine.getEnv().clearReporters();
  jasmine.getEnv().addReporter(new SpecReporter({
    customProcessors: [CustomProcessor],
    spec: {
      displayPending: true
    }
  }));
}
