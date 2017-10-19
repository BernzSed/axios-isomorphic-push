
export default class ResponsePool {
  constructor() {
    this.responses = new Set();
  }

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
}
