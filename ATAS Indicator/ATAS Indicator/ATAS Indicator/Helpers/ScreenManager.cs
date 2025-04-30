using System.Diagnostics;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

namespace ATAS_Indicator.Helpers
{
    public static class ScreenManager
    {

        #region DLL Imports

        [DllImport("user32.dll")]
        public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

        #endregion

        #region DS

        public struct RECT
        {
            public int Left;
            public int Top;
            public int Right;
            public int Bottom;
        }

        #endregion

        #region Public Methods

        /// <summary>
        /// Captures the screen shot of the given area
        /// </summary>
        /// <param name="chartArea">The area to capture</param>
        /// <returns></returns>
        public static byte[] CaptureScreenShot(Rectangle chartArea)
        {
            try
            {
                using(Bitmap bitmap = new Bitmap(chartArea.Width, chartArea.Height))
                {
                    using (Graphics g = Graphics.FromImage(bitmap))
                    {
                        g.CopyFromScreen(chartArea.Location, Point.Empty, chartArea.Size);
                    }

                    using (MemoryStream ms = new MemoryStream())
                    {
                        bitmap.Save(ms, ImageFormat.Png);
                        return ms.ToArray();
                    }
                }
            }
            catch
            {
                return new byte[0];
            }
        }

        /// <summary>
        /// Gets the scrren with the ATAS indicator on it
        /// </summary>
        /// <param name="windowTitle"></param>
        /// <returns></returns>
        public static Screen GetScreenWithATAS()
        {
            string processName = "OFT.Platform";

            Process[] processes = Process.GetProcessesByName(processName);

            // If the process is found
            if(processes.Length > 0) {
                IntPtr windowHandle = processes[0].MainWindowHandle;

                if (windowHandle != IntPtr.Zero)
                {
                    List<double> intersectionAreas = new List<double>();

                    // Get the window's bounding rectangle
                    if (GetWindowRect(windowHandle, out RECT rect))
                    {
                        Rectangle windowRect = new Rectangle(rect.Left, rect.Top, rect.Right - rect.Left, rect.Bottom - rect.Top);

                        // Find the screen that contains this rectangle
                        foreach (Screen screen in Screen.AllScreens)
                        {
                            intersectionAreas.Add(CalculateIntersectionArea(screen.Bounds, windowRect));
                        }

                        double maxIntersectionArea = intersectionAreas.Max();
                        int index = intersectionAreas.IndexOf(maxIntersectionArea);
                        return Screen.AllScreens[index];
                    }
                }

            }

            

            Console.WriteLine("No screen contains the ATAS window.");
            return null;
        }

        #endregion

        #region Private Members

        /// <summary>
        /// Calculates the intersection area
        /// </summary>
        /// <param name="rect1"></param>
        /// <param name="rect2"></param>
        /// <returns></returns>
        private static int CalculateIntersectionArea(Rectangle rect1, Rectangle rect2)
        {
            // Calculate overlap width
            int overlapWidth = Math.Max(0, Math.Min(rect1.Right, rect2.Right) - Math.Max(rect1.X, rect2.X));

            // Calculate overlap height
            int overlapHeight = Math.Max(0, Math.Min(rect1.Bottom, rect2.Bottom) - Math.Max(rect1.Y, rect2.Y));

            // Intersection area
            return overlapWidth * overlapHeight;
        }

        #endregion
    }
}
