'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.wrapAxios = wrapAxios;
exports.create = create;

var _axios = require('axios');

var _axios2 = _interopRequireDefault(_axios);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Adds commas to a number
 * @param {number} number
 * @param {string} locale
 * @return {string}
 */
function numbers(number, locale) {
  return number.toLocaleString(locale);
}
// TODO delete all that nonsense


// for request that contain no data (GET, HEAD, DELETE)
function getRequestConfigWithoutData(arg1, arg2) {
  if (typeof arg1 === 'string') {
    var config = Object.assign({}, arg2);
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
    var config = Object.assign({}, arg3);
    config.url = arg1;
    config.method = config.method || 'POST'; // hackish solution, but it works (for now)
    return config;
  } else {
    return arg2 || arg1;
  }
}

var pushableMethods = ['GET']; // TODO can I push_promise HEAD?

function wrapAxios() {
  var wrappedAxios = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : _axios2.default;

  // Wish I could use Proxy! But Babel can't polyfill it :(
  function axiosWrapper() {
    var config = getRequestConfigWithoutData.apply(undefined, arguments);
    var method = (config && config.method || 'GET').toUpperCase();
    if (method in pushableMethods) {
      // TODO stuff.
      // If on server side, issue a push_promise and perform the request.
      // If on client side, just do the request.
    } else {
        // TODO other stuff
      }
    wrappedAxios.apply(undefined, arguments);
  }

  axiosWrapper.request = function () {}; // TODO
  axiosWrapper.get = function () {}; // TODO
  axiosWrapper.delete = function () {}; // TODO
  axiosWrapper.head = function () {}; // TODO
  axiosWrapper.post = function () {}; // TODO
  axiosWrapper.put = function () {}; // TODO
  axiosWrapper.patch = function () {}; // TODO

  // others
  axiosWrapper.all = wrappedAxios.all;
  axiosWrapper.spread = wrappedAxios.spread;
  axiosWrapper.create = create;

  axiosWrapper.proxyAxios = wrappedAxios; // proxios?

  return axiosWrapper;
}

function create(defaults) {
  // TODO remember defaults.baseUrl and defaults.headers; these will be needed in the push_promise
  return wrapAxios(_axios2.default.create(defaults));
}

exports.default = wrapAxios();