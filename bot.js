require("dotenv").config();
const {
    getWatchListPrices,
    getTicker,
    getWalletBalance,
    getOpenOrders,
    getOrderDetails,
    createOrder,
    cancelOrder,
    getCryptoBalance,
} = require("./library/cdcAPI");
const {
    getOrdersDisplay,
    compareOrders,
    checkTicker,
    sleep,
    orderExist,
} = require("./library/func");

const TelegramBot = require("node-telegram-bot-api");

// replace the value below with the Telegram token you receive from @BotFather
const token = process.env.Token;
const chatID = process.env.ChatID;
const tgUserID = process.env.tgUserID;
const tgUserID2 = process.env.tgUserID2;
const maxPerSide = process.env.maxPerSide;

const accountList = JSON.parse(process.env.accountList);
// console.log(accountList);
// console.log(accountList[1].autoSettings);
let defaultAccount = 0;

const watchList = JSON.parse(process.env.watchList);
let runCdcBot = false;
let showCustomKeyboard = true;
let ordersKeyboardList = [];
let timeClearExcessOrders = 60000 * 60 * 10; //60sec*60min*10 = 10 hrs. Will remove excess orders each time cdcstart and reset to 0
const timeClearExcessOrdersInterval = 3; //in hours to check for excess orders

let gptStatus = false;

// Create a bot that uses 'polling' to fetch new updates
const bot = new TelegramBot(token, { polling: true });

const sendMsg = (msg) => {
    // console.log("msg", msg);
    if (msg && msg.length > 0)
        bot.sendMessage(chatID, msg, { parse_mode: "HTML" });
    // console.log(`Msg Sent:\n${msg}`);
};

const checkAuth = (msg) => {
    // console.log(msg);
    if (msg.chat.id != chatID) {
        // bot.sendMessage(
        //     msg.chat.id,
        //     `<b>WARNING: @${msg.chat.username}, You are not unauthorised!!!</b>`,
        //     { parse_mode: "HTML" }
        // );
        sendMsg(
            `Unauthorised Access Detected from (Unauthorised ChatID) ${JSON.stringify(
                msg
            )}\nMessage-->${msg.text}`
        );
        return false;
    }
    if (msg.from.id != tgUserID && msg.from.id != tgUserID2) {
        sendMsg(
            `Unauthorised Access Detected from (Unauthorised user) ${JSON.stringify(
                msg
            )}\nMessage-->${msg.text}`
        );
        return false;
    }
    return true;
};

const showKeyboard = () => {
    if (showCustomKeyboard) {
        bot.sendMessage(chatID, "Keyboard On", {
            reply_markup: {
                keyboard: [
                    [
                        {
                            text: "/orders",
                        },
                        {
                            text: "/wallet",
                        },
                        {
                            text: "/watchlist",
                        },
                    ],
                    [
                        {
                            text: "/cdcstart",
                        },
                        {
                            text: "/cdcstop",
                        },
                        {
                            text: "/cdcstatus",
                        },
                    ],
                    [
                        {
                            text: "/switch",
                        },
                        {
                            text: "/keyboard",
                        },
                        // {
                        //     text: "/chatgpt",
                        // },
                        {
                            text: "/help",
                        },
                    ],
                ],
                resize_keyboard: true,
                // one_time_keyboard: true,
            },
        });
    } else {
        bot.sendMessage(chatID, "Keyboard Off", {
            reply_markup: { remove_keyboard: true },
        });
    }
};

