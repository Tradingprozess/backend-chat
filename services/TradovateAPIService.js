const APIService = require('./ApiService');
const WebSocketClient = require('websocket').client;
const Logger = require('./Logger');
const TradingService = require("./TradingService");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();


class TradovateAPIService {

    static BASE_URL = process.env.TRADOVATE_API_URL;

    static WEBSOCKET_URL = process.env.TRADOVATE_WEBSOCKET_URL;

    static OAUTH_TOKEN_URL = `${this.BASE_URL}/auth/oauthtoken`;

    static CONTRACT_ITEM_URL = `${this.BASE_URL}/contract/item`;

    static RENEW_ACCESS_TOKEN_URL = `${this.BASE_URL}/auth/renewaccesstoken`

    static ACCOUNTS_LIST_URL = `${this.BASE_URL}/account/list`;

    static CONNECTION_DATA = {}

    static ACCOUNT_REFERENCES = {};

    static ORDER_DATA = {};

    static SOCKET_REQUESTS = {};

    static CONTRACT_ITEMS = {}

    static SOCKET_CONNECTIONS = {}

    static GetOAuthUrl(state = {}) {
        const urlParams = {
            response_type: 'code',
            client_id: process.env.TRADOVATE_CLIENT_ID,
            redirect_uri: `${process.env.TRADOVATE_RETURN_URI}`,
            state: JSON.stringify(state)
        }
        return `https://trader.tradovate.com/oauth?${new URLSearchParams(urlParams)}`
    }

    static async GetOAuthToken(code) {
        const response = await APIService.Post(this.OAUTH_TOKEN_URL, {
            "grant_type": "authorization_code",
            "client_id": process.env.TRADOVATE_CLIENT_ID,
            "client_secret": process.env.TRADOVATE_SECRET,
            "redirect_uri": process.env.TRADOVATE_RETURN_URI,
            "code": code,
        })
        if (response.success) {
            Logger.important('Tradovate API', `Generated OAuth Access Token`);
            return {
                access_token: response.data.access_token,
                token_type: response.data.token_type,
                expires_in: response.data.expires_in
            }
        }
    }

    static async RenewAccessToken(access_token) {
        const response = await APIService.Get(this.RENEW_ACCESS_TOKEN_URL, {
            authorization: `Bearer ${access_token}`,
        })
        if (response.success) {
            Logger.important('Tradovate API', `Renewed Access Token for user ${response.data.userId}`);
            return {
                access_token: response.data.accessToken,
                user_id: response.data.userId,
            }
        }
    }

    static async GetAccountsList(access_token) {
        const response = await APIService.Get(this.ACCOUNTS_LIST_URL, { authorization: `Bearer ${access_token}` });
        if (response.success) {
            return response.data;
        }
        return [];
    }

    static async GetContractItem(id, access_token) {

        if (this.CONTRACT_ITEMS[id]) {
            return this.CONTRACT_ITEMS[id];
        }

        const response = await APIService.Get(`${this.CONTRACT_ITEM_URL}?${new URLSearchParams({ id: id })}`, {
            authorization: `Bearer ${access_token}`
        })
        if (response.success) {
            this.CONTRACT_ITEMS[id] = response.data;
            return response.data
        }
    }

    static parseMessage(raw) {

        const T = raw.slice(0, 1)
        let payload = []
        const data = raw.slice(1)
        if (data) {
            const parsedData = JSON.parse(data)
            payload = parsedData.map(response => ({
                status: response.s,
                requestId: response.i,
                data: response.d
            }))
        }
        return [T, payload]
    }

    static generateUniqueId() {
        const idsInUse = Object.keys(this.SOCKET_REQUESTS).map(t => parseInt(t));
        if (idsInUse.length > 0) {
            const maxId = Math.max(...idsInUse);
            return maxId + 1;
        }
        else {
            return 1;
        }
    }

    static prepareMessage(url, queryParams = null, body = null) {
        const uniqueId = this.generateUniqueId();
        this.SOCKET_REQUESTS[uniqueId] = url;
        return `${url}\n${uniqueId}\n${queryParams || ''}\n${body ? typeof body === 'object' ? JSON.stringify(body) : body : ''}`;
    }

    static popRequest(id) {
        const request = this.SOCKET_REQUESTS[id];
        delete this.SOCKET_REQUESTS[id];
        return request;
    }

