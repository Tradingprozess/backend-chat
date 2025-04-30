using Newtonsoft.Json;

namespace ATAS_Indicator
{
    public class ApplicationDataManager<T>
        where T : class, new()
    {
        #region Private Members

        private string _fileName = string.Empty;

        private string _filePath = string.Empty;

        /// <summary>
        /// The method to log errors to
        /// </summary>
        private Action<string, object?[]>? _errorLogger;

        #endregion

        #region Public Members

        /// <summary>
        /// The data instance loaded from the database
        /// </summary>
        public T Data { get; private set; } = new T();

        #endregion

        #region Constructor

        /// <summary>
        /// Default Constructor
        /// </summary>
        public ApplicationDataManager(string fileName, Action<string, object?[]> errorLogger = null)
        {
            _fileName = fileName;
            _filePath = _getFilePath(fileName);
            _loadData(_filePath);
            if (errorLogger != null)
            {
                _errorLogger = errorLogger;
            }
        }

        #endregion

        #region Public Methods

        /// <summary>
        /// Saves the data in the same file
        /// </summary>
        public void SaveData()
        {
            if(!string.IsNullOrEmpty(_filePath) && Data != null)
            {
                try
                {
                    using (StreamWriter writer = new StreamWriter(new FileStream(_filePath, FileMode.Create, FileAccess.Write, FileShare.ReadWrite)))
                    {
                        string json = JsonConvert.SerializeObject(Data);
                        writer.Write(json);
                    }
                }
                catch (Exception ex)
                {
                    _logError(ex.Message);
                }
            }
        }

        #endregion

        #region Private Methods

        /// <summary>
        /// Appends the folder path to the filename and returns the location
        /// </summary>
        /// <param name="fileName"></param>
        /// <returns></returns>
        private string _getFilePath(string fileName)
        {
            string documentsFolderPath = Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments);
            return Path.Combine(documentsFolderPath, "ATAS", "Database", fileName);
        }

        /// <summary>
        /// Loads the data from the file
        /// </summary>
        /// <param name="fileName"></param>
        private void _loadData(string fileName)
        {
            FileInfo info = new FileInfo(fileName);

            if(info.Extension != ".json")
            {
                throw new Exception("Cannot load json data from a non json file");
            }

            if(!info.Exists)
            {
                using(StreamWriter writer = new StreamWriter(new FileStream(fileName, FileMode.Create)))
                {
                    Data = new T();
                    string json = JsonConvert.SerializeObject(Data);
                    writer.Write(json);
                }
            }
            else
            {
                try
                {
                    //Loading the data from the file
                    using (StreamReader reader = new StreamReader(new FileStream(fileName, FileMode.Open, FileAccess.Read)))
                    {
                        string json = reader.ReadToEnd();
                        T? loadedData = JsonConvert.DeserializeObject<T>(json);

                        if (loadedData != null)
                        {
                            Data = loadedData;
                        }
                    }
                }
                catch (Exception ex)
                {
                    _logError(ex.Message);
                }
            }
        }

        /// <summary>
        /// Logs error
        /// </summary>
        /// <param name="error"></param>
        private void _logError(string error)
        {
            if(_errorLogger != null)
            {
                _errorLogger(error, []);
            }
        }

        #endregion
    }
}
