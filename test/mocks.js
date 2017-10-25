/* eslint-disable class-methods-use-this */
import EventEmitter from 'events';
import { PassThrough } from 'stream';

const emptyPromise = new Promise(() => {});

export function mockAxios(defaults = {}) {
  function axios() {}
  axios.request = () => emptyPromise;
  axios.get = () => emptyPromise;
  axios.post = () => emptyPromise;
  axios.put = () => emptyPromise;
  axios.patch = () => emptyPromise;
  axios.delete = () => emptyPromise;
  axios.head = () => emptyPromise;
  axios.interceptors = {
    request: mockAxiosInterceptor(),
    response: mockAxiosInterceptor()
  };
  axios.defaults = defaults;

  return axios;
}

export function mockAxiosInterceptor() {
  const interceptor = {
    fulfilled: [],
    rejected: [],
    use: (fulfilled, rejected) => {
      if (fulfilled) {
        interceptor.fulfilled.push(fulfilled);
      }
      if (rejected) {
        interceptor.rejected.push(rejected);
      }
    }
  };
  return interceptor;
}

export class MockServerResponse extends EventEmitter {
  constructor() {
    super();
    this.stream = new PassThrough();
    this.stream.pushAllowed = true;
    this.stream.on('finish', () => this.emit('finish'));
    this.stream.on('close', () => this.emit('close'));
  }
  createPushResponse(headers, callback) {}
  writeHead() {}
  end(...args) {
    this.stream.end(...args);
  }
  write(...args) {
    this.stream.write(...args);
  }
}

export function mockServerResponse() {
  return new MockServerResponse();
}

export function mockAxiosResponse(data = null, headers = {}, config = null) {
  return {
    status: 200,
    statusText: 'OK',
    headers,
    config: config || {
      adapter: null,
      transformRequest() {},
      transformResponse() {},
      timeout: 0,
      xsrfCookieName: '',
      xsrfHeaderName: '',
      maxContentLength: 99999,
      validateStatus() {},
      headers: {},
      method: 'GET',
      url: '',
      data: null
    },
    request: {},
    data
  };
}

export function mockStream() {
  return {
    isPaused() {},
    pause() {},
    pipe() {},
    read() {},
    resume() {},
    setEncoding() {},
    unpipe() {},
    unshift() {},
    wrap() {},
    destroy() {}
  };
}
