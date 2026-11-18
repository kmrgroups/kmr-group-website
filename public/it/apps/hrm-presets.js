/* HRM & Payroll - ready-made data: holidays, quick-start rules, the biometric machine catalogue and the bridge program. All of it can be edited or deleted after loading. */
(function (root) {
  "use strict";
  /* Gazetted holidays of the Central Government offices in Delhi (Government of India office memoranda). Dates of Id, Muharram and
     Milad can move by one day with the moon, and States / companies follow their own lists: check the list and edit before using it for pay. */
  const HOLIDAYS = {
    2026: [["01-26", "Republic Day"], ["03-04", "Holi"], ["03-21", "Id-ul-Fitr"], ["03-26", "Ram Navami"], ["03-31", "Mahavir Jayanti"], ["04-03", "Good Friday"], ["05-01", "Buddha Purnima"], ["05-27", "Id-ul-Zuha (Bakrid)"], ["06-26", "Muharram"], ["08-15", "Independence Day"], ["08-26", "Id-e-Milad"], ["09-04", "Janmashtami"], ["10-02", "Mahatma Gandhi's Birthday"], ["10-20", "Dussehra"], ["11-08", "Diwali (Deepavali)"], ["11-24", "Guru Nanak's Birthday"], ["12-25", "Christmas Day"]],
    2027: [["01-26", "Republic Day"], ["03-10", "Id-ul-Fitr"], ["03-23", "Holi"], ["03-26", "Good Friday"], ["04-15", "Ram Navami"], ["04-19", "Mahavir Jayanti"], ["05-17", "Id-ul-Zuha (Bakrid)"], ["05-20", "Buddha Purnima"], ["06-16", "Muharram"], ["08-15", "Independence Day"], ["08-15", "Id-e-Milad"], ["08-25", "Janmashtami"], ["10-02", "Mahatma Gandhi's Birthday"], ["10-09", "Dussehra"], ["10-29", "Diwali (Deepavali)"], ["11-14", "Guru Nanak's Birthday"], ["12-25", "Christmas Day"]],
  };
  const FIXED_EVERY_YEAR = [["01-26", "Republic Day"], ["08-15", "Independence Day"], ["10-02", "Mahatma Gandhi's Birthday"], ["12-25", "Christmas Day"]];
  function holidays(year) {
    const list = HOLIDAYS[year] ? HOLIDAYS[year] : FIXED_EVERY_YEAR, seen = {}, out = [];
    list.forEach(([md, name]) => { const d = year + "-" + md; if (seen[d]) { const o = out.find((x) => x.hdate === d); o.name += " / " + name; } else { seen[d] = 1; out.push({ hdate: d, name }); } });
    return out;
  }
  const holidayYears = () => Object.keys(HOLIDAYS).map(Number);

  const LEAVE_TYPES = [{ code: "CL", name: "Casual leave", paid: true, annual_quota: 12 }, { code: "SL", name: "Sick leave", paid: true, annual_quota: 6 }, { code: "EL", name: "Earned leave", paid: true, annual_quota: 15 }, { code: "LOP", name: "Loss of pay", paid: false, annual_quota: 0 }];
  const SHIFTS = [{ name: "General", start_time: "09:00", end_time: "18:00", grace_min: 10, break_min: 30, half_day_min: 240, full_day_min: 450, weekly_off: [0], night: false, active: true },
    { name: "Day 12 hour", start_time: "08:00", end_time: "20:00", grace_min: 10, break_min: 0, half_day_min: 360, full_day_min: 690, weekly_off: [], night: false, active: true },
    { name: "Night 12 hour", start_time: "20:00", end_time: "08:00", grace_min: 10, break_min: 0, half_day_min: 360, full_day_min: 690, weekly_off: [], night: true, active: true }];

  /* Machines. link: "zk" = speaks the ZKTeco protocol on its LAN port (the bridge program can read it by IP); push: "adms" = can push to a cloud server by itself. */
  const MACHINES = [
    { brand: "ZKTeco", protocol: "adms", link: "zk", port: 4370, models: ["K40", "K50", "F18", "F22", "MB160", "MB360", "MB460", "iClock 360", "iClock 580", "iFace 702", "UA760", "MA300", "SpeedFace-V3L", "SpeedFace-V5L", "ProFace X", "uFace 202", "SenseFace 2A"] },
    { brand: "eSSL", protocol: "adms", link: "zk", port: 4370, models: ["X990", "MB20-VL", "MB160", "MB460", "K90 Pro", "F18", "iFace 302", "uFace 202", "ProFace X", "Ultra-FA", "AiFace Mars", "TFT100"] },
    { brand: "Realtime", protocol: "json", link: "", port: 5005, models: ["RS9w", "RS9", "T502", "T304", "T6", "Other model"] },
    { brand: "BioMax", protocol: "adms", link: "zk", port: 4370, models: ["Other model"] },
    { brand: "Matrix COSEC", protocol: "json", link: "", port: 80, models: ["ARGO FACE", "VEGA FAXQ", "DOOR FOT", "PATH DCFE", "Other model"] },
    { brand: "Mantra", protocol: "json", link: "", port: 80, models: ["Other model"] },
    { brand: "Suprema", protocol: "json", link: "", port: 443, models: ["BioStation 2", "BioStation L2", "BioEntry W2", "FaceStation 2", "X-Station 2", "Other model"] },
    { brand: "Hikvision", protocol: "json", link: "", port: 80, models: ["DS-K1T341AM", "DS-K1T671M", "DS-K1T320MFWX", "DS-K1A802AMF", "Other model"] },
    { brand: "Anviz", protocol: "json", link: "", port: 5010, models: ["C2 Pro", "C2 Slim", "EP300", "W1 Pro", "FacePass 7", "UFace 800", "Other model"] },
    { brand: "Dahua", protocol: "json", link: "", port: 80, models: ["ASI7213Y", "ASI3213", "Other model"] },
    { brand: "Other make", protocol: "file", link: "", port: 0, models: ["Any model (file import)"] },
  ];
  const brandOf = (name) => MACHINES.find((m) => m.brand === name) || null;
  const BRAND_ALIAS = { "eSSL / ZKTeco": "eSSL" };

  /* The bridge program: runs on any PC in the same network as the machine, reads the punches by the machine's IP and sends them here. */
  const PY_COMMON = `def log(msg):
    line = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S ") + str(msg)
    try:
        if os.path.exists(LOGF) and os.path.getsize(LOGF) > 400000:
            keep = open(LOGF, encoding="utf-8", errors="ignore").read().split(NL)[-500:]
            open(LOGF, "w", encoding="utf-8").write(NL.join(keep) + NL)
        with open(LOGF, "a", encoding="utf-8") as f:
            f.write(line + NL)
    except Exception:
        pass
    if sys.stdout:
        print(line)

def need(mod, pkg):
    try:
        __import__(mod)
    except ImportError:
        log("Installing " + pkg + " (first run only)...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "--quiet", pkg], creationflags=0x08000000 if os.name == "nt" else 0)

def load_state():
    try:
        return json.load(open(STATE))
    except Exception:
        return {}

def save_state(**kw):
    st = load_state()
    st.update(kw)
    json.dump(st, open(STATE, "w"))

def cycle():
    try:
        n = run_once()
        STATUS.update(ok=True, text="OK " + datetime.datetime.now().strftime("%d %b %H:%M") + " - " + str(n) + " punch(es) sent")
        log(str(n) + " punch(es) sent")
    except Exception as e:
        STATUS.update(ok=False, text="Problem: " + str(e)[:120] + " - will try again")
        log("Could not read/send: " + str(e) + " - will try again")

def worker(icon=None):
    while True:
        cycle()
        if icon:
            icon_update(icon)
        if "--once" in sys.argv:
            return
        WAKE.wait(EVERY_MIN * 60)
        WAKE.clear()

def autostart_cmd():
    exe = sys.executable
    if exe.lower().endswith("python.exe"):
        exe = exe[:-10] + "pythonw.exe"
    return '"%s" "%s"' % (exe, os.path.abspath(__file__))

def autostart_get():
    if os.name != "nt":
        return False
    try:
        import winreg
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, r"Software\Microsoft\Windows\CurrentVersion\Run") as k:
            return winreg.QueryValueEx(k, NAME)[0] == autostart_cmd()
    except Exception:
        return False

def autostart_set(on):
    if os.name != "nt":
        return
    import winreg
    with winreg.CreateKeyEx(winreg.HKEY_CURRENT_USER, r"Software\Microsoft\Windows\CurrentVersion\Run", 0, winreg.KEY_SET_VALUE) as k:
        if on:
            winreg.SetValueEx(k, NAME, 0, winreg.REG_SZ, autostart_cmd())
        else:
            try:
                winreg.DeleteValue(k, NAME)
            except FileNotFoundError:
                pass
    save_state(autostart=bool(on))

def make_image(ok):
    from PIL import Image, ImageDraw
    img = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.ellipse((3, 3, 61, 61), fill=(22, 163, 74, 255) if ok else (220, 38, 38, 255))
    for a, b in (((22, 17), (22, 47)), ((23, 33), (42, 17)), ((26, 31), (43, 47))):
        d.line([a, b], fill="white", width=6)
    return img

def icon_update(icon):
    try:
        icon.icon = make_image(STATUS["ok"])
        icon.title = (NAME + ": " + STATUS["text"])[:120]
        icon.update_menu()
    except Exception:
        pass

def run_tray():
    import pystray
    def send_now(icon, item):
        WAKE.set()
    def toggle(icon, item):
        autostart_set(not autostart_get())
    def open_log(icon, item):
        try:
            os.startfile(LOGF)
        except Exception:
            pass
    def quit_it(icon, item):
        ok = True
        if os.name == "nt":
            import ctypes
            ok = ctypes.windll.user32.MessageBoxW(0, "Stop the KMR bridge? Punches will not reach the HRM until it is started again.", NAME, 0x24 | 0x40000) == 6
        if ok:
            icon.stop()
    menu = pystray.Menu(
        pystray.MenuItem(lambda item: STATUS["text"], None, enabled=False),
        pystray.MenuItem("Send now", send_now, default=True),
        pystray.MenuItem("Start with Windows", toggle, checked=lambda item: autostart_get()),
        pystray.MenuItem("Open log", open_log),
        pystray.MenuItem("Quit", quit_it))
    icon = pystray.Icon(NAME, make_image(True), NAME + ": starting", menu)
    threading.Thread(target=worker, args=(icon,), daemon=True).start()
    icon.run()

if __name__ == "__main__":
    lock = socket.socket()
    try:
        lock.bind(("127.0.0.1", 47000 + zlib.crc32(LOCKKEY.encode()) % 1000))
    except OSError:
        sys.exit(0)                                   # already running: do nothing
    try:
        for _m, _p in PKGS:
            need(_m, _p)
        if "--once" not in sys.argv and "--console" not in sys.argv:
            need("PIL", "pillow"); need("pystray", "pystray")
    except Exception as e:
        log("Could not install what is needed: " + str(e))
    if "--once" in sys.argv or "--console" in sys.argv:
        worker()
    else:
        if load_state().get("autostart", True) and not autostart_get():
            try:
                autostart_set(True)
            except Exception as e:
                log("Could not set start with Windows: " + str(e))
        try:
            run_tray()
        except Exception as e:
            log("No tray icon (" + str(e) + "); running without it")
            worker()
`;

  /* The same program that runs at Esbee Unit-2: reads the machine by its IP, can also read an eSSL eBioServer database on the PC (o.ebio),
     sends names + punches (unknown IDs become employees in the HRM), tray menu with close password, re-pull from a date, Windows start-up and a watchdog task. */
  const BRIDGE_TPL = `#!/usr/bin/env python3
"""KMR HRM bridge - __MACHINE__.
Reads punches from the machine (__IP__)__DBDOC__
and sends them to KMR HRM & Payroll. Punches the HRM already has are ignored, so re-sending is always safe.
Tray icon (near the clock): green = ok, red = problem. Right-click:
  Send now | Re-pull data from a date... | Start with Windows (password to switch off) |
  Change close password | Open log | Quit (password)
Never stops: a Windows task runs  kmr_bridge.pyw --watchdog  every 5 minutes and starts the bridge if it is not running.
Other: --once (send once and stop)   --console (no tray)   --pull YYYY-MM-DD (re-pull from that date and stop)"""
import sys, time, json, os, datetime, threading, subprocess, socket, zlib, hashlib, secrets, tempfile

IP, PORT, COMM_KEY = "__IP__", __PORT__, __COMMKEY__
URL, KEY = "__URL__", "__KEY__"
EVERY_MIN = __EVERY__
NAME = "__NAME__"
LOCKKEY = IP + str(PORT)
BACKFILL_FROM = "__BACKFILL__"
DB_DEVICES = __DBDEVICES__          # eBioServer DeviceId -> machine (empty = this machine only)
SQLCMD = r"C:\\Program Files\\Microsoft SQL Server\\Client SDK\\ODBC\\170\\Tools\\Binn\\SQLCMD.EXE"
SQL_SERVER, SQL_DB = r"__SQLSERVER__", "__SQLDB__"
PKGS = (("requests", "requests"), ("zk", "pyzk"))
HERE = os.path.dirname(os.path.abspath(__file__))
STATE = os.path.join(HERE, "kmr_bridge_state.json")
LOGF = os.path.join(HERE, "kmr_bridge.log")
FLAG = os.path.join(HERE, "stopped.flag")
VERIFY = {0: "password", 1: "finger", 2: "card", 3: "password", 4: "card", 15: "face", 25: "palm"}
DIRECTION = {0: "in", 1: "out", 4: "in", 5: "out"}
NL = chr(10)
NOWIN = 0x08000000 if os.name == "nt" else 0
STATUS = {"text": "Starting...", "ok": True}
WAKE = threading.Event()
RUN_LOCK = threading.Lock()
PULL = {"since": None}
RUN_KEY = "Software" + chr(92) + "Microsoft" + chr(92) + "Windows" + chr(92) + "CurrentVersion" + chr(92) + "Run"

# ---------------------------------------------------------------- state / log
def log(msg):
    line = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S ") + str(msg)
    try:
        if os.path.exists(LOGF) and os.path.getsize(LOGF) > 400000:
            keep = open(LOGF, encoding="utf-8", errors="ignore").read().split(NL)[-500:]
            open(LOGF, "w", encoding="utf-8").write(NL.join(keep) + NL)
        with open(LOGF, "a", encoding="utf-8") as f:
            f.write(line + NL)
    except Exception:
        pass
    if sys.stdout:
        print(line)

def load_state():
    try:
        return json.load(open(STATE))
    except Exception:
        return {}

def save_state(**kw):
    st = load_state()
    st.update(kw)
    json.dump(st, open(STATE, "w"))

def need(mod, pkg):
    try:
        __import__(mod)
    except ImportError:
        log("Installing " + pkg + " (first run only)...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "--quiet", pkg], creationflags=NOWIN)

# ---------------------------------------------------------------- reading punches
def read_machine(since):
    """punches from the machine itself (MC1). since = 'YYYY-MM-DD HH:MM:SS'"""
    from zk import ZK
    conn = ZK(IP, port=PORT, timeout=15, password=COMM_KEY, force_udp=False, ommit_ping=True).connect()
    try:
        rows = [a for a in conn.get_attendance() if a.timestamp.strftime("%Y-%m-%d %H:%M:%S") >= since]
        try:
            users = [{"bio_id": str(u.user_id), "name": (u.name or "").strip()} for u in conn.get_users() if (u.name or "").strip()]
        except Exception:
            users = []
    finally:
        conn.disconnect()
    pun = [{"bio_id": str(a.user_id), "time": a.timestamp.strftime("%Y-%m-%d %H:%M:%S"), "verify": VERIFY.get(a.status, "other"), "direction": DIRECTION.get(a.punch)} for a in rows]
    return pun, users

def read_db(where):
    """punches from the eBioServer database. returns (punches, max DeviceLogId)"""
    ids = ",".join(str(i) for i in DB_DEVICES)
    q = ("SET NOCOUNT ON; SELECT DeviceLogId, DeviceId, EmployeeCode, CONVERT(varchar(19), LogDate, 120), VerificationType, Direction "
         "FROM DeviceLogs WHERE DeviceId IN (" + ids + ") AND " + where + " ORDER BY DeviceLogId")
    exe = SQLCMD if os.path.exists(SQLCMD) else "sqlcmd"
    r = subprocess.run([exe, "-S", SQL_SERVER, "-E", "-d", SQL_DB, "-h", "-1", "-W", "-s", "|", "-b", "-Q", q],
                       capture_output=True, text=True, creationflags=NOWIN, timeout=300)
    if r.returncode != 0:
        raise RuntimeError("database read failed: " + (r.stdout or r.stderr or "").strip()[:150])
    pun, top = [], 0
    for line in r.stdout.splitlines():
        p = line.strip().split("|")
        if len(p) != 6 or not p[0].isdigit() or not p[2] or p[2].upper() == "NULL":
            continue
        top = max(top, int(p[0]))
        dev = int(p[1])
        try:
            ver = int(p[4])
        except ValueError:
            ver = -1
        d = p[5].upper() if dev == 1 else ""          # MC2 has no real in/out direction
        pun.append({"bio_id": p[2], "time": p[3], "verify": VERIFY.get(ver, "other"), "direction": {"IN": "in", "OUT": "out"}.get(d)})
    return pun, top

def post(payload):
    import requests
    r = requests.post(URL, headers={"x-device-key": KEY, "Content-Type": "application/json"}, data=json.dumps(payload), timeout=60)
    r.raise_for_status()
    try:
        j = r.json()
        return j.get("result", j) if isinstance(j, dict) else {}
    except Exception:
        return {}

def read_db_users():
    """employee code -> name from the eBioServer Employees table"""
    q = "SET NOCOUNT ON; SELECT EmployeeCode, EmployeeName FROM Employees WHERE EmployeeName IS NOT NULL AND LTRIM(RTRIM(EmployeeName)) <> ''"
    exe = SQLCMD if os.path.exists(SQLCMD) else "sqlcmd"
    r = subprocess.run([exe, "-S", SQL_SERVER, "-E", "-d", SQL_DB, "-h", "-1", "-W", "-s", "|", "-b", "-Q", q],
                       capture_output=True, text=True, creationflags=NOWIN, timeout=120)
    if r.returncode != 0:
        raise RuntimeError("employee read failed: " + (r.stdout or r.stderr or "").strip()[:150])
    names = {}
    for line in r.stdout.splitlines():
        p = line.strip().split("|", 1)
        if len(p) == 2 and p[0] and p[0].upper() != "NULL" and p[1].strip():
            names[p[0]] = p[1].strip()
    return names

def sync_names(machine_users):
    """send every employee name (database first, machine names override) so the HRM creates missing employees and fills names"""
    names = {}
    if DB_DEVICES:
        try:
            names.update(read_db_users())
        except Exception as e:
            log("Could not read employee names from the database: " + str(e)[:100])
    for u in machine_users:
        names[u["bio_id"]] = u["name"]
    if not names:
        return {}
    users = [{"bio_id": k, "name": v} for k, v in names.items()]
    info = {"users": len(users), "new": [], "filled": 0}
    for i in range(0, len(users), 500):
        res = post({"users": users[i:i + 500]})
        info["new"] += res.get("new_employees") or []
        info["filled"] += int((res.get("names") or {}).get("names_filled") or 0)
    return info

def send(punches):
    seen, out = set(), []
    for p in punches:
        k = (p["bio_id"], p["time"])
        if k not in seen:
            seen.add(k)
            out.append(p)
    unknown = set()
    for i in range(0, len(out), 2000):
        res = post({"punches": out[i:i + 2000]})
        unknown.update(str(x) for x in (res.get("unknown_ids") or []))
    return len(out), unknown

# ---------------------------------------------------------------- one run
def run_once(since_date=None):
    """normal run (since_date None): machine since last + database since last id. re-pull: everything from since_date."""
    st = load_state()
    punches, errors = [], []
    users, new_last, new_id = [], None, None
    if since_date:
        m_since, where = since_date + " 00:00:00", "LogDate >= '" + since_date + "'"
    else:
        m_since = st.get("last", BACKFILL_FROM + " 00:00:00")
        where = ("DeviceLogId > " + str(int(st["last_id"]))) if "last_id" in st else ("LogDate >= '" + BACKFILL_FROM + "'")
    try:
        mp, users = read_machine(m_since)
        punches += mp
        if mp:
            new_last = max(p["time"] for p in mp)
    except Exception as e:
        errors.append("machine: " + str(e)[:80])
    if DB_DEVICES:
        try:
            dp, top = read_db(where)
            punches += dp
            new_id = top or None
        except Exception as e:
            errors.append("database: " + str(e)[:80])
    if len(errors) >= (2 if DB_DEVICES else 1):
        raise RuntimeError("; ".join(errors))
    try:
        ni = sync_names(users)                          # names + new employees first, so punches always find their employee
        if ni and (ni["new"] or ni["filled"]):
            log("Names synced: " + str(len(ni["new"])) + " new employee(s) created, " + str(ni["filled"]) + " name(s) filled")
    except Exception as e:
        log("Name sync failed (will retry): " + str(e)[:100])
    n, unknown = send(punches)                          # raises if the HRM did not accept: state is then left unchanged
    if unknown:
        log("HRM does not know these employee ids yet: " + ", ".join(sorted(unknown)[:20]))
    upd = {}
    if new_last and (since_date is None or new_last > st.get("last", "")):
        upd["last"] = new_last
    if new_id and (since_date is None or new_id > int(st.get("last_id", 0))):
        upd["last_id"] = new_id
    if upd:
        save_state(**upd)
    return n, errors

def cycle():
    with RUN_LOCK:
        since, PULL["since"] = PULL["since"], None
        try:
            n, errs = run_once(since)
            tag = "re-pull from " + since + ": " if since else ""
            STATUS.update(ok=not errs, text=("OK " if not errs else "Partly OK ") + datetime.datetime.now().strftime("%d %b %H:%M") + " - " + tag + str(n) + " punch(es) sent" + ((" (" + "; ".join(errs) + ")") if errs else ""))
            log(tag + str(n) + " punch(es) sent" + ((" - " + "; ".join(errs)) if errs else ""))
        except Exception as e:
            if since:
                PULL["since"] = since                    # retry the re-pull next time
            STATUS.update(ok=False, text="Problem: " + str(e)[:120] + " - will try again")
            log("Could not read/send: " + str(e) + " - will try again")

def worker(icon=None):
    while True:
        try:
            cycle()
            if icon:
                icon_update(icon)
        except Exception as e:
            log("Unexpected error: " + str(e))
        if "--once" in sys.argv:
            return
        WAKE.wait(EVERY_MIN * 60)
        WAKE.clear()

# ---------------------------------------------------------------- dialogs and password
def dialog_main(kind, outfile, text, initial):
    """runs in its own small process so the tray never freezes: kind = ask | secret | info"""
    import tkinter as tk
    from tkinter import simpledialog, messagebox
    root = tk.Tk()
    root.withdraw()
    root.attributes("-topmost", True)
    res = ""
    if kind == "info":
        messagebox.showinfo(NAME, text, parent=root)
    else:
        res = simpledialog.askstring(NAME, text, initialvalue=initial, show="*" if kind == "secret" else None, parent=root) or ""
    open(outfile, "w", encoding="utf-8").write(res)
    root.destroy()

def ask(kind, text, initial=""):
    fd, tmp = tempfile.mkstemp(suffix=".txt")
    os.close(fd)
    try:
        subprocess.run([sys.executable, os.path.abspath(__file__), "--dialog", kind, tmp, text, initial], timeout=600, creationflags=NOWIN)
        return open(tmp, encoding="utf-8").read()
    except Exception:
        return ""
    finally:
        try:
            os.remove(tmp)
        except Exception:
            pass

def _hash(pw, salt):
    return hashlib.sha256((salt + pw).encode("utf-8")).hexdigest()

def set_password():
    a = ask("secret", "Set a close password for the KMR bridge.")
    if not a:
        return False
    b = ask("secret", "Type the same password again to confirm.")
    if a != b:
        ask("info", "The two passwords did not match. Nothing was changed.")
        return False
    salt = secrets.token_hex(16)
    save_state(pw2_salt=salt, pw2_hash=_hash(a, salt))
    log("Close password set")
    return True

def check_password(why):
    st = load_state()
    if "pw2_hash" not in st:
        return set_password()
    pw = ask("secret", why + " Enter the close password.")
    if pw and secrets.compare_digest(_hash(pw, st["pw2_salt"]), st["pw2_hash"]):
        return True
    if pw:
        ask("info", "Wrong password.")
        log("Wrong close password entered")
    return False

# ---------------------------------------------------------------- start with Windows
def autostart_cmd():
    exe = sys.executable
    if exe.lower().endswith("python.exe"):
        exe = exe[:-10] + "pythonw.exe"
    return '"%s" "%s"' % (exe, os.path.abspath(__file__))

def autostart_get():
    if os.name != "nt":
        return False
    try:
        import winreg
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, RUN_KEY) as k:
            return winreg.QueryValueEx(k, NAME)[0] == autostart_cmd()
    except Exception:
        return False

def autostart_set(on):
    if os.name != "nt":
        return
    import winreg
    with winreg.CreateKeyEx(winreg.HKEY_CURRENT_USER, RUN_KEY, 0, winreg.KEY_SET_VALUE) as k:
        if on:
            winreg.SetValueEx(k, NAME, 0, winreg.REG_SZ, autostart_cmd())
        else:
            try:
                winreg.DeleteValue(k, NAME)
            except FileNotFoundError:
                pass
    save_state(autostart=bool(on))

def ensure_watchdog():
    """a Windows task runs this file with --watchdog every 5 minutes: it starts the bridge again if it is not running"""
    if os.name != "nt" or load_state().get("watchdog") == autostart_cmd():
        return
    try:
        exe = sys.executable
        if exe.lower().endswith("python.exe"):
            exe = exe[:-10] + "pythonw.exe"
        tr = '"%s" "%s" --watchdog' % (exe, os.path.abspath(__file__))
        r = subprocess.run(["schtasks", "/Create", "/F", "/TN", NAME + " watchdog", "/TR", tr, "/SC", "MINUTE", "/MO", "5"],
                           capture_output=True, text=True, creationflags=NOWIN, timeout=60)
        if r.returncode == 0:
            save_state(watchdog=autostart_cmd())
            log("Watchdog task created")
        else:
            log("Could not create the watchdog task: " + (r.stdout or r.stderr or "").strip()[:120])
    except Exception as e:
        log("Could not create the watchdog task: " + str(e)[:100])

# ---------------------------------------------------------------- tray
def make_image(ok):
    from PIL import Image, ImageDraw
    img = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.ellipse((3, 3, 61, 61), fill=(22, 163, 74, 255) if ok else (220, 38, 38, 255))
    for a, b in (((22, 17), (22, 47)), ((23, 33), (42, 17)), ((26, 31), (43, 47))):
        d.line([a, b], fill="white", width=6)
    return img

def icon_update(icon):
    try:
        icon.icon = make_image(STATUS["ok"])
        icon.title = (NAME + ": " + STATUS["text"])[:120]
        icon.update_menu()
    except Exception:
        pass

def run_tray():
    import pystray
    def send_now(icon, item):
        WAKE.set()
    def repull(icon, item):
        default = datetime.date.today().replace(day=1).isoformat()
        v = ask("ask", "Re-pull and re-send all punches from which date? (YYYY-MM-DD)", default).strip()
        if not v:
            return
        try:
            datetime.date.fromisoformat(v)
        except ValueError:
            ask("info", "That is not a valid date. Use YYYY-MM-DD, for example " + default)
            return
        PULL["since"] = v
        log("Re-pull requested from " + v)
        STATUS.update(ok=True, text="Re-pulling from " + v + "...")
        icon_update(icon)
        WAKE.set()
    def toggle(icon, item):
        if autostart_get():
            if check_password("Switching off Start with Windows."):
                autostart_set(False)
        else:
            autostart_set(True)
    def change_pw(icon, item):
        if "pw2_hash" in load_state() and not check_password("Changing the password."):
            return
        set_password()
    def open_log(icon, item):
        try:
            os.startfile(LOGF)
        except Exception:
            pass
    def show_location(icon, item):
        try:
            subprocess.Popen(["explorer.exe", "/select," + os.path.abspath(__file__)])
        except Exception:
            pass
    def quit_it(icon, item):
        if check_password("Stopping the KMR bridge means punches will not reach the HRM."):
            open(FLAG, "w").write(datetime.datetime.now().isoformat())
            log("Bridge stopped from the tray menu with the close password")
            icon.stop()
    menu = pystray.Menu(
        pystray.MenuItem(lambda item: STATUS["text"], None, enabled=False),
        pystray.MenuItem("Send now", send_now, default=True),
        pystray.MenuItem("Re-pull data from a date...", repull),
        pystray.MenuItem("Start with Windows", toggle, checked=lambda item: autostart_get()),
        pystray.MenuItem("Change close password", change_pw),
        pystray.MenuItem("Open log", open_log),
        pystray.MenuItem("Show bridge file location", show_location),
        pystray.MenuItem("Quit", quit_it))
    icon = pystray.Icon(NAME, make_image(True), NAME + ": starting", menu)
    threading.Thread(target=worker, args=(icon,), daemon=True).start()
    if "pw2_hash" not in load_state():
        threading.Thread(target=set_password, daemon=True).start()   # first run: ask for the close password
    icon.run()

# ---------------------------------------------------------------- entry
def lock_port():
    return 47000 + zlib.crc32(LOCKKEY.encode()) % 1000

if __name__ == "__main__":
    if "--dialog" in sys.argv:
        i = sys.argv.index("--dialog")
        dialog_main(sys.argv[i + 1], sys.argv[i + 2], sys.argv[i + 3], sys.argv[i + 4] if len(sys.argv) > 4 + i else "")
        sys.exit(0)
    if "--watchdog" in sys.argv:
        if os.path.exists(FLAG):
            sys.exit(0)                                   # stopped on purpose with the password
        s = socket.socket()
        try:
            s.bind(("127.0.0.1", lock_port()))
            s.close()
        except OSError:
            sys.exit(0)                                   # running: nothing to do
        exe = sys.executable
        if exe.lower().endswith("python.exe"):
            exe = exe[:-10] + "pythonw.exe"
        subprocess.Popen([exe, os.path.abspath(__file__)], creationflags=NOWIN | 0x00000008 | 0x00000200, close_fds=True, cwd=HERE)
        sys.exit(0)
    lock = socket.socket()
    try:
        lock.bind(("127.0.0.1", lock_port()))
    except OSError:
        sys.exit(0)                                       # already running: do nothing
    try:
        os.remove(FLAG)
    except OSError:
        pass
    try:
        for _m, _p in PKGS:
            need(_m, _p)
        if "--once" not in sys.argv and "--console" not in sys.argv and "--pull" not in sys.argv:
            need("PIL", "pillow"); need("pystray", "pystray")
    except Exception as e:
        log("Could not install what is needed: " + str(e))
    if "--pull" in sys.argv:
        PULL["since"] = sys.argv[sys.argv.index("--pull") + 1]
        sys.argv.append("--once")
        worker()
    elif "--once" in sys.argv or "--console" in sys.argv:
        worker()
    else:
        if load_state().get("autostart", True) and not autostart_get():
            try:
                autostart_set(True)
            except Exception as e:
                log("Could not set start with Windows: " + str(e))
        ensure_watchdog()
        try:
            run_tray()
        except Exception as e:
            log("No tray icon (" + str(e) + "); running without it")
            worker()
`;
  function bridgeScript(o) {
    const py = (s) => String(s == null ? "" : s).replace(/[\\"\r\n]/g, "");
    const eb = o.ebio && o.ebio.devices && Object.keys(o.ebio.devices).length ? o.ebio : null;
    const now = new Date(), backfill = o.backfill || (now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0") + "-01");
    const dbdev = eb ? "{" + Object.keys(eb.devices).map((k) => (parseInt(k, 10) || 0) + ': "' + py(eb.devices[k]) + '"').join(", ") + "}" : "{}";
    const name = String(o.name || o.ip || "machine").replace(/[^A-Za-z0-9 ._-]/g, "").trim() || "machine";
    const map = {
      "__MACHINE__": py(o.name || "machine"), "__IP__": py(o.ip || "192.168.1.201"), "__PORT__": String(parseInt(o.port, 10) || 4370), "__COMMKEY__": String(parseInt(o.commkey, 10) || 0),
      "__URL__": py(o.url), "__KEY__": py(o.key || "PASTE-THE-KEY-FROM-THE-MACHINE-SCREEN"), "__EVERY__": String(parseInt(o.every, 10) || 5), "__NAME__": "KMR bridge " + name,
      "__BACKFILL__": py(backfill), "__DBDEVICES__": dbdev, "__SQLSERVER__": String(eb && eb.server || ".\\SQLEXPRESS").replace(/["\r\n]/g, ""), "__SQLDB__": py(eb && eb.db || "eBioServerNew"),
      "__DBDOC__": eb ? " AND from the eBioServer database on this PC,\n" : ",\n",
    };
    return BRIDGE_TPL.replace(/__[A-Z]+__/g, (t) => (t in map ? map[t] : t));
  }

  /* Realtime machines (RS9w ...) used with Realtime's "Attendance Tracker" program on a PC: that program can copy every punch into a MySQL or SQL Server table
     ("Data Converter > Realtime Data Integration"). This bridge reads that table and sends the punches here. The machine and Realtime's own program are not touched. */
  function realtimeBridgeScript(o) {
    return `#!/usr/bin/env python3
"""KMR HRM bridge for Realtime machines (Attendance Tracker program).
Double-click this file (kmr_realtime_bridge.pyw) on the PC that has Realtime Attendance Tracker: no window opens, a small KMR icon appears near the clock (green = sending, red = problem), it starts with Windows by itself and catches up on every missed day.
Reads the punches that Realtime Attendance Tracker copies into a database table ("Data Converter > Realtime Data Integration")
and sends them to KMR HRM & Payroll. Nothing is changed in the machine or in Realtime's program: it only READS the table.
Setup (once):   pip install requests pymysql          (MySQL)      or      pip install requests pyodbc       (SQL Server)
Run:            python kmr_realtime_bridge.py           (leave it running; checks every ${o.every || 2} minutes)
                python kmr_realtime_bridge.py --once    (read once and stop)
Safe to run again at any time: punches already received are ignored here, and the last 2 days are re-sent on purpose so nothing is missed."""
import sys, time, json, os, datetime, threading, subprocess, socket, zlib

DB_KIND = "${o.db || "mysql"}"                  # "mysql" or "sqlserver"
DB_HOST, DB_PORT = "${o.host || "localhost"}", ${o.dbport || 3306}
DB_NAME, DB_USER, DB_PASS = "${o.dbname || "attendance"}", "${o.dbuser || "kmr_reader"}", "KmrRead2026"
TABLE = "AttendanceLogs"                          # same table name as on the Realtime screen
URL, KEY = "${o.url}", "${o.key || "PASTE-THE-KEY-FROM-THE-HRM-MACHINE-SCREEN"}"
EVERY_MIN = ${o.every || 2}
HERE = os.path.dirname(os.path.abspath(__file__))
STATE = os.path.join(HERE, "kmr_realtime_state.json")
LOGF = os.path.join(HERE, "kmr_realtime_bridge.log")
NAME = "KMR bridge ${String(o.name || "Realtime").replace(/[^A-Za-z0-9 ._-]/g, "")}".strip()
LOCKKEY = DB_HOST + DB_NAME + "rt"
PKGS = (("requests", "requests"), ("pymysql", "pymysql")) if DB_KIND != "sqlserver" else (("requests", "requests"), ("pyodbc", "pyodbc"))
NL = chr(10)
STATUS = {"text": "Starting...", "ok": True}
WAKE = threading.Event()

IN_WORDS, OUT_WORDS = ("in", "i", "0", "check in"), ("out", "o", "1", "check out")

def connect():
    if DB_KIND == "sqlserver":
        import pyodbc
        return pyodbc.connect("DRIVER={ODBC Driver 17 for SQL Server};SERVER=%s,%s;DATABASE=%s;UID=%s;PWD=%s" % (DB_HOST, DB_PORT or 1433, DB_NAME, DB_USER, DB_PASS))
    import pymysql
    last = None
    for port in (DB_PORT, 3307, 3306):             # the database may have been installed on 3306 or 3307
        try:
            return pymysql.connect(host=DB_HOST, port=port, user=DB_USER, password=DB_PASS, database=DB_NAME, connect_timeout=15)
        except Exception as e:
            last = e
    raise last

def last_sent():
    try:
        return datetime.datetime.strptime(load_state()["last"], "%Y-%m-%d %H:%M:%S")
    except Exception:
        return datetime.datetime(1970, 1, 1)

def to_dt(v):
    return v if isinstance(v, datetime.datetime) else datetime.datetime.strptime(str(v)[:19], "%Y-%m-%d %H:%M:%S")

def run_once():
    since = last_sent() - datetime.timedelta(days=2)
    con = connect()
    try:
        cur = con.cursor()
        ph = "?" if DB_KIND == "sqlserver" else "%s"
        cur.execute("SELECT EmployeeCode, LogDateTime, Direction FROM " + TABLE + " WHERE LogDateTime >= " + ph + " ORDER BY LogDateTime", (since,))
        rows = cur.fetchall()
    finally:
        con.close()
    import requests
    punches = []
    for code, at, direction in rows:
        if str(code).strip().lstrip("0") == "":
            continue                              # the empty starter row, not a person
        d = str(direction or "").strip().lower()
        punches.append({"bio_id": str(code).strip().lstrip("0") or "0", "time": to_dt(at).strftime("%Y-%m-%d %H:%M:%S"), "verify": "finger", "direction": "in" if d in IN_WORDS else "out" if d in OUT_WORDS else None})
    for i in range(0, len(punches), 2000):
        r = requests.post(URL, headers={"x-device-key": KEY, "Content-Type": "application/json"}, data=json.dumps({"punches": punches[i:i + 2000]}), timeout=60)
        r.raise_for_status()
    if punches:
        save_state(last=max(p["time"] for p in punches))
    return len(punches)

`+PY_COMMON;
  }

  const api = { HOLIDAYS, holidays, holidayYears, LEAVE_TYPES, SHIFTS, MACHINES, brandOf, BRAND_ALIAS, bridgeScript, realtimeBridgeScript };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.HRMPresets = api;
})(typeof window !== "undefined" ? window : globalThis);
