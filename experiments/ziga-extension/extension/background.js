(() => {
  // src/preferences.js
  var defaults = Object.freeze({ time: "auto", book: "5", depth: "0", threads: "2", ponder: true, autoDrawReply: false, autoDrawOffer: false, maxHearts: "1", autoAds: false, maxAds: "3", minimized: false });
  var preferenceKeys = Object.keys(defaults);
  function validPreferences(raw) {
    const out = {};
    if (!raw || typeof raw !== "object" || Array.isArray(raw))
      return out;
    for (const key of preferenceKeys) {
      const v = raw[key];
      if (typeof defaults[key] === "boolean") {
        if (typeof v === "boolean")
          out[key] = v;
        continue;
      }
      const s = typeof v === "string" ? v : typeof v === "number" && Number.isInteger(v) ? String(v) : null;
      if (s === null)
        continue;
      if (key === "time") {
        if (["auto", "650", "1200", "2500", "5000", "10000"].includes(s))
          out[key] = s;
        continue;
      }
      if (key === "book") {
        if (["0", "3", "4", "5"].includes(s))
          out[key] = s;
        continue;
      }
      const [min, max] = { depth: [0, 64], threads: [1, 16], maxHearts: [1, 1e4], maxAds: [1, 10] }[key];
      if (/^(0|[1-9]\d*)$/.test(s) && Number(s) >= min && Number(s) <= max)
        out[key] = s;
    }
    return out;
  }

  // src/bridge-status.js
  function checkBridgeVersion(health) {
    const version = typeof health?.version === "string" ? health.version.split(".").map(Number) : [];
    if (!health?.ok || version.length < 2 || !version.every(Number.isFinite) || version[0] === 0 && version[1] < 6)
      throw Error("Bridge \u0111ang ch\u1EA1y b\u1EA3n c\u0169, ch\u01B0a h\u1ED7 tr\u1EE3 10 gi\xE2y/ponder. H\xE3y \u0111\xF3ng bridge c\u0169 r\u1ED3i ch\u1EA1y start-bridge.cmd trong th\u01B0 m\u1EE5c extension m\u1EDBi.");
    return true;
  }
  function bridgeErrorMessage(error) {
    if (error?.name === "AbortError")
      return "\u0110\xE3 h\u1EE7y ho\u1EB7c engine qu\xE1 th\u1EDDi gian.";
    const message = String(error?.message || error);
    if (/Invalid movetime.*5000/.test(message))
      return "Bridge \u0111ang ch\u1EA1y b\u1EA3n c\u0169 (ch\u1EC9 h\u1ED7 tr\u1EE3 5 gi\xE2y). H\xE3y ch\u1EA1y start-bridge.cmd b\u1EA3n m\u1EDBi, sau \u0111\xF3 Reload extension v\xE0 t\u1EA3i l\u1EA1i Ziga.";
    if (/Failed to fetch|fetch failed|ECONNREFUSED/i.test(message))
      return "Ch\u01B0a k\u1EBFt n\u1ED1i \u0111\u01B0\u1EE3c bridge \u1EDF c\u1ED5ng 17864. H\xE3y ch\u1EA1y start-bridge.cmd.";
    return message;
  }

  // src/background.js
  var jobs = /* @__PURE__ */ new Map();
  var bridgeUrl = "http://127.0.0.1:17864";
  var lastHealthAt = 0;
  chrome.runtime.onMessage.addListener((msg, sender, reply) => {
    if (!/^https:\/\/(www\.)?zigavn\.com\//.test(sender.url || "") || typeof msg?.id !== "string")
      return;
    const key = sender.tab.id + ":" + sender.frameId + ":" + msg.id;
    if (msg.kind === "settings-get") {
      chrome.storage.local.get(preferenceKeys.map((k) => "menu." + k)).then((data) => {
        const values = {};
        for (const k of preferenceKeys)
          if ("menu." + k in data)
            values[k] = data["menu." + k];
        reply({ settings: validPreferences(values) });
      }).catch((e) => reply({ error: e.message }));
      return true;
    }
    if (msg.kind === "settings-set") {
      const patch = validPreferences(msg.settings), data = {};
      for (const [k, v] of Object.entries(patch))
        data["menu." + k] = v;
      chrome.storage.local.set(data).then(() => reply({ ok: true })).catch((e) => reply({ error: e.message }));
      return true;
    }
    if (msg.kind === "cancel") {
      jobs.get(key)?.abort();
      reply({ ok: true });
      return;
    }
    if (!["analyze", "ponder", "stop"].includes(msg.kind))
      return;
    if (msg.kind !== "stop" && (typeof msg.fen !== "string" || msg.fen.length > 200 || !Number.isInteger(msg.movetime) || msg.movetime < 100 || msg.movetime > 1e4)) {
      reply({ error: "Invalid request" });
      return;
    }
    const controller = new AbortController();
    jobs.set(key, controller);
    const timer = setTimeout(() => controller.abort(), 2e4);
    Promise.resolve().then(async () => {
      if (msg.kind !== "stop" && Date.now() - lastHealthAt > 5e3) {
        const response = await fetch(bridgeUrl + "/health", { signal: controller.signal });
        checkBridgeVersion(await response.json());
        lastHealthAt = Date.now();
      }
      return fetch(bridgeUrl + "/" + msg.kind, { method: "POST", headers: { "Content-Type": "application/json", "X-Ziga-Client": msg.clientId || "legacy" }, body: JSON.stringify({ fen: msg.fen, movetime: msg.movetime, reverse: msg.reverse, bookMoves: msg.bookMoves, ply: msg.ply, threads: msg.threads, depth: msg.depth, clientId: msg.clientId, gameId: msg.gameId, usePonder: msg.usePonder }), signal: controller.signal });
    }).then(async (r) => {
      const data = await r.json();
      if (!r.ok)
        throw Error(data.error || "Bridge error");
      return data;
    }).then(reply).catch((e) => reply({ error: bridgeErrorMessage(e) })).finally(() => {
      clearTimeout(timer);
      jobs.delete(key);
    });
    return true;
  });
})();
