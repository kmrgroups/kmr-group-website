/* ActionTrack - receives push notifications (phone, tablet, desktop) and opens the task when tapped. Scope: /it/ */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("push", (e) => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (x) { d = { title: "ActionTrack", body: e.data ? e.data.text() : "" }; }
  e.waitUntil(self.registration.showNotification(d.title || "ActionTrack", { body: d.body || "", icon: "/it/tasks-icon.svg", badge: "/it/tasks-icon.svg", tag: d.tag || undefined, data: { url: d.url || "/it/tasks.html" } }));
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close(); const url = (e.notification.data && e.notification.data.url) || "/it/tasks.html";
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((cs) => {
    for (const c of cs) { if (c.url.split("#")[0].split("?")[0].endsWith("/it/tasks.html") && "focus" in c) { c.navigate(url); return c.focus(); } }
    return self.clients.openWindow(url);
  }));
});