const AddNxOrder = async (
    tickerR,
    side,
    accountList,
    accountNo,
    atLeastOneOrderLeft = false,
    displayMsg = false
) => {
    const ticker = checkTicker(tickerR);
    // console.log(ticker);
    // console.log("AutoTrade 122", accountList);
    const result = await getOpenOrders(ticker, accountList);
    // console.log(result);
    let orderList = []; // result.data.order_list;
    if (result.status === "OK") orderList = result.data.order_list;
    else console.log(`[AddNxOrder 127]  Error\n: ${result.message}`);
    // console.log("AddNxOrder 128: orderList\n", orderList);
    // console.log("AddNxOrder: accountList\n", accountList);
    if (orderList.length > 0) {
        const autoSettings = accountList.autoSettings;
        const tradeSetting = autoSettings.find(
            (value) => value.ticker.toUpperCase() === ticker
        );
        // GET THE HIGHEST SELL PRICE AND THE LOWEST BUY PRICE
        let highSell = -1;
        let lowSell = 999999999;
        let lowBuy = 999999999;
        let highBuy = -1;
        let nxBuyPrice = -1;
        let nxSellPrice = -1;
        let buyCount = 0;
        let sellCount = 0;
        for (let i = 0; i < orderList.length; i++) {
            if (orderList[i].side === "BUY") {
                if (lowBuy > orderList[i].price) lowBuy = orderList[i].price;
                if (highBuy < orderList[i].price) highBuy = orderList[i].price;
                buyCount++;
            } else {
                if (highSell < orderList[i].price)
                    highSell = orderList[i].price;
                if (lowSell > orderList[i].price) lowSell = orderList[i].price;
                sellCount++;
            }
        }
        if (lowBuy > 10000000)
            nxBuyPrice =
                lowSell /
                (1 + tradeSetting.profit) /
                (1 + tradeSetting.interval);
        else nxBuyPrice = lowBuy / (1 + tradeSetting.interval);

        if (highSell < 0)
            nxSellPrice =
                highBuy *
                (1 + tradeSetting.profit) *
                (1 + tradeSetting.interval);
        else nxSellPrice = highSell * (1 + tradeSetting.interval);

        // console.log(`Lowest Buy: ${lowBuy} ---- Highest Buy: ${highBuy}`);
        // console.log(`Lowest Sell: ${lowSell} ---- Highest Sell: ${highSell}`);
        // console.log(`Nx Buy: ${nxBuyPrice} ---- Nx Sell: ${nxSellPrice}`);
        // console.log("tradeSetting [AddNxOrder] 135:", tradeSetting);
        // orderInfo.side, orderInfo.quantity, orderInfo.ticker, orderInfo.price, orderInfo.account
        let orderInfo = {};
        if (side === "BUY") {
            orderInfo.side = side;
            orderInfo.quantity = tradeSetting.buyQty;
            orderInfo.ticker = tradeSetting.ticker;
            orderInfo.price = nxBuyPrice.toFixed(tradeSetting.priceDec);
            orderInfo.account = accountNo;
        } else if (side === "SELL") {
            orderInfo.side = side;
            orderInfo.quantity = tradeSetting.sellQty;
            orderInfo.ticker = tradeSetting.ticker;
            orderInfo.price = nxSellPrice.toFixed(tradeSetting.priceDec);
            orderInfo.account = accountNo;
        }
        // console.log("orderInfo [addnxorder 184]\n", orderInfo);
        if (atLeastOneOrderLeft) {
            //check count
            if (
                (side === "BUY" && buyCount > 0) ||
                (side === "SELL" && sellCount > 0)
            )
                if (
                    (side === "BUY" && buyCount < maxPerSide) ||
                    (side === "SELL" && sellCount < maxPerSide)
                )
                    await placeOrder(orderInfo, displayMsg);
                else
                    sendMsg(
                        `[No Action] Enough ${side} orders for ${orderInfo.ticker}`
                    );
            else {
                sendMsg(
                    `[No Action] Minimum 1 ${side} order left for ${orderInfo.ticker}`
                );
            }
        } else {
            if (
                (side === "BUY" && buyCount < 6) ||
                (side === "SELL" && sellCount < 6)
            )
                await placeOrder(orderInfo, displayMsg);
            else
                sendMsg(
                    `[No Action] Enough ${side} orders for ${orderInfo.ticker}`
                );
        }
    } else sendMsg("You need to have at least one B/S order to add order");
};

