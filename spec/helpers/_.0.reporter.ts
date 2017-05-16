import {
  DisplayProcessor,
  SpecReporter
} from 'jasmine-spec-reporter';
import 'source-map-support/register';
import SuiteInfo = jasmine.SuiteInfo;

class CustomProcessor extends DisplayProcessor {
  public displayJasmineStarted(info: SuiteInfo, log: string): string {
    return `SakuraApi Jasmine ${log}`.blue;
  }
}
jasmine.getEnv().clearReporters();
jasmine.getEnv().addReporter(new SpecReporter({
  customProcessors: [CustomProcessor],
  spec: {
    displayDuration: true,
    displayErrorMessages: true,
    displayFailed: true,
    displayPending: true,
    displayStacktrace: true,
    displaySuccessful: true
  },
  suite: {
    displayNumber: true
  },
  summary: {
    displayDuration: true,
    displayErrorMessages: true,
    displayFailed: true,
    displayPending: true,
    displayStacktrace: true,
    displaySuccessful: false
  }
}));
