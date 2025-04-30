using ATAS.DataFeedsCore;
using ATAS.Indicators;
using ATAS.Indicators.Other;

using ATAS_Indicator.Helpers;
using ATAS_Indicator.Models;
using ATAS_Indicator.Static;

using OFT.Rendering.Context;
using OFT.Rendering.Tools;

using System.ComponentModel;
using System.ComponentModel.DataAnnotations;

using Utils.Common.Logging;

namespace ATAS_Indicator
{
    [DisplayName("TradingProzess AutoSync Indicator")]
    public class TradingProzess_ATAS_AutoSync_Indicator : Indicator
    {

        #region Constant Members

        private const string DATA_FILE = "application-data.json";

        #endregion

        #region Private Members

        /// <summary>
        /// The manager for sending requests to the backend
        /// </summary>
        private RequestManager _requestManager;

        /// <summary>
        /// The data manager to manage the persistent data configuration
        /// </summary>
        private ApplicationDataManager<ApplicationData> _dataManager;

        /// <summary>
        /// A field to allow user to trigger data change
        /// </summary>
        private bool _hasDataChanged;

        #endregion

        #region Public Properties

        /// <summary>
        /// Setter and getter for the property
        /// </summary>
        public bool HasDataChanged
        {
            get { return _hasDataChanged; }
            set
            {
                _hasDataChanged = value;
                AuthenticateUser();
            }
        }

        /// <summary>
        /// Indicates whether to capture screen shot when the trade is placed
        /// </summary>
        [Display(Name = "Capture Entry", GroupName = "Screenshots")]
        public bool CaptureEntry { get; set; }

        /// <summary>
        /// Indicates whether to capture screen shot when the trade is closed
        /// </summary>
        [Display(Name = "Capture Exit", GroupName = "Screenshots")]
        public bool CaptureExit { get; set; }

        #endregion

        #region Constructor

        /// <summary>
        /// Default Constructor
        /// </summary>
        public TradingProzess_ATAS_AutoSync_Indicator()
        {
            _requestManager = new RequestManager(this.LogWarn);
            _dataManager = new ApplicationDataManager<ApplicationData>(DATA_FILE);
            EnableCustomDrawing = true;
            SubscribeToDrawingEvents(DrawingLayouts.Final);
            AuthenticateUser();
        }

        #endregion

        #region Overriden Methods

        protected override void OnCalculate(int bar, decimal value)
        {
        }

        // Fires when the window disposes
        protected override void OnDispose()
        {
            base.OnDispose();
        }

        /// <summary>
        /// Fires when a new order is placed in the platform
        /// </summary>
        /// <param name="order"></param>
        protected override async void OnNewOrder(Order order)
        {
            if(!string.IsNullOrEmpty(order.Comment) && (order.Comment == "SL" || order.Comment == "TP") && !string.IsNullOrEmpty(order.AccountID) && _dataManager.Data.LinkedAccounts.Contains(order.AccountID) && !string.IsNullOrEmpty(_dataManager.Data.Code) && !string.IsNullOrEmpty(order.SecurityId))
            {
                try
                {
                    this.LogWarn($"Syncing Limits - Data for Account {order.AccountID}");

                    LimitsData data = new LimitsData()
                    {
                        Type = order.Comment == "SL" ? "StopLoss" : "ProfitTarget",
                        Price = order.Comment == "SL" ? order.TriggerPrice : order.Price,
                        AccountId = order.AccountID,
                        SecurityId = order.SecurityId
                    };

                    HttpResponse<EmptyResponse> response = await _requestManager.SendPost<LimitsData, EmptyResponse>(Routes.ADD_TRADE_LIMITS, data, new Dictionary<string, string>() { ["auth"] = _dataManager.Data.Code });
                }
                catch (Exception ex)
                {
                    this.LogError(ex.Message);
                }
            }
        }

