const tickData = require("../../data/tick-data.json");
const NumberService = require("../NumberService");

class FuturesService {

    static getNormalizedSecurityId(securityId) {
        return securityId ? securityId.trim().replace(/^#/, '').toUpperCase() : '';
    }

    static getTickInfo(securityId) {
        const normalizedSymbol = this.getNormalizedSecurityId(securityId);
        let keys = Object.keys(tickData);
        let biggestMatch = '';
        for (const key of keys) {
            if (normalizedSymbol?.startsWith(key) && key.length > biggestMatch.length) {
                biggestMatch = key;
            }
        }

        return tickData[biggestMatch];
    };

    static getAdjustedPrice (securityId, price) {
        const tickInfo = this.getTickInfo(securityId);
        if(tickInfo) {
            return NumberService.toDecimal((price / tickInfo.tickSize) * tickInfo.tickValue, 2)
        }
        else {
            return NumberService.toDecimal(price, 2);
        }
    }

    static getAdjustedCost (trade) {
        return this.getAdjustedPrice(trade.SecurityId, trade.OpenPrice) * Math.abs(parseFloat(trade.OpenVolume))
    }

    static getPoints(trade) {
        if(!trade.CloseTime) {
            return 0;
        }

        if (trade.Side === "LONG") {
            return (trade.ClosePrice - trade.OpenPrice) * Math.abs(trade.OpenVolume);
        } else {
            return (trade.OpenPrice - trade.ClosePrice) * Math.abs(trade.OpenVolume);
        }
    }

    static getTicks(trade) {
        const points = this.getPoints(trade)
        const tickData = this.getTickInfo(trade.SecurityId);

        let ticks = points;

        if(tickData) {
            ticks = ticks / tickData.tickSize;
        }

        return ticks;
    }
}

module.exports = FuturesService;