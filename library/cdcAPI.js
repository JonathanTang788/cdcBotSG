const { cdcGetRequest, cdcPostRequest } = require("./cdcRequest");
const signRequest = require("./signRequest");

// const crypto = require("crypto-js"); // Need to "npm install crypto-js"

// const apiKey = process.env.apiKey; /* User API Key */
// const apiSecret = process.env.apiSecret; /* User API Secret */
// console.log(apiKey, apiSecret);

const getWatchListPrices = async (watchList) => {
    try {
        let results = "";
        watchList.sort((a, b) => {
            if (a.name < b.name) return -1;
            if (a.name > b.name) return 1;
        });
        // console.log(watchList);
        for (let i = 0; i < watchList.length; i++) {
            // console.log(watchList[i].name);
            const ticker = watchList[i].name.toUpperCase();
            const result = await cdcGetRequest(
                `public/get-ticker?instrument_name=${ticker}`
            );
            // console.log(result);
            // console.log("2:", result?.result?.data.length);
            if (result.code === 0 && result?.result?.data.length > 0) {
                results += `<b>${result.result.data[0].i}:</b> ${result.result.data[0].a}\n`;
            } else {
                results += `<b>${ticker}:</b> --> ${result.code} : ${
                    result?.message ? result.messaage : "Unknown Error"
                }\n`;
            }
        }
        // console.log("result\n", results);
        // return results;
        return { status: "OK", data: results };
    } catch (error) {
        console.log(error);
        return { status: "Error", message: `${error}` };
    }
};

const getTicker = async (ticker) => {
    try {
        ticker = ticker.toUpperCase();
        const result = await cdcGetRequest(
            `public/get-ticker?instrument_name=${ticker}`
        );
        // console.log("result", result);
        // console.log("result.code", result.code);
        // console.log("result.message", result.message);

        if (result.code === 0 && result?.result?.data.length > 0)
            return { status: "OK", data: result.result.data[0] };
        else {
            // console.log(result);
            return {
                status: "Error",
                message: `Code: ${result.code} --> ${
                    result?.message ? result.message : "Unknown Error"
                }`,
            };
        }
    } catch (error) {
        console.log(error);
        return { status: "Error", message: `${error}` };
    }
};

const getWalletBalance = async (accountList) => {
    let results = "";
    try {
        const apiKey = accountList.apiKey;
        const apiSecret = accountList.apiSecret;

        // console.log(walletList);
        // console.log(accountList);

        const method = "private/get-account-summary";
        for (let i = 0; i < accountList.walletList.length; i++) {
            let dataR = "";
            const curr = accountList.walletList[i].name.toUpperCase();
            const dec = accountList.walletList[i].dec;
            // console.log(curr);
            const nonce = new Date().getTime();
            let request = {
                id: nonce,
                method: "private/get-account-summary",
                params: { currency: curr },
                nonce: nonce,
            };

            let jsonSignBody = JSON.stringify(
                signRequest(request, apiKey, apiSecret)
            );
            // console.log(jsonSignBody);
            const result = await cdcPostRequest(method, jsonSignBody);
            if (result?.result?.accounts[0]) {
                dataR = result.result.accounts[0];
                // console.log(result.accounts[0]);
                results += `<b>${curr}</b>: ${Number(
                    dataR.available.toFixed(dec)
                ).toLocaleString("en-US")} / ${Number(
                    dataR.balance.toFixed(dec)
                ).toLocaleString("en-US")}\n`;
            } else {
                results += `<b>${curr}</b> -Nil-\n`;
            }
        }
        // console.log(results);
        if (results === "") results = "Empty Wallet";
        return results;
    } catch (error) {
        console.log(error);
        return error;
    }
};

const getCryptoBalance = async (crypto, accountList) => {
    try {
        const apiKey = accountList.apiKey;
        const apiSecret = accountList.apiSecret;
        const method = "private/get-account-summary";
        crypto = crypto.toUpperCase();

        const nonce = new Date().getTime();
        let request = {
            id: nonce,
            method: "private/get-account-summary",
            params: { currency: crypto },
            nonce: nonce,
        };

        let jsonSignBody = JSON.stringify(
            signRequest(request, apiKey, apiSecret)
        );
        const result = await cdcPostRequest(method, jsonSignBody);
        if (result?.result?.accounts[0]) {
            // console.log(result.result);
            const balance = result.result.accounts[0].available;
            // console.log(
            //     `[cdcAPI getCryptoBalance 137] Balance ${crypto}:${balance}`
            // );

            return balance;
        } else {
            return 0;
        }
    } catch (error) {
        console.log(error);
        return error;
    }
};