    static SetupWebSocketConnection(userId, access_token) {
        const client = new WebSocketClient()

        client.on('connectFailed', (err) => {
            Logger.error('Tradovate API', `Error when connecting to the tradovate socket: ${err}`)
        })

        client.on('connect', function (connection) {
            Logger.important('Tradovate API', `Socket Connection Successful for user ${userId}`)
            TradovateAPIService.SOCKET_CONNECTIONS[userId] = connection;

            connection.on('error', function (error) {
                Logger.error('Tradovate API', "Connection error: " + error.toString());
            });

            connection.on('close', function (message) {
                Logger.important('Tradovate API', `Connection closed for user ${userId} with message ${message}`);
            });

            connection.on('message', async function (message) {
                const [T, responses] = TradovateAPIService.parseMessage(message.utf8Data);

                // If its the open frame send the login request
                if (T === 'o') {
                    // Authenticating the client
                    const authorizeMessage = TradovateAPIService.prepareMessage('authorize', null, access_token);
                    Logger.important('Tradovate API', 'Sending Authorization Request')
                    connection.sendUTF(authorizeMessage);
                }
                // Responding to the heart beat frame
                else if (T === 'h') {
                    connection.sendUTF('[]');
                }
                // Received any other frame
                else if (T === 'a') {
                    for (const response of responses) {
                        const request = TradovateAPIService.popRequest(response.requestId);
                        if (request === 'authorize') {
                            // Sending request for User Synchronization
                            const syncMessage = TradovateAPIService.prepareMessage('user/syncrequest', null, {
                                users: [userId]
                            });
                            Logger.important('Tradovate API', `Sending User Synchronization Request for user ${userId}`)
                            connection.sendUTF(syncMessage);
                        }
                        else if (request === 'user/syncrequest') {
                            for (const acc of response.data.accounts) {
                                const userTokens = TradovateAPIService.CONNECTION_DATA[acc.userId];
                                if (userTokens) {
                                    const latestAccessToken = userTokens[acc.id];
                                    try {
                                        const { user, subAccount } = await TradingService.validateSubAccount(acc.name, latestAccessToken, 'Ninja Trader', acc.nickname)
                                        TradovateAPIService.ACCOUNT_REFERENCES[acc.id] = {
                                            subAccount: subAccount,
                                            user: user
                                        };
                                    }
                                    catch (error) {
                                        Logger.error('Tradovate API', 'Found account id which did not existed in the sub account reference')
                                    }
                                }
                            }
                        }
                        else if (response.data) {
                            Logger.log('Tradovate API Events', `Received entity ${response.data.entityType} with event ${response.data.eventType} for user ${userId}`)
                            const validEntityTypes = ['order', 'executionReport', 'orderVersion', 'fillFee']
                            const data = response.data;
                            console.log(data)
                            if (validEntityTypes.includes(data.entityType)) {
                                const entity = data.entity;
                                // Capturing the order on creation
                                if (data.entityType === 'order') {
                                    if (data.eventType === 'Created') {
                                        if (!TradovateAPIService.ORDER_DATA[entity.accountId]) {
                                            TradovateAPIService.ORDER_DATA[entity.accountId] = {}
                                        }

                                        if (!TradovateAPIService.ORDER_DATA[entity.accountId][entity.id]) {
                                            TradovateAPIService.ORDER_DATA[entity.accountId][entity.id] = entity.contractId;
                                        }
                                    }
                                }
                                // Listening for an filled execution report
                                else if (data.entityType === 'executionReport' && data.eventType === 'Created' && entity.ordStatus === 'Filled') {
                                    if (TradovateAPIService.ORDER_DATA[entity.accountId] && TradovateAPIService.ORDER_DATA[entity.accountId][entity.orderId]) {
                                        const price = entity.avgPx;
                                        const volume = entity.cumQty;
                                        const action = entity.action;

                                        // Getting the contract item
                                        const contractItem = await TradovateAPIService.GetContractItem(entity.contractId, access_token);

                                        Logger.important('Tradovate API', `Captured Execution Report for Order ${entity.orderId} with values ${contractItem.name} ${action} - ${price} - ${volume}`);

                                        // Removing the order from the list
                                        delete TradovateAPIService.ORDER_DATA[entity.accountId][entity.orderId];

                                        const accountReference = TradovateAPIService.ACCOUNT_REFERENCES[entity.accountId];
                                        if (accountReference) {

                                            Logger.important('Tradovate API', `Inserted Trade with values ${contractItem.name} ${action} - ${price} - ${volume}`);

                                            const { user, subAccount } = accountReference;
                                            // Inserting the trade
                                            await TradingService.insertSingleTrade(subAccount, null, contractItem.name, action, new Date(), price, volume, 0, 0, 0, true, null, null, false, false, entity.orderId);
                                        }
                                    }
                                }
                                else if (data.entityType === 'orderVersion' && data.eventType === 'Created') {
                                    if (entity.orderType === 'Limit' || entity.orderType === 'Stop') {
                                        let contractId = undefined;
                                        let userAccountId = undefined;
                                        const orderId = entity.orderId;
                                        for (const accountId of Object.keys(TradovateAPIService.ORDER_DATA)) {
                                            if (TradovateAPIService.ORDER_DATA[accountId][orderId]) {
                                                contractId = TradovateAPIService.ORDER_DATA[accountId][orderId];
                                                userAccountId = accountId;
                                                break;
                                            }
                                        }
                                        if (contractId && userAccountId) {
                                            const accountReference = TradovateAPIService.ACCOUNT_REFERENCES[userAccountId];
                                            if (accountReference) {
                                                const { user, subAccount } = accountReference;
                                                const price = entity.price || entity.stopPrice;
                                                // Getting the contract item
                                                const contractItem = await TradovateAPIService.GetContractItem(contractId, access_token);
                                                Logger.important('Tradovate API', `Captured Order Version for Order ${entity.orderId} with values ${contractItem.name} ${price} ${entity.orderType}`);
                                                await TradingService.applyStopLossOrTakeProfit(subAccount, contractItem.name, 'auto', price)
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            });
        })

        client.connect(this.WEBSOCKET_URL);
    }

    static async InitializeForUser(access_token, account_id, account_name, userId) {
        if (access_token) {
            const accounts = await this.GetAccountsList(access_token);
            if (accounts.length > 0) {
                const acc = accounts.filter(acc => acc.id === account_id && acc.userId === userId && (acc.name === account_name || acc.nickname === account_name))[0];
                if (acc) {
                    if (!this.CONNECTION_DATA[acc.userId]) {
                        this.CONNECTION_DATA[acc.userId] = {}
                    }
                    this.CONNECTION_DATA[acc.userId][acc.id] = access_token;
                    this.SetupWebSocketConnection(userId, access_token);
                }
            }
        }
    }

    static async SetupWebsocketForExistingConnections() {

        await TradovateAPIService.RenewAllAccessTokens();

        const subAccountReferences = await prisma.subAccountReference.findMany({ where: { broker: "Ninja Trader", status: 'active' } });

        for (const subAccountReference of subAccountReferences) {
            Logger.important('Tradovate Initialization', `Initializing websocket for ${subAccountReference.accountId}`)
            await this.InitializeForUser(subAccountReference.authKey, subAccountReference.additionalData.accountId, subAccountReference.accountId, subAccountReference.additionalData.userId);
        }
    }

    static CloseConnection(userId, accountId) {
        const userConnections = this.CONNECTION_DATA[userId];
        if (userConnections) {
            delete userConnections[accountId]
            delete this.ACCOUNT_REFERENCES[accountId]
            if (Object.keys(userConnections).length === 0) {
                delete this.CONNECTION_DATA[userId];
                const socketConnection = this.SOCKET_CONNECTIONS[userId];
                if (socketConnection) {
                    socketConnection.close();
                }
                delete this.SOCKET_CONNECTIONS[userId]
            }
        }
    }

    static async RenewAllAccessTokens() {
        Logger.important('Tradovate API', 'Renewing access token for all of the existing connections')
        const subAccountReferences = await prisma.subAccountReference.findMany({ where: { broker: "Ninja Trader", status: 'active' } });
        const existingTokens = {}
        for (const subAccountReference of subAccountReferences) {
            const authKey = subAccountReference.authKey;
            if (authKey !== '-' && subAccountReference.additionalData) {
                if (existingTokens[subAccountReference.additionalData.userId]) {
                    subAccountReference.authKey = existingTokens[subAccountReference.additionalData.userId];
                    await subAccountReference.save();
                }
                else {
                    const response = await TradovateAPIService.RenewAccessToken(authKey);
                    if (response && response.access_token) {
                        subAccountReference.authKey = response.access_token;
                        existingTokens[subAccountReference.additionalData.userId] = response.access_token;
                        await subAccountReference.save();
                    }
                    else {
                        subAccountReference.authKey = '-';
                        subAccountReference.status = 'inactive';
                        await subAccountReference.save();
                    }
                }
            }
        }

        // Setting Timeout to call this method again
        setTimeout(async () => {
            await TradovateAPIService.RenewAllAccessTokens();
        }, 65 * 60 * 1000)
    }
}

module.exports = TradovateAPIService;