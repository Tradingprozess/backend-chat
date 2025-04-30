const FuturesService = require("./FuturesService");
const ForexService = require("./ForexService");
const NumberService = require("../NumberService");
const AssetType = require("../../enums/AssetType");

class TradeService {

    static getNormalizedSecurityId(securityId) {
        return securityId ? securityId.toUpperCase() : '';
    }

    static getAssetType(securityId) {
        const normalizedSecurityId = this.getNormalizedSecurityId(securityId);
        const isCurrencyPair = ForexService.isCurrencyPair(normalizedSecurityId);
        if(isCurrencyPair) {
            return AssetType.Forex;
        }
        else {
            return AssetType.Futures
        }
    }

    static async getAdjustedPrice(securityId, price, date, volume) {
        const normalizedSecurityId = this.getNormalizedSecurityId(securityId);
        const isCurrencyPair = ForexService.isCurrencyPair(normalizedSecurityId);
        if(isCurrencyPair) {
            return await ForexService.getAdjustedPrice(normalizedSecurityId, price, date, volume)
        }
        else {
            return FuturesService.getAdjustedPrice(normalizedSecurityId, price) * Math.abs(volume);
        }
    }

    static calculatePnL(securityId, entryPrice, exitPrice, tradeSide) {
        let pnl = 0;
        // Whether the symbol is a forex symbol
        const assetType = this.getAssetType(securityId);
        if(assetType === AssetType.Forex) {
            if(tradeSide === 'LONG') {
                pnl = NumberService.toDecimal(exitPrice - entryPrice, 5);
            }
            else if(tradeSide === 'SHORT') {
                pnl = NumberService.toDecimal(entryPrice - exitPrice, 5);
            }
        }
        else {
            if(tradeSide === 'LONG') {
                pnl = NumberService.toDecimal(exitPrice - entryPrice);
            }
            else if(tradeSide === 'SHORT') {
                pnl = NumberService.toDecimal(entryPrice - exitPrice);
            }
        }
        return pnl;
    }

    static getAdjustedCost(trade) {
        return this.getAdjustedPrice(trade.SecurityId, trade.OpenPrice, trade.OpenTime, Math.abs(trade.OpenVolume));
    }

    static getNetROI(trade) {
        const adjustedCost = this.getAdjustedCost(trade);
        let netROI = parseFloat(((trade.PnL / adjustedCost) * 100).toFixed(2));

        if(netROI === -0) {
            netROI = Math.abs(netROI);
        }
        return netROI.toFixed(2);
    };

    static async getPlannedRMultiple(trade) {

        if(trade.OpenPrice === trade.StopLoss) {
            return 0;
        }

        const initialTarget = await this.getInitialTarget(trade, trade.ProfitTarget);
        const tradeRisk = await this.getTradeRisk(trade, trade.StopLoss);

        return parseFloat((initialTarget / tradeRisk).toFixed(2))
    }

    static async getRealizedRMultiple(trade) {

        if(trade.OpenPrice === trade.StopLoss) {
            return 0;
        }

        const tradeRisk = await this.getTradeRisk(trade, trade.StopLoss);

        return parseFloat((trade.PnL / tradeRisk).toFixed(2))
    }

    static async getAveragePlannedRMultiple(trades) {
        const rMultiples = [];
        for(let trade of trades) {
            const rMultiple = await this.getPlannedRMultiple(trade);
            rMultiples.push(rMultiple);
        }
        return parseFloat((rMultiples.reduce((total, current) => total + current, 0) / rMultiples.length).toFixed(2));
    }

    static async getAverageRealizedRMultiple(trades) {
        const rMultiples = [];
        for(let trade of trades) {
            const realizedRMultiple = await this.getRealizedRMultiple(trade);
            rMultiples.push(realizedRMultiple);
        }
        return parseFloat((rMultiples.reduce((total, current) => total + current, 0) / rMultiples.length).toFixed(2));
    }

    static getGrossPnL(trade) {
        return trade.PnL + Math.abs(trade.Commission);
    }

    static async getInitialTarget(trade, profitTarget) {
        const difference = trade.Side === 'LONG' ? profitTarget - trade.OpenPrice : trade.OpenPrice - profitTarget;
        return await this.getAdjustedPrice(trade.SecurityId, difference, trade.CloseTime, Math.abs(trade.OpenVolume));
    };

    static async getTradeRisk(trade, stopLoss) {
        const difference = trade.Side === 'LONG' ? trade.OpenPrice - stopLoss : stopLoss - trade.OpenPrice;
        return await this.getAdjustedPrice(trade.SecurityId, difference, trade.CloseTime, Math.abs(trade.OpenVolume));
    };

    static getPoints(trade) {
        return FuturesService.getPoints(trade)
    }

    static getTicks(trade) {
        return FuturesService.getTicks(trade)
    }
}

module.exports = TradeService;