import { promisify } from 'util';

const setImmediatePromise = promisify(setImmediate);

export default class ResponsePool {
  responses = new Set();

  add(response) {
    if (!response.stream.destroyed) {
      this.responses.add(response);
      response.on('close', () => this.responses.delete(response));
      response.on('finish', () => this.responses.delete(response));
    }
  }

  get() {
    return this.responses.values().next().value;
  }

  get size() {
    return this.responses.size;
  }

  waitForCurrentResponses() {
    return Promise.all([...this.responses].map(response =>
      new Promise((resolve) => {
        response.on('close', resolve);
        response.on('finish', resolve);
        if (response.finished) {
          resolve();
        }
      })));
  }

  waitUntilEmpty() {
    return this.waitForCurrentResponses()
      .then(setImmediatePromise())
      .then(() => {
        if (!this.responses.size) {
          return Promise.resolve();
        } else {
          return this.waitUntilEmpty();
        }
      });
  }
}
