import type { ChaosConfig } from './types.js';

class ChaosManager {
  private config: ChaosConfig = {
    failMode: 'none',
    remainingFailures: 0
  };

  public setChaos(mode: ChaosConfig['failMode'], count: number) {
    this.config = {
      failMode: mode,
      remainingFailures: count
    };
  }

  public getStatus(): ChaosConfig {
    return { ...this.config };
  }

  public reset() {
    this.config = {
      failMode: 'none',
      remainingFailures: 0
    };
  }

  public shouldFail(): { fail: boolean; mode: ChaosConfig['failMode']; remaining: number } {
    if (this.config.failMode === 'none' || this.config.remainingFailures <= 0) {
      return { fail: false, mode: 'none', remaining: 0 };
    }

    const currentMode = this.config.failMode;
    this.config.remainingFailures -= 1;
    if (this.config.remainingFailures === 0) {
      this.config.failMode = 'none';
    }

    return { fail: true, mode: currentMode, remaining: this.config.remainingFailures };
  }
}

export const chaosManager = new ChaosManager();