        /// <summary>
        /// Fires when a trade is executed in the ATAS platform
        /// </summary>
        /// <param name="myTrade"></param>
        protected override async void OnNewMyTrade(MyTrade myTrade)
        {
            if(!string.IsNullOrEmpty(_dataManager.Data.Code) && _dataManager.Data.LinkedAccounts.Contains(myTrade.AccountID))
            {
                try
                {
                    this.LogWarn($"Syncing Trade Data for Account {myTrade.AccountID} - Volume {myTrade.Volume}");

                    TradeData data = new TradeData()
                    {
                        TradeId = myTrade.AccountID == "Replay" ? Guid.NewGuid().ToString() : myTrade.Id,
                        AccountId = myTrade.AccountID,
                        Type = myTrade.OrderDirection.ToString(),
                        SecurityId = myTrade.SecurityId,
                        Price = myTrade.Price,
                        Volume = myTrade.Volume,
                        Commission = myTrade.Commission ?? 0,
                        CaptureEntry = CaptureEntry,
                        CaptureExit = CaptureExit,
                    };

                    Screen? screen = ScreenManager.GetScreenWithATAS();
                    if(screen != null)
                    {
                        this.LogWarn($"Capturing Screen Shot with Enabled Values of capture entry: {CaptureEntry} & capture exit: {CaptureExit}");
                        data.Image = Convert.ToBase64String(ScreenManager.CaptureScreenShot(screen.WorkingArea));
                    }

                    HttpResponse<EmptyResponse> response = await _requestManager.SendPost<TradeData, EmptyResponse>(Routes.ADD_TRADE, data, new Dictionary<string, string>() { ["auth"] = _dataManager.Data.Code });
                }
                catch (Exception ex)
                {
                    this.LogError(ex.Message);
                }
            }
        }

        /// <summary>
        /// Fires on each render to show the connection details and the portfolio details
        /// </summary>
        /// <param name="context"></param>
        /// <param name="layout"></param>
        protected override void OnRender(RenderContext context, DrawingLayouts layout)
        {
            if(TradingManager == null)
            {
                return;
            }

            var label = "";

            if(string.IsNullOrEmpty(_dataManager.Data.Code))
            {
                label += $"Connection: Not Established {Environment.NewLine}";
            }
            else
            {
                label += $"Connection: Ok ({_dataManager.Data.User.Email}){Environment.NewLine}";
            }

            if (TradingManager.Security != null)
                label += $"Security: {TradingManager.Security}{Environment.NewLine}";

            IEnumerable<Order>? orders = TradingManager.Orders.Where(t => t.State == OrderStates.Active);

            if (orders.Any())
            {
                label += $"Orders: {orders.Count()}){Environment.NewLine}";
            }
            else
            {
                label += $"Waiting for orders...{Environment.NewLine}";
            }

            IEnumerable<MyTrade> myTrades = TradingManager.MyTrades;

            if (myTrades.Any())
            {
                label += $"Trades: {myTrades.Count()}{Environment.NewLine}";
            }
            else
            {
                label += $"Waiting for Trades...{Environment.NewLine}";
            }

            var font = new RenderFont("Arial", 10);
            var size = context.MeasureString(label, font);
            context.FillRectangle(Color.FromArgb(100, 100, 100, 100), new Rectangle(25, context.ClipBounds.Bottom - size.Height - 50, (int)size.Width + 50, (int)size.Height + 25));
            context.DrawString(label, font, Color.White, 50, context.ClipBounds.Bottom - size.Height - 25);
        }

        #endregion

        #region Private Methods

        /// <summary>
        /// Authenticates the user
        /// </summary>
        private async void AuthenticateUser()
        {
            DialogResult result;
            this.LogWarn("Checking whether the key is present or not");
            //If the code is not present then
            if (string.IsNullOrEmpty(_dataManager.Data.Code))
            {
                this.LogError("Auth Key is not present. Showing the connection screen.");
                result = ShowConnectionWindow(_dataManager, _requestManager);
            }

            this.LogWarn("Connection Screen Closed");
            //If the dialog result is ok then authenticate the user
            if(!string.IsNullOrEmpty(_dataManager.Data.Code))
            {
                this.LogWarn("Code Found and Sending Request to Obtain User Data");
                HttpResponse<AuthenticateResult> response = await _requestManager.SendPost<string, AuthenticateResult>(Routes.AUTHENTICATE, null, new Dictionary<string, string> { ["auth"] = _dataManager.Data.Code });

                this.LogWarn("Received response from the authentication API");

                if(response.Data != null)
                {
                    _dataManager.Data.User = response.Data.User;
                    _dataManager.Data.LinkedAccounts = response.Data.AccountIds;
                    _dataManager.SaveData();
                }
                else
                {
                    _dataManager.Data.User = new Data.User();
                    _dataManager.Data.LinkedAccounts = new List<string>();
                    _dataManager.Data.Code = "";
                    _dataManager.SaveData();
                    AuthenticateUser();
                }
            }
        }

        #endregion

        #region Helper Methods

        /// <summary>
        /// Shows the connection window
        /// </summary>
        protected static DialogResult ShowConnectionWindow(ApplicationDataManager<ApplicationData> _dataManager, RequestManager _requestManager)
        {
            TradingProzessForm form = new TradingProzessForm(_dataManager, _requestManager);
            return form.ShowDialog();
        }

        #endregion
    }
}
