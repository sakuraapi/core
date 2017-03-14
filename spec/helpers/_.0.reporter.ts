import {
  SpecReporter,
  DisplayProcessor
} from 'jasmine-spec-reporter';
import SuiteInfo = jasmine.SuiteInfo;

class CustomProcessor extends DisplayProcessor {
  public displayJasmineStarted(info: SuiteInfo, log: String): String {
    return `TypeScript ${log}`;
  }
}

jasmine.getEnv().clearReporters();
jasmine.getEnv().addReporter(new SpecReporter({
  customProcessors: [CustomProcessor],
  spec: {
    displayPending: true
  }
}));

