import {
  DisplayProcessor,
  SpecReporter
} from 'jasmine-spec-reporter';
import SuiteInfo = jasmine.SuiteInfo;

class CustomProcessor extends DisplayProcessor {
  public displayJasmineStarted(info: SuiteInfo, log: string): string {
    return `Jasmine ${log}`.blue;
  }
}
jasmine.getEnv().clearReporters();
jasmine.getEnv().addReporter(new SpecReporter({
  customProcessors: [CustomProcessor],
  spec: {
    displayErrorMessages: true,
    displayPending: true,
    displayStacktrace: true
  },
  suite: {
    displayNumber: true
  }
}));
