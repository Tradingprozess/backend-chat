using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace ATAS_Indicator.Static
{
    public static class Routes
    {
        #region Private Members

        /// <summary>
        /// Local URI: http://localhost:3001
        /// Live URI: https://backstaging.tradingprozess.com/backend
        /// </summary>
        private const string BASE_URI = "https://backstaging.tradingprozess.com/backend";

        #endregion

        #region Private Methods

        /// <summary>
        /// Returns the route by combining the provided route with the base uri
        /// </summary>
        /// <param name="path"></param>
        /// <returns></returns>
        private static string GetRoute(string path)
        {
            return $"{BASE_URI}/{path}";
        }

        #endregion

        #region Routes

        /// <summary>
        /// Route to autosync trades from the indicator to the trading prozess
        /// </summary>
        public static string ADD_TRADE = GetRoute("history-my-trades/add/trade");

        /// <summary>
        /// Route to autosync trade limits from the indicator to the trading prozess
        /// </summary>
        public static string ADD_TRADE_LIMITS = GetRoute("history-my-trades/add/limit");

        /// <summary>
        /// Used to submit an otp to verify the connection and to enable auto sync
        /// </summary>
        public static string VERIFY_CONNECTION = GetRoute("auto-sync/verify");

        /// <summary>
        /// Used to authenticate and retrieve the account numbers to submit
        /// </summary>
        public static string AUTHENTICATE = GetRoute("auto-sync/authenticate");

        #endregion
    }
}
