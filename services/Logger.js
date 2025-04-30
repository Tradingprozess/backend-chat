const moment = require("moment");

class Logger {

    static log(feature, message){
        const currentDate = new Date();
        console.log(`[${moment(currentDate).format("DD-MM-YYYY HH:mm:ss")}] -> ${feature} - ${message}`);
    }

    static important(feature, message){
        const currentDate = new Date();
        console.warn(`[${moment(currentDate).format("DD-MM-YYYY HH:mm:ss")}] -> ${feature} - ${message}`);
    }

    static error(feature, message){
        const currentDate = new Date();
        console.error(`[${moment(currentDate).format("DD-MM-YYYY HH:mm:ss")}] -> ${feature} - ${message}`);
    }
}

module.exports = Logger;