const cancelAllOrdersBySide = async (
    tickerR,
    accountList,
    side = "ANY",
    displayMsg = false
) => {
    const ticker = checkTicker(tickerR);
    const result = await getOpenOrders(ticker, accountList);
    // console.log(result);
    let orderList = []; // result.data.order_list;
    if (result.status === "OK") orderList = result.data.order_list;
    else console.log(`[cancelAllOrdersBySide 271]  Error\n: ${result.message}`);
    // console.log(orderList);

    if (orderList.length > 0) {
        for (let i = 0; i < orderList.length; i++) {
            if (side == "ANY" || side == orderList[i].side) {
                //Cancel Order
                const result = await cancelOrder(
                    orderList[i].order_id,
                    ticker,
                    accountList
                );

                if (displayMsg)
                    if (result.status === "OK")
                        sendMsg(
                            `[Cancel Orders] [${orderList[i].side}] ${ticker}@${orderList[i].price}`
                        );
                    else
                        sendMsg(
                            `[Cancel Orders] Status: ${result.status}, Msg: ${result.message}`
                        );
            }
        }
    }
};

bot.onText(/\/co (.+)/, async (msg, match) => {
    if (!checkAuth(msg)) return;
    let data = match[1].split(" ");
    let proceed = true;
    let ticker = "";
    let side = "";
    let message = "";
    if (data.length === 2) {
        side = data[0].toUpperCase();
        if (
            side === "B" ||
            side === "BUY" ||
            side === "S" ||
            side === "SELL" ||
            side === "A" ||
            side === "ALL" ||
            side === "ANY"
        ) {
            if (side === "B" || side === "BUY") side = "BUY";
            else if (side === "S" || side === "SELL") side = "SELL";
            else side = "ANY";
        } else {
            proceed = false;
        }
        ticker = checkTicker(data[1]);
    } else {
        proceed = false;
    }

    if (proceed) {
        //Write a function ro remove order-- TODO
        await cancelAllOrdersBySide(
            ticker,
            accountList[defaultAccount],
            side,
            true
        );
    } else {
        message += `[Invalid Syntax] /co [B/Buy/S/Sell/A/ALL] [Ticker]`;
        sendMsg(message);
    }
});

bot.onText(/\/ao (.+)/, (msg, match) => {
    if (!checkAuth(msg)) return;
    let data = match[1].split(" ");
    let proceed = true;
    let ticker = "";
    let side = "";
    let message = "";
    if (data.length === 2) {
        side = data[0].toUpperCase();
        if (side === "B" || side === "BUY" || side === "S" || side === "SELL") {
            if (side === "B" || side === "BUY") side = "BUY";
            else side = "SELL";
        } else {
            proceed = false;
        }
        ticker = checkTicker(data[1]);
    } else {
        proceed = false;
    }
    if (proceed) {
        AddNxOrder(
            ticker,
            side,
            accountList[defaultAccount],
            defaultAccount,
            false,
            true
        );
    } else {
        message += `[Invalid Syntax] /ao [B/Buy/S/Sell] [Ticker]`;
        sendMsg(message);
    }
});

bot.onText(/\/start/, (msg, match) => {
    // help - Display Help
    // p - Get Crypto Price Eg. /p btc
    if (!checkAuth(msg)) return;
    bot.setMyCommands([
        { command: "help", description: "Display Help" },
        { command: "keyboard", description: "Toggle Keyboard" },
        { command: "p", description: "Get Crypto Price Eg. /p btc" },
        { command: "watchlist", description: "Get Watchlist Prices" },
        { command: "orders", description: "Show All Orders" },
        { command: "order", description: "Show Orders of XXX Eg. /order cro" },
        { command: "wallet", description: "Show Wallet Balance" },
        { command: "cdcstart", description: "Start CDC Bot" },
        { command: "cdcstop", description: "Stop CDC Bot" },
        { command: "cdcstatus", description: "Check CDC Bot Status" },
        { command: "chatgpt", description: "Toggle ChatGPT" },
        {
            command: "switch",
            description: "Switch Default Account. Eg. switch 0",
        },
        { command: "chatid", description: "Show Chat ID" },
    ]);
    sendMsg(`Setting Commands and Bot Started.....`);
    showKeyboard();
});

