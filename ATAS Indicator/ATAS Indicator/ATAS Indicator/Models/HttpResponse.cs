using Newtonsoft.Json;

namespace ATAS_Indicator.Models
{
    public class HttpResponse<T>
    {
        #region Public Properties

        /// <summary>
        /// The error in the response
        /// </summary>
        public string? Error { get; set; }

        /// <summary>
        /// The message in the response
        /// </summary>
        public string? Message { get; set; }

        /// <summary>
        /// The data in the response
        /// </summary>
        public T? Data { get; set; }

        #endregion

        #region Public Methods

        /// <summary>
        /// Parses the data and returns the response
        /// </summary>
        /// <typeparam name="T"></typeparam>
        /// <param name="json"></param>
        /// <returns></returns>
        public static HttpResponse<T>? Parse(string json)
        {
            try
            {
                HttpResponse<T>? response = JsonConvert.DeserializeObject<HttpResponse<T>>(json);
                return response;
            }
            catch (Exception ex)
            {
                return new HttpResponse<T>()
                {
                    Error = ex.Message,
                };
            }
        }

        #endregion
    }
}
