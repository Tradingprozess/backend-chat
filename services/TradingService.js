const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const symbolsData = require("../data/symbols-data.json");
const moment = require("moment");
const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const TradeService = require("./trading/TradeService");
const NumberService = require("./NumberService");
const AssetType = require("../enums/AssetType");
const ForexService = require("./trading/ForexService");

class TradingService {
    static getInstrument(securityId, assetType) {
        if (assetType === AssetType.Futures) {
            const sec2 = securityId.slice(0, 2);
            const sec3 = securityId.slice(0, 3);
            for (const instrument of Object.keys(symbolsData)) {
                if (symbolsData[instrument]?.some(symbol => 
                    symbol.startsWith(sec2) || symbol.startsWith(sec3)
                )) {
                    return instrument;
                }
            }
        } else if (assetType === AssetType.Forex) {
            for (const instrument of Object.keys(symbolsData)) {
                if (symbolsData[instrument]?.includes(securityId)) {
                    return instrument;
                }
            }
        }
        return null;
    }

    static async calculateCommission(securityId, subAccountId, volume, commission, isOpen, isClose) {
        if (Math.abs(commission) > 0) {
            return NumberService.toDecimal(Math.abs(commission));
        }

        const applyConditions = {
            OR: [
                { apply: 'on_all_executions' },
                { apply: isOpen ? 'on_entry_executions' : isClose ? 'on_exit_executions' : '' }
            ]
        };

        const assetType = TradeService.getAssetType(securityId);
        let securityMatch = {};

        if (assetType === AssetType.Forex) {
            securityMatch.symbol = securityId;
        } else {
            securityMatch.OR = [
                { symbol: { startsWith: securityId.slice(0, 2) } },
                { symbol: { startsWith: securityId.slice(0, 3) } }
            ];
        }

        let commissionData = await prisma.commission.findFirst({
            where: {
                subAccountId,
                AND: [securityMatch, applyConditions]
            }
        });

        if (!commissionData) {
            const instrument = this.getInstrument(securityId);
            const whereClause = instrument 
                ? { instrument, symbol: 'All', subAccountId, ...applyConditions }
                : { instrument: 'All', symbol: 'All', subAccountId, ...applyConditions };

            commissionData = await prisma.commission.findFirst({
                where: whereClause
            });
        }

        if (!commissionData) return 0;

        const totalCommission = commissionData.mode === 'per_Contract' || commissionData.mode === 'per_Share'
            ? commissionData.commission * Math.abs(volume)
            : commissionData.commission;

        return NumberService.toDecimal(totalCommission + commissionData.fee, 2);
    }

    static sortEntriesByTime(entries, timeProperty) {
        return entries.sort((a, b) => 
            new Date(a[timeProperty]) - new Date(b[timeProperty])
        );
    }

    static async findCloseProximityTrades(data, subAccountId) {
        const proximityData = {};
        let currentGroupId = 1;
        const sortedData = this.sortEntriesByTime(data, 'OpenTime');

        for (const entry of sortedData) {
            const entryTradeCommission = await this.calculateCommission(
                entry.SecurityId, subAccountId, entry.OpenVolume, entry.Commission, true, false
            );
            const exitTradeCommission = Math.abs(entry.Commission) > 0 ? 0 : 
                await this.calculateCommission(entry.SecurityId, subAccountId, entry.CloseVolume, entry.Commission, false, true);
            
            const tradeData = {
                OpenId: entry.OpenId || entry.Id,
                CloseId: entry.CloseId || entry.Id,
                OpenTime: entry.OpenTime,
                CloseTime: entry.CloseTime,
                Side: entry.Side,
                OpenVolume: entry.OpenVolume,
                CloseVolume: entry.CloseVolume,
                OpenPrice: entry.OpenPrice,
                ClosePrice: entry.ClosePrice,
                Commission: entryTradeCommission + exitTradeCommission,
                PnL: entry.PnL,
                OpenType: entry.OpenType,
                CloseType: entry.CloseType,
            };

            if (!proximityData[entry.SecurityId]) {
                proximityData[entry.SecurityId] = [tradeData];
                continue;
            }

            const previousData = proximityData[entry.SecurityId].at(-1);
            if (previousData.Side === tradeData.Side && 
                new Date(previousData.CloseTime) > new Date(tradeData.OpenTime)
            ) {
                const groupId = previousData.GroupId || currentGroupId++;
                previousData.GroupId = groupId;
                tradeData.GroupId = groupId;
            }
            proximityData[entry.SecurityId].push(tradeData);
        }

        return proximityData;
    }

    static async calculatePNL(trade) {
        const symbol = trade.SecurityId;
        let pnl = TradeService.calculatePnL(symbol, trade.OpenPrice, trade.ClosePrice, trade.Side);
        pnl = await TradeService.getAdjustedPrice(symbol, pnl, trade.CloseTime, Math.abs(trade.CloseVolume));

        if (TradeService.getAssetType(symbol) === AssetType.Forex) {
            trade.ExchangeRate = await ForexService.getExchangeRate(
                ForexService.getCurrencyPair(symbol), 
                trade.OpenTime
            );
        }

        if (trade.Commission) {
            pnl -= trade.Commission;
        }
        trade.PnL = pnl;
        return trade;
    }

