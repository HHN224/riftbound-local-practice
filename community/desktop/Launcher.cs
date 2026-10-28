using System;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Net;
using System.Reflection;
using System.Threading;
using System.Windows.Forms;

internal static class Launcher {
    private const string Build = "PAYLOAD_ID";
    [STAThread] private static int Main(string[] args) {
        try {
            bool noBrowser = Array.IndexOf(args, "--no-browser") >= 0;
            bool extractOnly = Array.IndexOf(args, "--extract-only") >= 0;
            string data = Environment.GetEnvironmentVariable("FUXUAN_DESKTOP_HOME");
            if (String.IsNullOrEmpty(data)) data = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "RiftboundLocalPractice");
            string folder = Path.Combine(data, "releases", Build);
            Directory.CreateDirectory(Path.GetDirectoryName(folder));
            using (var mutex = new Mutex(false, "Local\\FuxuanExtract-" + Build)) {
                bool locked = false;
                try {
                    try { locked = mutex.WaitOne(60000); } catch (AbandonedMutexException) { locked = true; }
                    if (!locked) throw new Exception("另一实例正在释放文件，请稍后重试。");
                    if (!File.Exists(Path.Combine(folder, ".complete"))) {
                        string staging = folder;
                        // The per-build mutex and completion marker make an interrupted
                        // extraction resumable. Avoid renaming thousands of files while
                        // Windows scanners may still hold handles to the directory.
                        Directory.CreateDirectory(staging);
                        using (Stream resource = Assembly.GetExecutingAssembly().GetManifestResourceStream("payload.zip"))
                        using (var zip = new ZipArchive(resource, ZipArchiveMode.Read)) {
                            string prefix = Path.GetFullPath(staging) + Path.DirectorySeparatorChar;
                            foreach (ZipArchiveEntry entry in zip.Entries) {
                                string target = Path.GetFullPath(Path.Combine(staging, entry.FullName));
                                if (!target.StartsWith(prefix, StringComparison.OrdinalIgnoreCase)) throw new Exception("Invalid archive path.");
                                Directory.CreateDirectory(Path.GetDirectoryName(target));
                                using (var input = entry.Open()) using (var output = File.Create(target)) input.CopyTo(output);
                            }
                        }
                        File.WriteAllText(Path.Combine(staging, ".complete"), Build);
                    }
                } finally { if (locked) mutex.ReleaseMutex(); }
            }
            if (extractOnly) return 0;
            string port = Environment.GetEnvironmentVariable("FUXUAN_PORT") ?? "4174";
            int number;
            if (!Int32.TryParse(port, out number) || number < 1024 || number > 65535) throw new Exception("FUXUAN_PORT must be between 1024 and 65535.");
            string url = "http://127.0.0.1:" + port;
            if (!Healthy(url)) {
                var start = new ProcessStartInfo(Path.Combine(folder,"node.exe"), "\"" + Path.Combine(folder,"community","scripts","server.mjs") + "\"");
                start.WorkingDirectory = folder;
                start.UseShellExecute = false;
                start.CreateNoWindow = true;
                Process server = Process.Start(start);
                bool ready = false;
                for (int i = 0; i < 80; i++) {
                    if (Healthy(url)) { ready = true; break; }
                    if (server.HasExited) throw new Exception("本地服务未能启动，端口可能被其它程序占用。");
                    Thread.Sleep(250);
                }
                if (!ready) { if (!server.HasExited) server.Kill(); throw new Exception("本地服务启动超时。"); }
            }
            if (!noBrowser) Process.Start(new ProcessStartInfo(url + "/fuxuan/") { UseShellExecute = true });
            return 0;
        } catch (Exception error) {
            if (Array.IndexOf(args, "--no-browser") < 0 && Array.IndexOf(args, "--extract-only") < 0)
                MessageBox.Show(error.Message, "符玄战场 · 启动失败", MessageBoxButtons.OK, MessageBoxIcon.Error);
            string log = Path.Combine(Path.GetTempPath(), "fuxuan-launcher-error.log");
            File.WriteAllText(log,error.ToString());
            return 1;
        }
    }
    private static bool Healthy(string url) {
        try {
            var request = (HttpWebRequest)WebRequest.Create(url + "/local-api/status");
            request.Timeout = 500;
            request.Proxy = null;
            using (var response = request.GetResponse())
            using (var reader = new StreamReader(response.GetResponseStream()))
                return reader.ReadToEnd().Contains("Fuxuan APK local Hermes engine");
        } catch { return false; }
    }
}