bot.onText(/\/help/, (msg, match) => {
    if (!checkAuth(msg)) return;
    sendMsg(
        "/p - Get Ticker Price eg. /p CRO_USD (or /p CRO)\n" +
            "/watchlist - Get Watchlist Prices\n" +
            "/orders - Show All Open Orders\n" +
            "/po - Place Order [Syntax]/po B/S Qty Ticker Price\n" +
            "/ao - Auto Add Order [Syntax]/ao B/S Ticker\n" +
            "/co - Cancel Order [Syntax]/co B/S Ticker\n" +
            "/wallet - Show Wallet Balance\n" +
            "/cdcstart - Start CDC Bot\n" +
            "/cdcstop - Stop CDC Bot\n" +
            "/cdcstatus - Check CDC Bot Status\n" +
            "/switch - Switch Default Account\n" +
            "/keyboard - Toggle Keyboard On / Off\n" +
            "/chatid - Show Chat ID\n" +
            "/help - Display Help"
    );
});

bot.onText(/\/watchlist/, async (msg, match) => {
    if (!checkAuth(msg)) return;
    const results = await getWatchListPrices(watchList);

    if (results.status === "OK") {
        sendMsg(results.data);
    } else {
        sendMsg(results.message);
    }
    // console.log("results97\n", results);
});

bot.onText(/\/wallet/, async (msg, match) => {
    if (!checkAuth(msg)) return;
    let results = "";
    for (let i = 0; i < accountList.length; i++) {
        results += `<b><u>Curr: Avail / Balance (${accountList[i].acctName})</u></b>\n`;
        results += await getWalletBalance(accountList[i]);
        results += `\n`;
    }
    // console.log(results);
    sendMsg(results);
});

bot.onText(/\/orders/, async (msg, match) => {
    if (!checkAuth(msg)) return;
    let message = "";
    for (let i = 0; i < accountList.length; i++) {
        const result = await getOpenOrders("", accountList[i]);
        // console.log(result);
        // message += getOrdersDisplay(result, accountList[i].acctName);
        // message += `\n`;

        if (result.status === "OK") {
            message += getOrdersDisplay(result.data, accountList[i].acctName);
            message += `\n`;
        } else {
            message += result.message;
        }
    }
    // console.log("message", message);
    sendMsg(message);
});

const placeOrder = async (orderInfo, displayMsg = false) => {
    try {
        // orderInfo.side, orderInfo.quantity, orderInfo.ticker, orderInfo.price, orderInfo.account
        // Check Balance before placing orders
        // console.log(orderInfo);
        splitTicker = orderInfo.ticker.split("_");
        let crypto = "";
        if (orderInfo.side === "BUY") crypto = splitTicker[1];
        else crypto = splitTicker[0];
        const availBalance = await getCryptoBalance(
            crypto,
            accountList[orderInfo.account]
        );
        let marketStatus = false;
        if (
            (orderInfo.side === "BUY" &&
                availBalance > orderInfo.quantity * orderInfo.price) ||
            (orderInfo.side === "SELL" && availBalance > orderInfo.quantity)
        ) {
            let currPrice = await getTicker(orderInfo.ticker);
            // console.log(currPrice);
            if (currPrice.status === "OK") {
                const buyPrice = currPrice.data.b;
                const sellPrice = currPrice.data.k;
                let type = "LIMIT";
                if (orderInfo.side === "BUY") {
                    if (orderInfo.price < buyPrice) type = "LIMIT";
                    else type = "MARKET";
                    // console.log(
                    //     `currBuy:${buyPrice}; Order Price:${orderInfo.price}; type:${type}`
                    // );
                } else if (orderInfo.side === "SELL") {
                    if (orderInfo.price > sellPrice) type = "LIMIT";
                    else type = "MARKET";
                    // console.log(
                    //     `currSell:${sellPrice}; Order Price:${orderInfo.price}; type:${type}`
                    // );
                }
                const result = await createOrder(
                    orderInfo,
                    accountList[orderInfo.account],
                    type
                );
                if (result.status === "OK") {
                    await sleep(1000);
                    const tmpStatus = await getOrderDetails(
                        result.order_id,
                        accountList[orderInfo.account]
                    );
                    // console.log(tmpStatus);
                    message = "<b><u>---- Create Order ------</u></b>\n";
                    if (tmpStatus === "FILLED") {
                        message = `<b>--------- MARKET ORDER EXECUTED ------------</b>\n`;
                        marketStatus = true;
                    }
                    message += `[${orderInfo.ticker}] ${orderInfo.side} ${orderInfo.quantity} @${orderInfo.price} (${tmpStatus})`;
                    if (displayMsg || tmpStatus !== "ACTIVE") sendMsg(message);
                    // console.log(`orderid = ${result.order_id}`);
                    if (marketStatus) return "MARKET";
                    else return "LIMIT";
                } else {
                    console.log("/createorder Error 353: ", result.message);
                    sendMsg(`Error 354: ${result.message.message}`);
                }
            }
        } else {
            // console.log(`[393] Insufficient ${crypto}, Avail = ${availBalance}`);
            sendMsg(
                `Insufficient ${crypto}, Avail = ${availBalance.toFixed(2)}`
            );
        }
    } catch (error) {
        console.log(error);
    }
};

