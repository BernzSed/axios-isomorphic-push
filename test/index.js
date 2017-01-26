import { assert } from 'chai';
import prepareAxios from '../src';

describe('When making requests', () => {
  let mockAxios;
  let mockPageRequest;

  beforeEach(() => {
    mockAxios = function mockAxiosFn() {};
    mockAxios.request = function mockRequest(config) {};
    mockAxios.interceptors = {
      response: {
        fulfilled: [],
        rejected: [],
        use: (fulfilled, rejected) => {
          if (fulfilled) {
            mockAxios.interceptors.response.fulfilled.push(fulfilled);
          }
          if (rejected) {
            mockAxios.interceptors.response.rejected.push(rejected);
          }
        }
      }
    };

    mockPageRequest = {
      push(path, pushOptions) {}
    };
  });

  it('calls axios.request() with the right url', () => {
    let requestConfig = null;
    const oldRequest = mockAxios.request;
    mockAxios.request = function mockRequest(config) {
      requestConfig = config;
      oldRequest(config);
    };

    const wrappedAxios = prepareAxios(mockPageRequest, mockAxios);
    wrappedAxios.get('http://www.example.com/api/foo');

    assert.equal(requestConfig.url, 'http://www.example.com/api/foo');
  });

  it('makes a push promise', () => {
    let pushedPath;
    mockPageRequest.push = (path, pushOptions) => {
      pushedPath = path;
    };

    const wrappedAxios = prepareAxios(mockPageRequest, mockAxios);
    wrappedAxios.get('http://www.example.com/api/foo');

    assert.equal(pushedPath, '/api/foo');
  });
});
