const crypto = require("crypto-js");

const signRequest = (request_body, api_key, secret) => {
  const { id, method, params, nonce } = request_body;

  function isObject(obj) {
    return obj !== undefined && obj !== null && obj.constructor === Object;
  }
  function isArray(obj) {
    return obj !== undefined && obj !== null && obj.constructor === Array;
  }
  function arrayToString(obj) {
    return obj.reduce((a, b) => {
      return (
        a +
        (isObject(b) ? objectToString(b) : isArray(b) ? arrayToString(b) : b)
      );
    }, "");
  }
  function objectToString(obj) {
    return obj == null
      ? ""
      : Object.keys(obj)
          .sort()
          .reduce((a, b) => {
            return (
              a +
              b +
              (isArray(obj[b])
                ? arrayToString(obj[b])
                : isObject(obj[b])
                ? objectToString(obj[b])
                : obj[b])
            );
          }, "");
  }

  const paramsString = objectToString(params);

  const sigPayload = method + id + api_key + paramsString + nonce;
  request_body.sig = crypto
    .HmacSHA256(sigPayload, secret)
    .toString(crypto.enc.Hex);

  request_body.api_key = api_key; //<=== NEED TO BE ADDED IN
  return request_body; // <=== NEED TO BE ADDED IN
};

module.exports = signRequest;
