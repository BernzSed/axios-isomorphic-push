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


  // https://github.com/mzabriskie/axios/#interceptors
  targetAxios.interceptors.request.use(function requestInterceptor(config) {

    const requestUrl = url.parse(config.url);

    if (canPush(requestUrl, config)) {
      // issue a push promise, with correct authority, path, and headers.
      // http/2 pseudo headers: :method, :path, :scheme, :authority
      const requestHeaders = Object.assign({}, config.headers, {
        ':authority': requestUrl.host
      }); // TODO exclude unneeded headers like user-agent
      const pushStream = pageResponse.push(requestUrl.path, {
        method: config.method,
        request: requestHeaders
      }, function pushCallback(err, duplexStream) {
        // TODO cancel request if something went wrong.
      });
      pushStream.on('error', function onPushError() {
        // TODO cancel request if something went wrong.
      });
      const newConfig = Object.assign({}, config, {
        isomorphicPushStream: pushStream
      });
      return newConfig;
    } else {
      // return an empty promise
      return new Promise(() => {});
    }

  });
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
    // error = { code, errno, syscall, hostname, host, port, config, response }
    const config = error.config;
    // TODO response failed; cancel the push_promise
  });


  return targetAxios;
}
