class NumberService {

    static toVolume(number, asString = false) {
        return this.toDecimal(number, 5, asString);
    }

    static toDecimal(number, fractionDigits = 2, asString = false) {
        if(number === undefined) {
            return 0;
        }

        if(asString) {
            return number.toFixed(fractionDigits);
        }
        else {
            return parseFloat(number.toFixed(fractionDigits));
        }
    }
}

module.exports = NumberService;