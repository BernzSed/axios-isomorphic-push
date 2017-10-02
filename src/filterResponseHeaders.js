import filter from 'filter-values';

// these are from isIllegalConnectionSpecificHeader(),
//  in nodejs /lib/internal/http2/util.js
const illegalConnectionSpecificHeaders = [
  // http2.constants.HTTP2_HEADER_CONNECTION,
  // http2.constants.HTTP2_HEADER_UPGRADE,
  // http2.constants.HTTP2_HEADER_HOST,
  // http2.constants.HTTP2_HEADER_HTTP2_SETTINGS,
  // http2.constants.HTTP2_HEADER_KEEP_ALIVE,
  // http2.constants.HTTP2_HEADER_PROXY_CONNECTION,
  // http2.constants.HTTP2_HEADER_TRANSFER_ENCODING,
  // http2.constants.HTTP2_HEADER_TE
  'connection',
  'upgrade',
  'host',
  'http2-settings',
  'keep-alive',
  'proxy-connection',
  'transfer-encoding',
  'te'
];


export default function filterResponseHeaders(headers) {
  return filter(headers, (value, key) =>
    !illegalConnectionSpecificHeaders.includes(key.toLowerCase()));
}