bot.onText(/\/po (.+)/, async (msg, match) => {
    if (!checkAuth(msg)) return;
    let message = "";
    // console.log(match[1]);
    // orderInfo.side, orderInfo.quantity, orderInfo.ticker, orderInfo.price
    let tmpOrderInfo = match[1].split(" ");
    // console.log(tmpOrderInfo);
    let orderInfo = {};
    let proceed = true;
    try {
        if (tmpOrderInfo.length === 4) {
            // TEST SIDE
            const testSide = tmpOrderInfo[0].toUpperCase();
            if (
                testSide === "B" ||
                testSide === "BUY" ||
                testSide === "S" ||
                testSide === "SELL"
            ) {
                if (testSide === "B" || testSide === "BUY")
                    orderInfo.side = "BUY";
                else orderInfo.side = "SELL";
            } else {
                proceed = false;
                message += "Invalid Side (B/Buy/S/Sell)\n";
            }
            // console.log(orderInfo);
            // TEST QUANTITY
            const testQty = tmpOrderInfo[1];
            if (Number(testQty)) {
                orderInfo.quantity = testQty;
            } else {
                proceed = false;
                message += "Invalid Quantity\n";
            }
            orderInfo.ticker = checkTicker(tmpOrderInfo[2]);
            // console.log(orderInfo);
            // TEST PRICE
            const testPrice = tmpOrderInfo[3];
            if (Number(testPrice)) {
                orderInfo.price = testPrice;
            } else {
                proceed = false;
                message += "Invalid Price\n";
            }
            // SET ACCOUNT
            orderInfo.account = defaultAccount;
            // console.log(`Acct No ${defaultAccount}`);
            // if (/^\d+$/.test(tmpOrderInfo[4])) {
            //     tmpAcct = Number(tmpOrderInfo[4]);
            //     if (tmpAcct < accountList.length) orderInfo.account = tmpAcct;
            //     else {
            //         proceed = false;
            //         message += "Invalid Account Number\n";
            //     }
            // } else {
            //     message += "Invalid Account Number\n";
            //     proceed = false;
            // }
        } else {
            message += "Invalid Format...\n";
            proceed = false;
        }
        // console.log("yyyy", orderInfo);
        if (!proceed) {
            message += "FORMAT: Seperated by a space\n";
            message += "Side Qty Ticker Price Account_No\n";
            message += "Eg. BUY 100 CRO_USD 0.1 1\n";
            sendMsg(message);
        } else {
            //Procced to Place Order
            const status = await placeOrder(orderInfo, true);
        }
    } catch (error) {
        console.log(error);
    }
});

bot.onText(/\/cdcstart/, async (msg, match) => {
    if (!checkAuth(msg)) return;

    if (runCdcBot) sendMsg("[No Action] CDC Bot already running....");
    else {
        runCdcBot = true;
        let message = "CDC Bot started....\n";
        for (let i = 0; i < accountList.length; i++) {
            const result = await getOpenOrders("", accountList[i]);
            if (result.status === "OK") {
                accountList[i].currentOrderList = result.data.order_list;
                message += `Current Orders (${accountList[i].acctName}): <b>${result.data.count}</b>\n`;
            }
        }
        sendMsg(message);
    }
});

