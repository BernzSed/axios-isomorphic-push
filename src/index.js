import axios from 'axios';
import url from 'url';

const pushableMethods = ['GET']; // TODO can I push_promise HEAD?

function canPush(requestUrl, config) {
  // TODO make sure page request was made in http/2
  return pushableMethods.includes(config.method.toUpperCase());
  // TODO also check domain
  // TODO don't push the same thing multiple times
}

// TODO should also give the option to disable all push requests and
//    instead just make requests as normal (for pre-rendering the html)
//    or ignore all requests (for after the response has been sent).

// for request that contain no data (GET, HEAD, DELETE)
function getRequestConfigWithoutData(method, [arg1, arg2]) {
  if (typeof arg1 === 'string') {
    const config = Object.assign({}, arg2);
    config.url = arg1;
    config.method = method || config.method || 'GET';
    return config;
  } else {
    return arg1;
  }
}
// for requests that contain data (POST, PUT)
function getRequestConfigWithData(method, [arg1, arg2, arg3]) {
  if (typeof arg1 === 'string') {
    const config = Object.assign({}, arg3);
    config.url = arg1;
    config.method = method || config.method || 'POST';
    return config;
  } else {
    return arg2 || arg1;
  }
}


/**
 * Wraps axios in something that will monitor requests/responses and
 * will issue push requests
 * @param {pageResponse} The response from the currently running server.
 * @param {axiosInstance} instance of axios to wrap
 * @return {object} return an axios instance that will issue push requests automatically.
 */
export default function prepareAxios(pageResponse, axiosInstance = null) {
  const targetAxios = (
      axiosInstance && axiosInstance.create && axiosInstance.create()
    ) || axiosInstance || axios.create();

  if (global.window) {
    // don't wrap it if on client side
    return targetAxios;
  }


  function interceptRequest(params, expectedMethod, hasData) {
    const config = hasData ?
      getRequestConfigWithData(expectedMethod, params) :
      getRequestConfigWithoutData(expectedMethod, params);

    const requestUrl = url.parse(config.url);

    if (canPush(requestUrl, config)) {
      // issue a push promise, with correct authority, path, and headers.
      // http/2 pseudo headers: :method, :path, :scheme, :authority
      const requestHeaders = Object.assign({}, config.headers, {
        ':authority': requestUrl.host
      }); // TODO exclude unneeded headers like user-agent
      // TODO actual reference to spdy/http2 modules should be in a wrapper for those libraries
      const pushStream = pageResponse && pageResponse.push(requestUrl.path, {
        method: config.method,
        request: requestHeaders
      }, function pushCallback(err, duplexStream) {
        // TODO cancel request if something went wrong.
      });
      pushStream && pushStream.on('error', function onPushError() {
        // TODO cancel request if something went wrong.
      });
      const newConfig = Object.assign({}, config, {
        isomorphicPushStream: pushStream
      });
      return targetAxios.request(newConfig);
    } else {
      // return an empty promise instead of making the call from the server side
      const emptyPromise = new Promise(() => {});
      emptyPromise.empty = true;
      return emptyPromise;
    }
  }

  // https://github.com/mzabriskie/axios/#interceptors
  // undocumented axios feature: use() takes second argument to handle errors
  targetAxios.interceptors.response.use(function responseInterceptor(response) {
    // response = { status, statusText, headers, config, request, data }
    // response.config = { adapter, transformRequest, transformResponse,
    //    timeout, xsrfCookieName, xsrfHeaderName, maxContentLength,
    //    validateStatus, headers, method, url, data }
    const config = response.config;
    if (config.isomorphicPushStream) {
      // TODO response headers and status code
      // sendHeaders(response.headers, callback) // nope, that doesn't work...
      // Looks like spdy sends the headers & status code immediately:
      // https://github.com/indutny/spdy-transport/blob/0bc70336508388ff5d111fd5027d3c31a56c7875/lib/spdy-transport/protocol/http2/framer.js#L344
      config.isomorphicPushStream.end(response.data);
    }
    return response;
  }, function responseRejectedInterceptor(error) {
    // { code, errno, syscall, hostname, host, port, config, response } = error
    // const config = error.config;
    // TODO response failed; cancel the push_promise
  });

  function axiosWrapper(...params) {
    return interceptRequest(params, null, false);
  }

  axiosWrapper.request = (...params) =>
    interceptRequest(params, null, false);
  axiosWrapper.get = (...params) =>
    interceptRequest(params, 'get', false);
  axiosWrapper.delete = (...params) =>
    interceptRequest(params, 'delete', false);
  axiosWrapper.head = (...params) =>
    interceptRequest(params, 'head', false);
  axiosWrapper.post = (...params) =>
    interceptRequest(params, 'post', true);
  axiosWrapper.put = (...params) =>
    interceptRequest(params, 'put', true);
  axiosWrapper.patch = (...params) =>
    interceptRequest(params, 'patch', true);

  // others
  axiosWrapper.all = targetAxios.all;
  axiosWrapper.spread = targetAxios.spread;
  axiosWrapper.interceptors = targetAxios.interceptors;
  axiosWrapper.defaults = targetAxios.defaults;

  axiosWrapper.targetAxios = targetAxios;

  return axiosWrapper;
}