    static async generateContracts(data, proximityData) {
        const proximityValues = Object.values(proximityData).flat();
        const groupedContracts = {};
        const unGroupedContracts = [];

        for (const proximityTrade of proximityValues) {
            if (proximityTrade.GroupId) {
                const group = groupedContracts[proximityTrade.GroupId] || {
                    OpenTime: proximityTrade.OpenTime,
                    CloseTime: proximityTrade.CloseTime,
                    OpenPrice: 0,
                    ClosePrice: 0,
                    OpenVolume: 0,
                    CloseVolume: 0,
                    Commission: 0,
                    Contracts: [],
                };

                group.OpenPrice += proximityTrade.OpenPrice;
                group.ClosePrice += proximityTrade.ClosePrice;
                group.OpenVolume += proximityTrade.OpenVolume;
                group.CloseVolume += proximityTrade.CloseVolume;
                group.Commission += proximityTrade.Commission;
                group.Contracts.push({
                    OpenTime: proximityTrade.OpenTime,
                    CloseTime: proximityTrade.CloseTime,
                    OpenPrice: proximityTrade.OpenPrice,
                    ClosePrice: proximityTrade.ClosePrice,
                    OpenVolume: proximityTrade.OpenVolume,
                    CloseVolume: proximityTrade.CloseVolume,
                    PnL: proximityTrade.PnL,
                });

                groupedContracts[proximityTrade.GroupId] = group;
            } else {
                unGroupedContracts.push({
                    ...proximityTrade,
                    Contracts: [proximityTrade]
                });
            }
        }

        const allContracts = [...Object.values(groupedContracts), ...unGroupedContracts];
        const tradesToRemove = new Set();

        for (const contract of allContracts) {
            const avgOpen = contract.OpenPrice / contract.Contracts.length;
            const avgClose = contract.ClosePrice / contract.Contracts.length;
            const assetType = TradeService.getAssetType(contract.Contracts[0].SecurityId);
            
            const mainTrade = await prisma.historyMyTrade.create({
                data: {
                    subUserId: contract.Contracts[0].subAccountId,
                    data: {
                        ...contract.Contracts[0],
                        OpenPrice: NumberService.toDecimal(avgOpen, assetType === AssetType.Forex ? 5 : 2),
                        ClosePrice: NumberService.toDecimal(avgClose, assetType === AssetType.Forex ? 5 : 2),
                        Contracts: contract.Contracts
                    },
                    status: 'Closed',
                    openTime: new Date(contract.OpenTime),
                    closeTime: new Date(contract.CloseTime)
                }
            });

            contract.Contracts.slice(1).forEach(t => tradesToRemove.add(t.id));
        }

        await prisma.historyMyTrade.deleteMany({
            where: { id: { in: Array.from(tradesToRemove) } }
        });

        return allContracts;
    }

    static saveCapturedImage(base64Data, fileName) {
        const parsedImage = base64Data.replace(/^data:image\/\w+;base64,/, '');
        const imageBuffer = Buffer.from(parsedImage, 'base64');
        const filePath = path.join('uploads', `${moment().format("DD-MM-YYYY-HH-mm-ss")}-${fileName}`);
        fs.writeFileSync(filePath, imageBuffer);
        return `${process.env.IMAGE_URL}/${filePath}`;
    }

    static async validateSubAccount(accountId, authKey, broker, alternateId) {
        const reference = await prisma.subAccountReference.findFirst({
            where: {
                authKey,
                broker,
                status: 'active',
                OR: [
                    { accountId },
                    ...(alternateId ? [{ accountId: alternateId }] : [])
                ]
            },
            include: { subAccount: true }
        });

        if (!reference) throw new Error("Trade Sync Failed: No receiving account configured");
        return {
            user: await prisma.user.findUnique({ where: { id: reference.subAccount.userId } }),
            subAccount: reference.subAccount
        };
    }

    static async insertAutoSyncTrade(broker, authKey, accountId, tradeId, type, securityId, price, volume, commission, image, captureEntry, captureExit) {
        const { subAccount, user } = await this.validateSubAccount(accountId, authKey, broker);
        return this.insertSingleTrade(
            subAccount,
            user.timeZone,
            securityId,
            type,
            new Date(),
            price,
            volume,
            commission,
            0,
            0,
            true,
            null,
            image,
            captureEntry,
            captureExit,
            tradeId
        );
    }

