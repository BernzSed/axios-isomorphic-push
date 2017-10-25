
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

  _waitForResponses() {
    return Promise.all([...this.responses].map(response =>
      new Promise((resolve) => {
        response.on('close', resolve);
        response.on('finish', resolve);
        if (response.finished) { // TODO is that true on close, or just finish?
          resolve();
        }
      })));
  }

  waitUntilEmpty() {
    return this._waitForResponses()
      .then(() => new Promise(resolve => setTimeout(resolve, 0)))
      .then(() => {
        if (!this.responses.size) {
          return Promise.resolve();
        } else {
          return this.waitUntilEmpty();
        }
      });
  }
}
