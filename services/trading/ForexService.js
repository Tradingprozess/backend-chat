const DateFormats = require('../../data/DateFormats');
const moment = require("moment/moment");
const NumberService = require('../NumberService');
const CurrencyService = require('../CurrencyService');
const currenciesList = require('../../data/currencies.json');
const pipData = require('../../data/pip-info.json');
const cryptoCurrenciesList = require('../../data/crypto-currencies.json')
const commoditiesList = require('../../data/commodities.json');
const ForexItemType = require('../../enums/ForexItemType');

class ForexService {

    static getNormalizedSymbol(symbol) {
        return symbol ? symbol.toUpperCase() : '';
    }

    static isCurrencyPair(symbol) {
        if(!symbol) {
            return false;
        }

        const pairs = this.getCurrencyPair(symbol);
        return pairs.length > 0;
    }

    static getItemType(currencyPair) {
        if(!currencyPair || currencyPair.length === 0) {
            return ForexItemType.None;
        }

        if(currencyPair.length === 2 && (cryptoCurrenciesList.includes(currencyPair[0]) || cryptoCurrenciesList.includes(currencyPair[1]))) {
            return ForexItemType.CryptoPair;
        }
        else if(currencyPair.length === 2 && (commoditiesList.includes(currencyPair[0]) || commoditiesList.includes(currencyPair[1]))) {
            return ForexItemType.Commodity;
        }
        else if (currencyPair.length === 1 && commoditiesList.includes(currencyPair[0])) {
            return ForexItemType.Commodity;
        }
        else if (currencyPair.length === 2 && currenciesList.includes(currencyPair[0]) && currenciesList.includes(currencyPair[1])) {
            return ForexItemType.CurrencyPair;
        }
        return ForexItemType.None;
    }

    static getCurrencyPair(symbol) {
        const normalizedSymbol = this.getNormalizedSymbol(symbol);

        const allCurrencies = [...cryptoCurrenciesList, ...currenciesList, ...commoditiesList];

        if(symbol.length === 6) {
            const firstCurrency = normalizedSymbol.slice(0, 3);
            const baseCurrency = normalizedSymbol.slice(3);
            if(allCurrencies.includes(baseCurrency) && allCurrencies.includes(firstCurrency)) {
                return [firstCurrency, baseCurrency];
            }
        }

        if(commoditiesList.includes(normalizedSymbol)) {
            return [normalizedSymbol];
        }

        for (let i = 1; i < normalizedSymbol.length; i++) {
            const baseAsset = normalizedSymbol.substring(0, i);
            const quoteCurrency = normalizedSymbol.substring(i);
      
            if (allCurrencies.includes(baseAsset) && allCurrencies.includes(quoteCurrency)) {
              return [baseAsset, quoteCurrency];
            }
        }

        return [];
    }

    static getPipData(currencyPair) {
        const keys = Object.keys(pipData);
        for(const key of keys) {
            if(currencyPair.includes(key)) {
                return pipData[key];
            }
        }
        return pipData['Default'];
    }

    static async getExchangeRate(currencyPair, date) {
        let exchangeRate = 1;
        if(currencyPair[1] !== 'USD') {
            const data = await CurrencyService.getCurrencyData('USD', date);
            if(data && data.conversion && data.conversion[currencyPair[1]]) {
                exchangeRate = data.conversion[currencyPair[1]];
            }
        }
        return exchangeRate;
    }

    static async getPipValue(currencyPair, date, volume) {
        const pipData = this.getPipData(currencyPair)
        const lotSize = Math.abs(volume) * pipData.lotSize;
        const exchangeRate = await this.getExchangeRate(currencyPair, date);
        return (pipData.pipSize / exchangeRate) * lotSize;
    }

    static getPips(currencyPair, price) {
        const pipData = this.getPipData(currencyPair);
        return price / pipData.pipSize
    }

    static async getAdjustedPrice (symbol, price, date, volume) {
        const currencyPair = this.getCurrencyPair(symbol);
        const itemType = this.getItemType(currencyPair);
        if(itemType === ForexItemType.CryptoPair) {
            return NumberService.toDecimal(volume * price, 4);
        }
        else {
            const pipValue = await this.getPipValue(currencyPair, moment(date).format(DateFormats.FreeCurrency), volume);
            const pips = this.getPips(currencyPair, price);
            return NumberService.toDecimal(pipValue * pips, 4);
        }
    }
}

module.exports = ForexService;