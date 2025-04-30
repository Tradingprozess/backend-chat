const moment = require("moment");
const DateFormats = require("../data/DateFormats");
const FreeCurrencyService = require('./FreeCurrencyService');
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

class CurrencyService {

    static getCurrenciesObject(data) {
        const currenciesObject = {};
        Object.keys(data).forEach((key) => {
            currenciesObject[key] = data[key].value
        })
        return currenciesObject;
    }

    static async getCurrencyData(currency, date) {

        // Checking whether we have that data in the database
        const currentDate = moment(new Date()).format(DateFormats.FreeCurrency);
        const parsedDate = moment(date).format(DateFormats.FreeCurrency);

        let currencyData = await prisma.currency.findOne({where: {date: parsedDate, baseCurrency: currency}})

        // If we are requesting today's data then request the latest data
        if(parsedDate === currentDate) {
            // If the data has expired
            if(!currencyData || (currencyData.expiresAt && currencyData.expiresAt < new Date())) {
                const result = await FreeCurrencyService.getLatestData(currency);
                const expiryTime = new Date();
                expiryTime.setMinutes(expiryTime.getMinutes() + 30);
                const newItem = {
                    date: parsedDate,
                    baseCurrency: currency,
                    conversion: this.getCurrenciesObject(result.data),
                    expiresAt: expiryTime
                }
                if(!currencyData) {
                    currencyData = await prisma.currency.create(newItem);
                }
                else {
                    currencyData.date = parsedDate;
                    currencyData.conversion = newItem.conversion;
                    currencyData.expiresAt = newItem.expiresAt;
                    await currencyData.save();
                }
            }
        }
        else {
            if(!currencyData) {
                const result = await FreeCurrencyService.getHistoricalData(parsedDate, currency);
                const newItem = {
                    date: parsedDate,
                    baseCurrency: currency,
                    conversion: this.getCurrenciesObject(result.data)
                }
                currencyData = await prisma.currency.create(newItem);
            }
            else if (currencyData && currencyData.expiresAt && currencyData.expiresAt < new Date()) {
                const result = await FreeCurrencyService.getHistoricalData(parsedDate, currency);
                currencyData.date = parsedDate;
                currencyData.conversion = this.getCurrenciesObject(result.data);
                currencyData.expiresAt = null;
                await currencyData.save();
            }
        }

        return currencyData;
    }
}

module.exports = CurrencyService;