    static async insertSingleTrade(subAccount, timeZone, securityId, type, time, price, volume, commission, stopLoss, profitTarget, settle = true, targetTrade = null, image = null, captureEntry = false, captureExit = false, tradeId = null) {
        const TIME_FORMAT = "MM/DD/YYYY HH:mm:ss";

        if (tradeId) {
            const existing = await prisma.historyMyTrade.findFirst({
                where: {
                    OR: [
                        { data: { path: ['OpenId'], equals: tradeId } },
                        { data: { path: ['CloseId'], equals: tradeId } }
                    ]
                }
            });
            if (existing) throw new Error("Duplicate Trade");
        }

        const openTrades = await prisma.historyMyTrade.findMany({
            where: {
                subUserId: subAccount.id,
                data: { path: ['SecurityId'], equals: securityId },
                status: { not: 'Closed' },
                data: { path: ['OpenType'], equals: type === 'Buy' ? 'Sell' : 'Buy' }
            },
            orderBy: { openTime: 'asc' }
        });

        if (!settle || openTrades.length === 0) {
            return prisma.historyMyTrade.create({
                data: {
                    subUserId: subAccount.id,
                    TimeZone: timeZone,
                    data: {
                        PnL: 0,
                        Side: type === 'Buy' ? 'LONG' : 'SHORT',
                        OpenId: tradeId || uuidv4(),
                        CloseId: '',
                        OpenTime: moment(time).format(TIME_FORMAT),
                        CloseTime: '',
                        OpenPrice: price,
                        ClosePrice: 0,
                        Commission: await this.calculateCommission(securityId, subAccount.id, volume, commission, true, false),
                        OpenVolume: type === 'Buy' ? volume : -volume,
                        SecurityId: securityId,
                        OpenType: type,
                        Contracts: []
                    },
                    openTime: time,
                    status: 'Open',
                    entryImage: captureEntry ? this.saveCapturedImage(image, 'entry.png') : null
                }
            });
        }

        let volumeToSettle = volume;
        for (const trade of openTrades) {
            if (volumeToSettle <= 0) break;
            
            const remaining = Math.abs(trade.data.OpenVolume + trade.data.CloseVolume);
            const settled = Math.min(remaining, volumeToSettle);
            const newCloseVolume = trade.data.CloseVolume + (trade.data.Side === 'LONG' ? -settled : settled);
            
            await prisma.historyMyTrade.update({
                where: { id: trade.id },
                data: {
                    data: {
                        ...trade.data,
                        CloseId: tradeId || uuidv4(),
                        CloseTime: moment(time).format(TIME_FORMAT),
                        ClosePrice: this.calculateClosePrice(trade, price, settled),
                        CloseVolume: newCloseVolume,
                        Commission: trade.data.Commission + await this.calculateCommission(securityId, subAccount.id, settled, commission, false, true),
                        Contracts: [
                            ...trade.data.Contracts,
                            {
                                OpenTime: trade.data.OpenTime,
                                CloseTime: moment(time).format(TIME_FORMAT),
                                OpenPrice: trade.data.OpenPrice,
                                ClosePrice: price,
                                OpenVolume: trade.data.Side === 'LONG' ? settled : -settled,
                                CloseVolume: trade.data.Side === 'LONG' ? -settled : settled,
                                PnL: await this.calculatePNL({
                                    ...trade.data,
                                    ClosePrice: price,
                                    CloseVolume: newCloseVolume
                                })
                            }
                        ]
                    },
                    status: settled === remaining ? 'Closed' : 'Partial',
                    exitImage: captureExit ? this.saveCapturedImage(image, 'exit.png') : null
                }
            });

            volumeToSettle -= settled;
        }

        if (volumeToSettle > 0) {
            return this.insertSingleTrade(
                subAccount,
                timeZone,
                securityId,
                type,
                time,
                price,
                volumeToSettle,
                commission,
                stopLoss,
                profitTarget,
                false
            );
        }
    }

    static calculateClosePrice(trade, price, volume) {
        const prevClose = Math.abs(trade.data.CloseVolume);
        return prevClose > 0 
            ? (prevClose * trade.data.ClosePrice + volume * price) / (prevClose + volume)
            : price;
    }

    static async applyStopLossOrTakeProfit(subAccount, securityId, type, price) {
        const openTrades = await prisma.historyMyTrade.findMany({
            where: {
                subUserId: subAccount.id,
                data: { path: ['SecurityId'], equals: securityId },
                status: { not: 'Closed' }
            }
        });

        for (const trade of openTrades) {
            const update = { data: { ...trade.data } };
            
            if (type === 'auto') {
                const side = trade.data.Side;
                const openPrice = trade.data.OpenPrice;
                let newType;
                
                if (side === 'LONG') {
                    newType = openPrice > price ? 'StopLoss' : 'ProfitTarget';
                } else {
                    newType = openPrice < price ? 'StopLoss' : 'ProfitTarget';
                }
                update.data[newType] = price;
            } else {
                update.data[type] = price;
            }

            await prisma.historyMyTrade.update({
                where: { id: trade.id },
                data: update
            });
        }
    }
}

module.exports = TradingService;