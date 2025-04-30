const FreeCurrencyApi = require('./FreeCurrencyApi');

class FreeCurrencyService {

    static client;

    static getClient() {
        if(!this.client) {
            this.client = new FreeCurrencyApi(process.env.FREE_CURRENCY_API_KEY);
        }
        return this.client;
    }

    static async getHistoricalData (date, base_currency) {
        const client = this.getClient();
        return await client.historical({
            date: date,
            base_currency: base_currency
        })
    }

    static async getLatestData (base_currency) {
        const client = this.getClient();
        return await client.latest({
            base_currency: base_currency
        })
    }
}

module.exports = FreeCurrencyService;