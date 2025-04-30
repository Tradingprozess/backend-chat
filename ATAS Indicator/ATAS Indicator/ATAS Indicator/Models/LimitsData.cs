namespace ATAS_Indicator.Models
{
    public class LimitsData
    {
        public string AccountId { get; set; } = string.Empty;

        public string Type { get; set; } = string.Empty;

        public decimal Price { get; set; }

        public string SecurityId { get; set; } = string.Empty;
    }
}
