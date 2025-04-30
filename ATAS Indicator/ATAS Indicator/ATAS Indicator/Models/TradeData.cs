namespace ATAS_Indicator.Models
{
    public class TradeData
    {
        public string TradeId { get; set; } = string.Empty;

        public string AccountId { get; set; } = string.Empty;

        public string Type { get; set; } = string.Empty;

        public string SecurityId { get; set; } = string.Empty;

        public decimal Price { get; set; }

        public decimal Volume { get; set; }

        public decimal Commission { get; set; }

        public string Image { get; set; } = string.Empty;

        public bool CaptureEntry { get; set; }

        public bool CaptureExit { get; set; }
    }
}
