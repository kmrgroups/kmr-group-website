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
  function bridgeScript(o) {
    return `#!/usr/bin/env python3
"""KMR HRM bridge - reads the attendance punches from a biometric machine by its IP address and sends them to KMR HRM & Payroll.
Machine: ${o.name || "(machine)"} (${o.ip})
Works with machines that speak the ZKTeco protocol (ZKTeco, eSSL, Realtime and most look-alikes) on their network port (usually 4370).
Setup (once):   pip install pyzk requests
Run:            python kmr_bridge.py            (leave it running; it checks every ${o.every || 5} minutes)
                python kmr_bridge.py --once     (read once and stop; good for a scheduled task)
Nothing is lost when the PC or the internet is off: every run sends the punches again from the last one confirmed, and punches that were already received are ignored."""
import sys, time, json, os, datetime
import requests
from zk import ZK

IP, PORT, COMM_KEY = "${o.ip || "192.168.1.201"}", ${o.port || 4370}, ${o.commkey || 0}
URL, KEY = "${o.url}", "${o.key || "PASTE-THE-KEY-FROM-THE-MACHINE-SCREEN"}"
EVERY_MIN = ${o.every || 5}
STATE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "kmr_bridge_state.json")
VERIFY = {0: "password", 1: "finger", 2: "card", 3: "password", 4: "card", 15: "face", 25: "palm"}
DIRECTION = {0: "in", 1: "out", 4: "in", 5: "out"}

def last_sent():
    try:
        return json.load(open(STATE))["last"]
    except Exception:
        return "1970-01-01 00:00:00"

def run_once():
    since = last_sent()
    conn = ZK(IP, port=PORT, timeout=15, password=COMM_KEY, force_udp=False, ommit_ping=True).connect()
    try:
        rows = [a for a in conn.get_attendance() if a.timestamp.strftime("%Y-%m-%d %H:%M:%S") >= since]
    finally:
        conn.disconnect()
    punches = [{"bio_id": str(a.user_id), "time": a.timestamp.strftime("%Y-%m-%d %H:%M:%S"), "verify": VERIFY.get(a.status, "other"), "direction": DIRECTION.get(a.punch)} for a in rows]
    for i in range(0, len(punches), 2000):
        r = requests.post(URL, headers={"x-device-key": KEY, "Content-Type": "application/json"}, data=json.dumps({"punches": punches[i:i + 2000]}), timeout=60)
        r.raise_for_status()
    if punches:
        json.dump({"last": max(p["time"] for p in punches)}, open(STATE, "w"))
    print(datetime.datetime.now().strftime("%H:%M:%S"), len(punches), "punch(es) sent")

if __name__ == "__main__":
    while True:
        try:
            run_once()
        except Exception as e:
            print("Could not read/send:", e, "- will try again")
        if "--once" in sys.argv:
            break
        time.sleep(EVERY_MIN * 60)
`;
  }

  /* Realtime machines (RS9w ...) used with Realtime's "Attendance Tracker" program on a PC: that program can copy every punch into a MySQL or SQL Server table
     ("Data Converter > Realtime Data Integration"). This bridge reads that table and sends the punches here. The machine and Realtime's own program are not touched. */
  function realtimeBridgeScript(o) {
    return `#!/usr/bin/env python3
"""KMR HRM bridge for Realtime machines (Attendance Tracker program).
Reads the punches that Realtime Attendance Tracker copies into a database table ("Data Converter > Realtime Data Integration")
and sends them to KMR HRM & Payroll. Nothing is changed in the machine or in Realtime's program: it only READS the table.
Setup (once):   pip install requests pymysql          (MySQL)      or      pip install requests pyodbc       (SQL Server)
Run:            python kmr_realtime_bridge.py           (leave it running; checks every ${o.every || 2} minutes)
                python kmr_realtime_bridge.py --once    (read once and stop)
Safe to run again at any time: punches already received are ignored here, and the last 2 days are re-sent on purpose so nothing is missed."""
import sys, time, json, os, datetime
import requests

DB_KIND = "${o.db || "mysql"}"                  # "mysql" or "sqlserver"
DB_HOST, DB_PORT = "${o.host || "localhost"}", ${o.dbport || 3306}
DB_NAME, DB_USER, DB_PASS = "${o.dbname || "attendance"}", "${o.dbuser || "kmr_reader"}", "PASTE-THE-DATABASE-PASSWORD"
TABLE = "AttendanceLogs"                          # same table name as on the Realtime screen
URL, KEY = "${o.url}", "${o.key || "PASTE-THE-KEY-FROM-THE-HRM-MACHINE-SCREEN"}"
EVERY_MIN = ${o.every || 2}
STATE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "kmr_realtime_state.json")
IN_WORDS, OUT_WORDS = ("in", "i", "0", "check in"), ("out", "o", "1", "check out")

def connect():
    if DB_KIND == "sqlserver":
        import pyodbc
        return pyodbc.connect("DRIVER={ODBC Driver 17 for SQL Server};SERVER=%s,%s;DATABASE=%s;UID=%s;PWD=%s" % (DB_HOST, DB_PORT or 1433, DB_NAME, DB_USER, DB_PASS))
    import pymysql
    return pymysql.connect(host=DB_HOST, port=DB_PORT, user=DB_USER, password=DB_PASS, database=DB_NAME, connect_timeout=15)

def last_sent():
    try:
        return datetime.datetime.strptime(json.load(open(STATE))["last"], "%Y-%m-%d %H:%M:%S")
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
        json.dump({"last": max(p["time"] for p in punches)}, open(STATE, "w"))
    print(datetime.datetime.now().strftime("%H:%M:%S"), len(punches), "punch(es) sent")

if __name__ == "__main__":
    while True:
        try:
            run_once()
        except Exception as e:
            print("Could not read/send:", e, "- will try again")
        if "--once" in sys.argv:
            break
        time.sleep(EVERY_MIN * 60)
`;
  }

  const api = { HOLIDAYS, holidays, holidayYears, LEAVE_TYPES, SHIFTS, MACHINES, brandOf, BRAND_ALIAS, bridgeScript, realtimeBridgeScript };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.HRMPresets = api;
})(typeof window !== "undefined" ? window : globalThis);
