using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using User = ATAS_Indicator.Data.User;

namespace ATAS_Indicator
{
    public class ApplicationData
    {
        public string Code { get; set; } = string.Empty;

        public User User { get; set; } = new User();

        public List<string> LinkedAccounts { get; set; } = new List<string>();
    }
}
