const axios = require("axios");
const basedURL = "https://api.crypto.com/v2/";

// https://{URL}/v2/public/get-ticker?instrument_name=BTC_USDT
// method = cdc method + param string (Eg. method = public/get-ticker?instrument_name=BTC_USD)
const cdcGetRequest = async (method) => {
    const fullURL = basedURL + method;
    // console.log(fullURL);
    try {
        const res = await axios.get(fullURL);
        // console.log(res);
        // console.log(res.data);
        const data = res.data;
        // console.log(data);
        return data;
    } catch (error) {
        console.log(error);
    }
};

const cdcPostRequest = async (method, jsonSignBody) => {
    try {
        const fullURL = basedURL + method;
        // console.log(fullURL);
        const res = await axios.post(fullURL, jsonSignBody, {
            headers: { "Content-Type": "application/json" },
        });
        // console.log("cdcRequest", res);
        const data = res?.data;
        // console.log(data);
        return data;
    } catch (error) {
        console.log("cdcRequest Error: ", error.response.data);
        // console.log(error.response.data);
        return error.response.data;
    }
};

module.exports = { cdcGetRequest, cdcPostRequest };
