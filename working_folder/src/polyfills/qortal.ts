const globalWindow = window as typeof window & {
  qortalRequest?: (...args: any[]) => Promise<any>;
  qortalRequestWithTimeout?: (...args: any[]) => Promise<any>;
};

// Taasta algne minimalistlik polyfill ainult arenduse hoiatuseks,
// kuid ära lisa ajapiiranguid ega offline-mocke, et mitte häirida Qortal bridge'i.
if (typeof globalWindow.qortalRequest !== 'function') {
  globalWindow.qortalRequest = async (...args: any[]) => {
    console.warn('qortalRequest is not available in this environment.', ...args);
    throw new Error('qortalRequest is not available in this environment.');
  };
}

if (typeof globalWindow.qortalRequestWithTimeout !== 'function') {
  globalWindow.qortalRequestWithTimeout = async (...args: any[]) => {
    console.warn('qortalRequestWithTimeout is not available in this environment.', ...args);
    throw new Error('qortalRequestWithTimeout is not available in this environment.');
  };
}