const createOrder = async (orderInfo, accountList, type = "LIMIT") => {
    try {
        const apiKey = accountList.apiKey;
        const apiSecret = accountList.apiSecret;

        // orderInfo.side, orderInfo.quantity, orderInfo.ticker, orderInfo.price

        // console.log(accountList);
        const method = "private/create-order";

        const nonce = new Date().getTime();
        let request = {};
        if (type === "LIMIT")
            request = {
                id: nonce,
                method: "private/create-order",
                params: {
                    instrument_name: orderInfo.ticker.toUpperCase(),
                    side: orderInfo.side.toUpperCase(),
                    type: type,
                    price: orderInfo.price,
                    quantity: orderInfo.quantity,
                    time_in_force: "GOOD_TILL_CANCEL",
                    exec_inst: "POST_ONLY",
                },
                nonce: nonce,
            };
        else if (type === "MARKET")
            request = {
                id: nonce,
                method: "private/create-order",
                params: {
                    instrument_name: orderInfo.ticker.toUpperCase(),
                    side: orderInfo.side.toUpperCase(),
                    type: type,
                    quantity: orderInfo.quantity,
                },
                nonce: nonce,
            };
        let jsonSignBody = JSON.stringify(
            signRequest(request, apiKey, apiSecret)
        );
        // console.log(jsonSignBody);
        const result = await cdcPostRequest(method, jsonSignBody);
        // console.log(result);
        if (result?.code === 0) {
            // console.log("OK");
            return { status: "OK", order_id: result.result.order_id };
        } else {
            // console.log("ERROR");
            return { status: "Error", message: result };
        }
    } catch (error) {
        console.log("PROG ERROR", error);
        return { status: "Error", message: "cdcAPI-createOrder-Error...." };
    }
};

const cancelOrder = async (orderId, cryptoName, accountList) => {
    try {
        const apiKey = accountList.apiKey;
        const apiSecret = accountList.apiSecret;

        const method = "private/cancel-order";

        const nonce = new Date().getTime();
        let request = {
            id: nonce,
            method: "private/cancel-order",
            params: {
                instrument_name: cryptoName.toUpperCase(),
                order_id: orderId,
            },
            nonce: nonce,
        };
        let jsonSignBody = JSON.stringify(
            signRequest(request, apiKey, apiSecret)
        );
        // console.log(jsonSignBody);
        const result = await cdcPostRequest(method, jsonSignBody);
        // console.log("cdcAPI ln216", result);
        if (result?.code === 0) {
            // console.log("OK");
            return { status: "OK", message: "order removed" };
        } else {
            // console.log("ERROR");
            return { status: "Error", message: result };
        }
    } catch (error) {
        console.log("PROG ERROR", error);
        return { status: "Error", message: "cdcAPI-cancelOrder-Error...." };
    }
};

// const getOpenOrdersCount = async () => {
//     const method = "private/get-open-orders";
//     const nonce = new Date().getTime();
//     let request = {
//         id: nonce,
//         method: "private/get-open-orders",
//         params: {
//             page_size: 1,
//             page: 0,
//         },
//         nonce: nonce,
//     };
//     let jsonSignBody = JSON.stringify(signRequest(request, apiKey, apiSecret));
//     // console.log(jsonSignBody);
//     result = await cdcPostRequest(method, jsonSignBody);
//     if (result?.count) {
//         return result.count;
//     } else return 0;
// };

const getOpenOrders = async (ticker = "", accountList) => {
    try {
        const method = "private/get-open-orders";
        ticker = ticker.toUpperCase();
        const apiKey = accountList.apiKey;
        const apiSecret = accountList.apiSecret;

        const nonce = new Date().getTime();
        let request = {
            id: nonce,
            method: "private/get-open-orders",
            params: {
                page_size: 100,
                page: 0,
            },
            nonce: nonce,
        };
        if (ticker !== "") request.params.instrument_name = ticker;
        // console.log(request);

        let jsonSignBody = JSON.stringify(
            signRequest(request, apiKey, apiSecret)
        );
        result = await cdcPostRequest(method, jsonSignBody);
        // console.log(result);
        if (result?.code === 0) return { status: "OK", data: result.result };
        else
            return {
                status: "Error",
                message: `Error: ${
                    result?.data ? result.data : "Unknown Error"
                }`,
            };
    } catch (error) {
        console.log(error);
        return { status: "Error", message: `${error}` };
    }
};

const getOrderDetails = async (order_id, accountList) => {
    try {
        const nonce = new Date().getTime();
        const method = "private/get-order-detail";

        const apiKey = accountList.apiKey;
        const apiSecret = accountList.apiSecret;
        // console.log(apiKey);
        let request = {
            id: nonce,
            method: "private/get-order-detail",
            params: {
                order_id: order_id,
            },
            nonce: nonce,
        };
        let jsonSignBody = JSON.stringify(
            signRequest(request, apiKey, apiSecret)
        );
        result = await cdcPostRequest(method, jsonSignBody);
        // console.log(result);
        let status = "Unknown";
        if (result?.result?.order_info)
            status = result.result.order_info.status;
        // console.log(status);
        return status;
    } catch (error) {
        console.log("Get Order Details Error:\n", error);
        return "Error";
    }
};

/* Not Using as They only show based on date created not when trade is close
const getTrades = async () => {
    let results = "Get Trades";

    const method = "private/get-order-history";
    const nonce = new Date().getTime();
    const startTS = nonce - 24 * 60 * 60 * 1000;
    let request = {
        id: nonce,
        method: "private/get-order-history",
        params: {
            page_size: 100,
            page: 0,
            start_ts: startTS,
            end_ts: nonce,
        },
        nonce: nonce,
    };
    let jsonSignBody = JSON.stringify(signRequest(request, apiKey, apiSecret));
    // console.log(jsonSignBody);
    result = await cdcPostRequest(method, jsonSignBody);
    console.log(result);

    return results;
};*/

module.exports = {
    getWatchListPrices,
    getTicker,
    getWalletBalance,
    getOpenOrders,
    getOrderDetails,
    createOrder,
    cancelOrder,
    getCryptoBalance,
};