bot.onText(/\/cdcstop/, (msg, match) => {
    if (!checkAuth(msg)) return;
    let message = "";
    if (!runCdcBot) message = "[No Action] CDC Bot already stopped....";
    else {
        runCdcBot = false;
        message = "CDC Bot stopped....";
    }
    sendMsg(message);
});

bot.onText(/\/cdcstatus/, (msg, match) => {
    if (!checkAuth(msg)) return;
    let message = "";
    if (runCdcBot) message = "CDC Bot running....";
    else {
        message = "CDC Bot not running....";
    }
    sendMsg(message);
});

bot.onText(/\/chatid/, (msg, match) => {
    bot.sendMessage(msg.chat.id, `Chat ID: ${msg.chat.id}`);
    // sendMsg(`Chat ID: ${msg.chat.id}`);
});

bot.onText(/\/p (.+)/, async (msg, match) => {
    if (!checkAuth(msg)) return;
    const ticker = checkTicker(match[1]);
    const result = await getTicker(ticker);
    console.log(result);
    let message = "";
    if (result.status === "OK") {
        // console.log(result.data.h);
        message += `<b><u>${ticker}</u></b>\n`;
        message += `24H: ${Number(result.data.h).toLocaleString("en-US", {
            style: "decimal",
            minimumFractionDigits: 2,
            maximumFractionDigits: 12,
        })}\n`;
        message += `Now: <strong>${Number(result.data.a).toLocaleString(
            "en-US",
            {
                style: "decimal",
                minimumFractionDigits: 2,
                maximumFractionDigits: 12,
            }
        )}</strong>\n`;
        message += `24L: ${Number(result.data.l).toLocaleString("en-US", {
            style: "decimal",
            minimumFractionDigits: 2,
            maximumFractionDigits: 12,
        })}\n`;
        message += `24V: ${Number(result.data.v).toLocaleString(
            "en-US"
        )} ${ticker}\n`;
        message += `24V: ${Number(result.data.vv).toLocaleString(
            "en-US"
        )} USD\n`;
        message += `24C: ${Number(result.data.c * 100).toLocaleString(
            "en-US"
        )}%\n`;
    } else {
        // message = `Unknown Ticker (${ticker})`;
        message = result.message;
    }
    sendMsg(message);
});

bot.onText(/\/switch/, (msg, match) => {
    if (!checkAuth(msg)) return;

    let tempAccountArray = [];
    for (let i = 0; i < accountList.length; i++) {
        tempAccountArray.push([
            {
                text: `/switch ${i} --> Name: ${accountList[i].acctName}`,
            },
        ]);
    }
    // console.log(tempAccountArray);

    bot.sendMessage(msg.chat.id, "Select Account", {
        reply_markup: {
            keyboard: tempAccountArray,
            resize_keyboard: true,
            one_time_keyboard: true,
        },
    });
});

bot.onText(/\/switch (.+)/, (msg, match) => {
    if (!checkAuth(msg)) return;
    // console.log(match[1]);
    tmpAccountNumber = match[1].split(" ");
    // console.log(tmpAccountNumber[0]);
    if (/^\d+$/.test(tmpAccountNumber[0])) {
        const newDefaultAccount = Number(tmpAccountNumber[0]);
        if (
            newDefaultAccount < 0 ||
            newDefaultAccount > accountList.length - 1
        ) {
            let message = `<b>ERROR</b>\nNumber should be between 0 to ${
                accountList.length - 1
            }\n`;
            for (let i = 0; i < accountList.length; i++) {
                message += `${accountList[i].acctName} --> ${i}\n`;
            }
            sendMsg(message);
        } else {
            defaultAccount = newDefaultAccount;
            sendMsg(
                `Account Switch to [${defaultAccount}] ${accountList[defaultAccount].acctName}`
            );
            showKeyboard();
        }
    } else sendMsg("<b>ERROR</b>\nInvalid. Must be a number. Eg. /switch 0");
});

