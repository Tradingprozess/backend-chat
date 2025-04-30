using ATAS.DataFeedsCore;
using System.Net.Http.Json;
using System;
using ATAS_Indicator.Models;

namespace ATAS_Indicator.Helpers
{
    public class RequestManager
    {
        #region Private Members

        /// <summary>
        /// The client to be used for requests
        /// </summary>
        private HttpClient _httpClient;

        /// <summary>
        /// The method to log errors to
        /// </summary>
        private Action<string, object?[]> _errorLogger;

        #endregion

        #region Constructor

        /// <summary>
        /// Default Constructor
        /// </summary>
        public RequestManager(Action<string, object?[]> errorLogger)
        {
            _httpClient = new HttpClient();
            _errorLogger = errorLogger;
        }

        #endregion

        #region Public Methods

        /// <summary>
        /// Sends Get Request to the specified URL
        /// </summary>
        /// <typeparam name="T">The object to receive</typeparam>
        /// <returns></returns>
        public async Task<HttpResponse<T>> SendGet<T>(string url)
            where T : class, new()
        {
            try
            {
                HttpRequestMessage request = new HttpRequestMessage(HttpMethod.Get, url);
                HttpResponseMessage response = await _httpClient.SendAsync(request);
                string jsonContent = await response.Content.ReadAsStringAsync();
                HttpResponse<T>? data = HttpResponse<T>.Parse(jsonContent);

                if (data != null)
                {
                    if (!response.IsSuccessStatusCode)
                    {
                        _errorLogger(data.Error ?? "", []);
                    }
                    return data;
                }
                else
                {
                    _errorLogger("Server Error. No response received", []);
                    return new HttpResponse<T>();
                }
            }
            catch(Exception ex)
            {
                _errorLogger(ex.Message, []);
                return new HttpResponse<T>()
                {
                    Error = ex.Message
                };
            }
        }

        /// <summary>
        /// Sends Post Request to the specified URL
        /// </summary>
        /// <typeparam name="R">The object to receive</typeparam>
        /// <typeparam name="T">The object to post</typeparam>
        /// <returns></returns>
        public async Task<HttpResponse<R>> SendPost<T, R>(string url, T? body)
            where R : class, new()
        {
            try
            {
                HttpRequestMessage request = new HttpRequestMessage(HttpMethod.Post, url);

                if (body != null)
                {
                    request.Content = JsonContent.Create(body);
                }

                HttpResponseMessage response = await _httpClient.SendAsync(request);
                string jsonContent = await response.Content.ReadAsStringAsync();
                HttpResponse<R>? data = HttpResponse<R>.Parse(jsonContent);

                if (data != null)
                {
                    if (!response.IsSuccessStatusCode)
                    {
                        _errorLogger(data.Error ?? "", []);
                    }
                    return data;
                }
                else
                {
                    _errorLogger("Server Error. No response received", []);
                    return new HttpResponse<R>();
                }
            }
            catch(Exception ex)
            {
                _errorLogger(ex.Message, []);
                return new HttpResponse<R>()
                {
                    Error = ex.Message
                };
            }
        }

        /// <summary>
        /// Sends Post Request to the specified URL with custom headers
        /// </summary>
        /// <typeparam name="R">The object to receive</typeparam>
        /// <typeparam name="T">The object to post</typeparam>
        /// <returns></returns>
        public async Task<HttpResponse<R>> SendPost<T, R>(string url, T? body, Dictionary<string, string> headers)
            where R : class, new()
        {
            try
            {
                HttpRequestMessage request = new HttpRequestMessage(HttpMethod.Post, url);

                foreach (string header in headers.Keys)
                {
                    request.Headers.Add(header, headers[header]);
                }


                if (body != null)
                {
                    request.Content = JsonContent.Create(body);
                }

                HttpResponseMessage response = await _httpClient.SendAsync(request);
                string jsonContent = await response.Content.ReadAsStringAsync();
                HttpResponse<R>? data = HttpResponse<R>.Parse(jsonContent);

                if (data != null)
                {
                    if (!response.IsSuccessStatusCode)
                    {
                        _errorLogger(data.Error ?? "", []);
                    }
                    return data;
                }
                else
                {
                    _errorLogger("Server Error. No response received", []);
                    return new HttpResponse<R>();
                }
            }
            catch (Exception ex)
            {
                _errorLogger(ex.Message, []);
                return new HttpResponse<R> { Error = ex.Message };
            }
        }

        #endregion
    }
}
