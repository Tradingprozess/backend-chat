using ATAS_Indicator.Helpers;
using ATAS_Indicator.Models;
using ATAS_Indicator.Static;

namespace ATAS_Indicator
{
    public class TradingProzessForm : Form
    {
        #region Controls

        /// <summary>
        /// The textbox with the code
        /// </summary>
        private TextBox codeInput { get; set; }

        /// <summary>
        /// The submit button
        /// </summary>
        private Button submitButton { get; set; }

        /// <summary>
        /// The label to show the message
        /// </summary>
        private Label messageLabel { get; set; }

        /// <summary>
        /// The data manage instance to handle data management tasks
        /// </summary>
        private ApplicationDataManager<ApplicationData> _dataManager;

        /// <summary>
        /// Request manager instance
        /// </summary>
        private RequestManager _requestManager;

        #endregion

        #region Constructor

        /// <summary>
        /// Default Constructor
        /// </summary>
        /// <param name="applicationDataManager"></param>
        /// <param name="requestManager"></param>
        public TradingProzessForm(ApplicationDataManager<ApplicationData> applicationDataManager,
            RequestManager requestManager)
        {
            _dataManager = applicationDataManager;
            _requestManager = requestManager;
            // Form settings
            this.Text = "Connect to Tradingprozess Platform";
            this.Size = new Size(350, 250); // Reduced form height
            this.FormBorderStyle = FormBorderStyle.FixedDialog;
            this.MaximizeBox = false;
            this.MinimizeBox = false;
            this.StartPosition = FormStartPosition.CenterScreen;
            this.BackColor = Color.FromArgb(34, 34, 34); // Dark background

            // Font and colors
            Font labelFont = new Font("Arial", 9, FontStyle.Regular);
            Color labelColor = Color.LightGray; // Light gray for readability
            Color inputBackground = Color.FromArgb(48, 48, 48); // Dark gray for inputs
            Color primaryColor = Color.FromArgb(0, 255, 179); // #00FFB3
            Color secondaryColor = Color.FromArgb(56, 182, 255); // #38B6FF
            Color darkButtonColor = Color.FromArgb(64, 64, 64); // Darker button background

            // Title Label
            Label titleLabel = new Label
            {
                Text = "Connect to the Tradingprozess Platform",
                Font = new Font("Arial", 11, FontStyle.Bold),
                ForeColor = primaryColor,
                TextAlign = ContentAlignment.MiddleCenter,
                Dock = DockStyle.Top,
                Padding = new Padding(0, 5, 0, 10), // Reduced padding
                AutoSize = false,
                Height = 40
            };
            this.Controls.Add(titleLabel);

            // "Enter Code" Label
            Label enterCodeLabel = new Label
            {
                Text = "Enter Code",
                Font = labelFont,
                ForeColor = labelColor,
                Location = new Point(20, 60), // Reduced vertical gap
                AutoSize = true
            };
            this.Controls.Add(enterCodeLabel);

            // Code Input Field
            codeInput = new TextBox
            {
                Width = 280,
                Location = new Point(20, 80), // Reduced vertical gap
                BackColor = inputBackground,
                ForeColor = Color.White,
                BorderStyle = BorderStyle.FixedSingle
            };
            this.Controls.Add(codeInput);

            // Message/Error Label
            messageLabel = new Label
            {
                Text = "", // Initially empty
                Font = labelFont,
                ForeColor = Color.Red,
                Location = new Point(20, 110), // Adjusted vertical positioning
                AutoSize = true
            };
            this.Controls.Add(messageLabel);

            // Submit Button
            submitButton = new Button
            {
                Text = "Submit",
                Width = 120,
                Height = 30,
                Location = new Point(20, 150),
                BackColor = secondaryColor,
                ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat
            };
            submitButton.Click += SubmitButton_Click;
            this.Controls.Add(submitButton);

            // Cancel Button with Dark Theme
            Button cancelButton = new Button
            {
                Text = "Cancel",
                Width = 120,
                Height = 30,
                Location = new Point(160, 150), // Aligned horizontally
                BackColor = darkButtonColor,
                ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat
            };
            this.Controls.Add(cancelButton);

            // Event Handler for Cancel Button
            cancelButton.Click += (sender, args) =>
            {
                this.Close();
            };
        }

        #endregion

        #region Event Handlers

        /// <summary>
        /// Fires when the user submits
        /// </summary>
        /// <param name="sender"></param>
        /// <param name="e"></param>
        /// <exception cref="NotImplementedException"></exception>
        private async void SubmitButton_Click(object? sender, EventArgs e)
        {
            string code = codeInput.Text.Trim();
            messageLabel.Text = "";
            if (string.IsNullOrEmpty(code))
            {
                messageLabel.Text = "Error: Please enter a code.";
                messageLabel.ForeColor = Color.Red;
                return;
            }

            submitButton.Enabled = false;
            submitButton.Text = "Loading...";
            HttpResponse<AuthKeyModel> response = await _requestManager.SendPost<CodeModel, AuthKeyModel>(Routes.VERIFY_CONNECTION, new CodeModel() { Code = code });

            if(response.Data != null)
            {
                _dataManager.Data.Code = response.Data.AuthKey;
                _dataManager.SaveData();
                messageLabel.ForeColor = Color.Green;
                messageLabel.Text = $"Success: Connection Verification Completed";
                submitButton.Text = "Submitted";
                this.Close();
            }
            else
            {
                messageLabel.Text = $"Error: {response.Error}";
                submitButton.Enabled = true;
                submitButton.Text = "Submit";
            }
        }

        #endregion
    }
}