bot.onText(/\/keyboard/, (msg, match) => {
    if (!checkAuth(msg)) return;
    showCustomKeyboard = !showCustomKeyboard;
    showKeyboard();
});

bot.onText(/\/test/, (msg, match) => {
    if (!checkAuth(msg)) return;
    showOrderKeyboard([{ text: "Buy" }, { text: "Sell" }]);
});

bot.onText(/\/clearorderkeyboard/, (msg, match) => {
    if (!checkAuth(msg)) return;
    ordersKeyboardList = [];
    showKeyboard();
});

const showOrderKeyboard = (ordersArray) => {
    let tempOrdersArray = [];
    // console.log("450", ordersKeyboardList);
    ordersKeyboardList.push(ordersArray);
    // console.log("452", ordersKeyboardList);
    for (let i = 0; i < ordersKeyboardList.length; i++) {
        tempOrdersArray.push(ordersKeyboardList[i]);
    }
    tempOrdersArray.push([{ text: "/clearorderkeyboard" }]);

    bot.sendMessage(chatID, "Next Orders", {
        reply_markup: {
            keyboard: tempOrdersArray,
            resize_keyboard: true,
            // one_time_keyboard: true,
        },
    });
};

const checkOrders = async () => {
    let message = "";
    for (let i = 0; i < accountList.length; i++) {
        const result = await getOpenOrders("", accountList[i]);

        let newOrderList = [];
        if (result.status === "OK") {
            newOrderList = result.data.order_list;
        } else {
            message += result.message;
        }
        const changeInOrders = compareOrders(
            accountList[i].currentOrderList,
            newOrderList
        );
        const closeOrders = changeInOrders.closeOrders;
        const newOrders = changeInOrders.newOrders;
        let tmpMessage = "";
        let statusPassed = true;
        if (closeOrders.length > 0) {
            // console.log("Closed Order:", changeInOrders.length);
            let autoNxOrderInfo = [];
            for (let j = 0; j < closeOrders.length; j++) {
                const status = await getOrderDetails(
                    closeOrders[j].order_id,
                    accountList[i]
                );
                if (status !== "FILLED" && status !== "CANCELED")
                    statusPassed = false;
                tmpMessage += `${closeOrders[j].side} ${closeOrders[
                    j
                ].quantity.toLocaleString("en-US")} ${
                    closeOrders[j].instrument_name
                } @ ${closeOrders[j].price} --> ${status}\n`;

                //AUTO TRADE PORTION
                // if (status === "FILLED" || status === "CANCELED") {
                if (status === "FILLED") {
                    // ADD AUTO TRADE STRATEGY HERE
                }
            }
            tmpMessage += `\n`;
        }
        // Only update current list when the status are All "Filled or Canceled"
        if (statusPassed) {
            accountList[i].currentOrderList = newOrderList;
            // console.log("current Order List Updated due to Canceled or Filled!");
        }

        if (tmpMessage.length > 0)
            message += `<b><u>Closed Order(s) - [${accountList[i].acctName}]:</u></b>\n${tmpMessage}`;

        let tmpNewOrderMessage = "";
        if (newOrders.length > 0) {
            // console.log(newOrders);
            for (let j = 0; j < newOrders.length; j++) {
                tmpNewOrderMessage += `${newOrders[j].side} ${newOrders[
                    j
                ].quantity.toLocaleString("en-US")} ${
                    newOrders[j].instrument_name
                } @ ${newOrders[j].price}\n`;
            }
            tmpNewOrderMessage += `\n`;
        }
        if (tmpNewOrderMessage.length > 0)
            message += `<b><u>New Order(s) Added - [${accountList[i].acctName}]:</u></b>\n${tmpNewOrderMessage}`;
    }
    if (message.length > 0) sendMsg(message);
};

setInterval(async () => {
    if (runCdcBot) {
        // console.log("Checking Orders");
        await checkOrders();
    }
}, 30000); //in milisecs-> 1sec = 1000, 1 min = 60000 Eg. 60000 * 3

module.exports = { accountList };
