import getTargetAxios from './getTargetAxios';
import getInitialConfig from './getInitialConfig';
import buildRequestConfig from './buildRequestConfig';
import {
  responseInterceptor,
  responseRejectedInterceptor
} from './responseInterceptors';
import ResponsePool from './responsePool';
import browser from './browser';
import emptyPromise from './emptyPromise';


/**
 * Wraps axios in something that will monitor requests/responses and
 * will issue push promises
 * @param {pageResponse} http2.Http2ServerResponse
 * @param {axiosParam} (optional) instance of axios, or axios config object
 * @return {object} returns an axios instance that will issue push promises automatically.
 */
export default function prepareAxios(pageResponse, axiosParam = null) {
  if (global.window || !pageResponse) {
    // don't wrap it if on client side
    return browser.prepareAxios(pageResponse, axiosParam);
  }

  const targetAxios = getTargetAxios(axiosParam);
  const chainedResponses = new ResponsePool();

  // Unfortunately, we can't use a real request interceptor.
  // Axios doesn't call its request interceptors immediately, so the
  // page response stream could close before we have a chance to send
  // the push promise.
  // This is why we have to wrap axios instead of just adding interceptors.
  function interceptRequest(params, method, hasData) {
    const initialConfig = getInitialConfig(params, method, hasData, targetAxios);

    const requestConfig = buildRequestConfig(
      initialConfig,
      pageResponse,
      chainedResponses
    );

    return requestConfig ? targetAxios.request(requestConfig) : emptyPromise();
  }

  if (!targetAxios.usingIsomorphicPushInterceptors) {
    targetAxios.interceptors.response.use(
      responseInterceptor,
      responseRejectedInterceptor
    );
    targetAxios.usingIsomorphicPushInterceptors = true;
  }

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

  // pageResponse.stream must be open to send a push_promise,
  // but we can fulfill the push_promise after pageResponse has closed.
  axiosWrapper.whenSafeToEnd = () => chainedResponses.waitUntilEmpty();

  return axiosWrapper;
}
