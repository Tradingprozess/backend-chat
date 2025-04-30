using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using ATAS_Indicator.Data;

namespace ATAS_Indicator.Models
{
    public class AuthenticateResult
    {
        public List<string> AccountIds { get; set; } = new List<string>();

        public User User { get; set; } = new User();
    }
}
