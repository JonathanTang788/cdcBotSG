const checkTicker = (ticker) => {
    // const temp = ticker.split(" ");
    let result = "";
    if (ticker.includes("_")) {
        result = ticker;
    } else {
        // console.log("Missing _");
        result = ticker + "_USD";
    }
    return result.toUpperCase();
};

const getOrdersDisplay = (result, accountName) => {
    let message = "";
    if (result?.count > 0) {
        message += `<b><u>Open Orders (${result.count}) (${accountName})</u></b>\n`;
        const ordersList = result.order_list;
        // ordersList.sort((a, b) => a.price - b.price);
        ordersList.sort((a, b) => {
            if (a.instrument_name < b.instrument_name) return -1;
            if (a.instrument_name > b.instrument_name) return 1;
            return a.price - b.price;
        });
        let qty = "";
        for (let i = 0; i < ordersList.length; i++) {
            if (ordersList[i].cumulative_quantity > 0)
                qty = `(${ordersList[i].cumulative_quantity.toLocaleString(
                    "en-US"
                )} / ${ordersList[i].quantity.toLocaleString("en-US")})`;
            else qty = `(${ordersList[i].quantity.toLocaleString("en-US")})`;

            message += `${ordersList[i].side === "BUY" ? "B" : "S"} ${
                ordersList[i].instrument_name
            }   ${ordersList[i].price}   ${qty}\n`;
        }
    } else {
        message += `<b><u>Open Orders (${accountName})</u></b>\n`;
        message += "No Order Found...\n";
    }
    return message;
};

const compareOrders = (oldList, newList) => {
    // console.log("oldList", oldList.length);
    // console.log("newList", newList.length);

    //Check the old orders to see which are missings in the current orders and get their status.
    let tmpCloseOrders = [];
    let tmpNewOrders = [];

    for (let i = 0; i < oldList.length; i++) {
        let found = false;
        for (let j = 0; j < newList.length; j++) {
            if (oldList[i].order_id === newList[j].order_id) {
                found = true;
            }
        }
        if (!found) {
            // const tmpStatus = await getOrderDetails(dbOrders[i].order_id);
            // console.log(dbOrders[i], tmpStatus);
            // tmpCloseOrders.push({
            //     ...dbOrders[i],
            //     status: tmpStatus.status,
            // });
            tmpCloseOrders.push({
                ...oldList[i],
            });
        }
    }
    for (let i = 0; i < newList.length; i++) {
        let found = false;
        for (let j = 0; j < oldList.length; j++) {
            if (newList[i].order_id === oldList[j].order_id) {
                found = true;
            }
        }
        if (!found) {
            tmpNewOrders.push({
                ...newList[i],
            });
        }
    }

    return { closeOrders: tmpCloseOrders, newOrders: tmpNewOrders };
};

const orderExist = (orderList, tradeDetails) => {
    let result = false;
    const { side, qty, ticker, price } = tradeDetails;
    // console.log("orderList (func:85):", orderList);
    // console.log("tradeDetails (func:86):", tradeDetails);
    temp = orderList;
    // console.log("orderList (func:88):", temp);
    for (let i = 0; i < temp.length; i++) {
        if (
            side === temp[i].side &&
            ticker === temp[i].instrument_name &&
            temp[i].quantity == qty &&
            price <= temp[i].price * 1.001 &&
            price >= temp[i].price * 0.999
        ) {
            result = true;
            break;
        }
    }
    // console.log("Order Exist (func:96):", result);
    return result;
};

function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

module.exports = {
    getOrdersDisplay,
    compareOrders,
    checkTicker,
    sleep,
    orderExist,
};
