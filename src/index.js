import axios from 'axios';

const pushableMethods = ['GET']; // TODO can I push_promise HEAD?

// for request that contain no data (GET, HEAD, DELETE)
function getRequestConfigWithoutData(arg1, arg2) {
  if (typeof arg1 === 'string') {
    const config = Object.assign({}, arg2);
    config.url = arg1;
    config.method = config.method || 'GET';
    return config;
  } else {
    return arg1;
  }
}
// for requests that contain data (POST, PUT)
function getRequestConfigWithData(arg1, arg2, arg3) {
  if (typeof arg1 === 'string') {
    const config = Object.assign({}, arg3);
    config.url = arg1;
    config.method = config.method || 'POST'; // hackish solution, but it works (for now)
    return config;
  } else {
    return arg2 || arg1;
  }
}

/**
 * Wraps axios in something that will monitor requests/responses and
 * will issue push requests
 * @param {targetAxios} instance of axios to wrap
 * @param {req} The request to the server (that will return the webpage).
 * @return {string}
 */
export function wrapAxios(targetAxios = axios, req) {
  // Wish I could use Proxy! But Babel can't polyfill it :(

  if (global.window) {
    // don't wrap it if on client side
    return targetAxios;
  }


  // can I use axios interceptors instead?
  // https://github.com/mzabriskie/axios/blob/master/test/specs/interceptors.spec.js
  // TODO yeah, I should probably be doing that.
  // ------------------------------------------------------------------------
  // TODO https://github.com/mzabriskie/axios/#interceptors
  // ------------------------------------------------------------------------
  // but can I force it to return a custom promise?
  //    The interceptor can probably return a fake promise. Hopefully that won't leak memory.
  //  axios.interceptors.request.use(function(config){ global.console.log('request ', arguments); return new Promise(function(){}) });
  //  axios('http://www.google.com').then((response) => global.console.log('response'), (error) => global.console.log('promise rejected', error));
  // Still need a way for redux actions to tell difference between requests from client & server,
  //      since server side request must be repeated on client,
  //      so spinner should be displayed but other requests should not be ignored.
  //      (Have a "promised" and "loading" action and state)
  // if targetAxios is not an instance, will probably have to call targetAxios.create()


  function axiosWrapper(...params) {
    const config = getRequestConfigWithoutData(...params);
    const method = ((config && config.method) || 'GET').toUpperCase();
    // if canPush()
    if (method in pushableMethods) { // TODO move to a canPush() function to keep this code cleaner
      // TODO:
      // On server side (assumed).
      // if we can issue a push_promise,
      //    Make push_promise and perform the request with ...params.
      //    When request completes, push response headers & body to client.
      // else
      //    No push promise; respond with a dummy promise that never completes/fails
    } else {
      // TODO other stuff
    }
    // TODO all that stuff should be in a reusable function

    // TODO should return promise that contains properties indicating if
    //   - running on server (because will have to re-do request on client)
    //   - no request was actually made
    //  * those should be falsy on client side to mirror unwrapped axios's promises

    targetAxios(...params);
  }

  axiosWrapper.request = function () {}; // TODO
  axiosWrapper.get = function () {}; // TODO
  axiosWrapper.delete = function () {}; // TODO
  axiosWrapper.head = function () {}; // TODO
  axiosWrapper.post = function () {}; // TODO
  axiosWrapper.put = function () {}; // TODO
  axiosWrapper.patch = function () {}; // TODO

  // others
  axiosWrapper.all = targetAxios.all;
  axiosWrapper.spread = targetAxios.spread;
  axiosWrapper.create = create;

  axiosWrapper.targetAxios = targetAxios;

  return axiosWrapper;
}

export function create(defaults) {
  // TODO remember defaults.baseUrl and defaults.headers; these will be needed in the push_promise
  return wrapAxios(axios.create(defaults));
}

export default wrapAxios();

// TODO do I want to scrap this whole thing and just mock the fetch api instead?
// https://www.npmjs.com/package/isomorphic-fetch
