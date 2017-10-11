/* eslint-disable class-methods-use-this */
import EventEmitter from 'events';

export function mockAxios() {
  function axios() {}
  axios.request = () => {};
  axios.get = () => {};
  axios.post = () => {};
  axios.put = () => {};
  axios.patch = () => {};
  axios.delete = () => {};
  axios.head = () => {};
  axios.interceptors = {
    request: mockAxiosInterceptor(),
    response: mockAxiosInterceptor()
  };
  axios.defaults = {};

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
    this.stream = {
      pushAllowed: true,
      destroy() {}
    };
  }
  createPushResponse(headers, callback) {}
  writeHead() {}
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
