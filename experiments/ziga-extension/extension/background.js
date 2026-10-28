(() => {
  // settings.json
  var settings_default = {
    session: {
      idleTableMs: 8e3,
      readyMinMs: 1e3,
      readyMaxMs: 1500,
      actionConfirmMs: 2e4,
      transitionMs: 2500,
      tableSyncMs: 2e4,
      finishedLeaveMs: 4e3,
      rewardResumeMs: 2e3,
      rewardPopupWindowMs: 3e4
    },
    move: {
      minDelayMs: 500,
      quickMaxMs: 1e3,
      bookMinMs: 120,
      bookMaxMs: 1400,
      maxDelayMs: 5e3,
      confirmMs: 8e3,
      stableMs: 500,
      ponderStableMs: 200,
      pollMs: 250,
      smallSearchMs: 650,
      mediumSearchMs: 2500,
      complexSearchMs: 1e4
    },
    draw: {
      maxOffers: 2,
      minOwnTurnsBetweenOffers: 1,
      offerCooldownMs: 6e4,
      replySearchMs: 1200,
      acceptWaitMs: 5e3
    },
    ads: {
      timeoutMs: 12e4,
      loadTimeoutMs: 1e4,
      clearMs: 3e3,
      exposedRecoveryMs: 1e4
    },
    engine: {
      ponderRequestIntervalMs: 5e3,
      ponderBurstMs: 2e3,
      ponderRestMs: 3e3,
      ponderSeedMs: 300,
      stopTimeoutMs: 4e3,
      handshakeMs: 15e3,
      searchGraceMs: 8e3,
      httpTimeoutMs: 2e4,
      clientTimeoutMs: 22e3,
      healthCacheMs: 5e3,
      legacyTimeoutMs: 15e3,
      stableSearchMinMs: 250,
      stableSearchMaxMs: 600
    },
    cpu: {
      sampleMs: 2e3,
      highForMs: 1e4,
      reduceIntervalMs: 1e4,
      ponderPauseMs: 15e3,
      lowForMs: 15e3,
      recoverIntervalMs: 1e4,
      limitedSearchMs: 2e3
    },
    fallbackDelay: {
      quickSearchThresholdMs: 600,
      quickMaxMs: 250,
      advantageMinMs: 150,
      advantageMaxMs: 900,
      complexMinMs: 2200,
      baseMinMs: 350,
      baseMs: 900,
      perChoiceMs: 20,
      perDepthMs: 45,
      maxMs: 4e3
    }
  };

  // settings.mjs
  if (settings_default.ads)
    settings_default.ads = { framePollMs: 500, frameLeaseMs: 2e3, googleCloseProbeAfterMs: 15e3, googleCloseRetryMs: 1e4, googleCloseMaxProbes: 8, ...settings_default.ads };
  var required = { "session": ["idleTableMs", "readyMinMs", "readyMaxMs", "actionConfirmMs", "transitionMs", "tableSyncMs", "finishedLeaveMs", "rewardResumeMs", "rewardPopupWindowMs"], "move": ["minDelayMs", "quickMaxMs", "bookMinMs", "bookMaxMs", "maxDelayMs", "confirmMs", "stableMs", "ponderStableMs", "pollMs", "smallSearchMs", "mediumSearchMs", "complexSearchMs"], "draw": ["maxOffers", "minOwnTurnsBetweenOffers", "offerCooldownMs", "replySearchMs", "acceptWaitMs"], "ads": ["timeoutMs", "loadTimeoutMs", "clearMs", "exposedRecoveryMs", "framePollMs", "frameLeaseMs", "googleCloseProbeAfterMs", "googleCloseRetryMs", "googleCloseMaxProbes"], "engine": ["ponderRequestIntervalMs", "ponderBurstMs", "ponderRestMs", "ponderSeedMs", "stopTimeoutMs", "handshakeMs", "searchGraceMs", "httpTimeoutMs", "clientTimeoutMs", "healthCacheMs", "legacyTimeoutMs", "stableSearchMinMs", "stableSearchMaxMs"], "cpu": ["sampleMs", "highForMs", "reduceIntervalMs", "ponderPauseMs", "lowForMs", "recoverIntervalMs", "limitedSearchMs"], "fallbackDelay": ["quickSearchThresholdMs", "quickMaxMs", "advantageMinMs", "advantageMaxMs", "complexMinMs", "baseMinMs", "baseMs", "perChoiceMs", "perDepthMs", "maxMs"] };
  function validateSettings(s) {
    for (const [section, entries] of Object.entries(required)) {
      for (const key of entries) {
        const value = s?.[section]?.[key];
        if (!Number.isSafeInteger(value) || value < 0 || value > 36e5)
          throw Error(`settings.json: ${section}.${key} must be an integer from 0 to 3600000`);
      }
    }
    const check = (ok, message) => {
      if (!ok)
        throw Error("settings.json: " + message);
    };
    check(s.ads.googleCloseProbeAfterMs >= 1e3 && s.ads.googleCloseRetryMs >= 1e3 && s.ads.googleCloseMaxProbes <= 10, "invalid Google reward close probe limits");
    check(s.ads.framePollMs >= 100 && s.ads.frameLeaseMs >= s.ads.framePollMs * 2, "ad frame lease/poll interval invalid");
    check(s.move.minDelayMs >= 500, "move.minDelayMs must be >= 500");
    check(s.move.quickMaxMs >= s.move.minDelayMs && s.move.maxDelayMs >= s.move.quickMaxMs, "invalid move delay range");
    check(s.move.bookMaxMs >= s.move.bookMinMs, "invalid book delay range");
    check(s.session.readyMaxMs >= s.session.readyMinMs, "invalid ready delay range");
    check(s.draw.maxOffers <= 2, "draw.maxOffers cannot exceed 2");
    check(s.draw.minOwnTurnsBetweenOffers >= 1, "draw.minOwnTurnsBetweenOffers must be >= 1");
    for (const key of ["smallSearchMs", "mediumSearchMs", "complexSearchMs"])
      check(s.move[key] >= 100 && s.move[key] <= 5e4, `move.${key} must be 100\u201350000`);
    check(s.draw.replySearchMs >= 100 && s.draw.replySearchMs <= 1e4, "draw.replySearchMs must be 100\u201310000");
    check(s.move.pollMs >= 50 && s.cpu.sampleMs >= 250, "poll/sample interval too small");
    check(s.engine.httpTimeoutMs > s.move.complexSearchMs + s.engine.stopTimeoutMs, "HTTP timeout must exceed search + stop timeout");
    check(s.engine.clientTimeoutMs > s.engine.httpTimeoutMs, "client timeout must exceed HTTP timeout");
    for (const entries of Object.values(s))
      Object.freeze(entries);
    return Object.freeze(s);
  }
  var settings = validateSettings(settings_default);

  // engine-budget.mjs
  var MAX_MOVETIME_MS = 5e4;
  function budgetTimeouts(movetime) {
    const budget = Number.isInteger(movetime) && movetime > 0 ? Math.min(movetime, MAX_MOVETIME_MS) : 0;
    const bridgeMs = budget > 1e4 ? Math.max(settings.engine.httpTimeoutMs, budget + settings.engine.handshakeMs + settings.engine.searchGraceMs + settings.engine.stopTimeoutMs) : settings.engine.httpTimeoutMs;
    return { bridgeMs, clientMs: Math.max(settings.engine.clientTimeoutMs, bridgeMs + Math.max(2e3, settings.engine.clientTimeoutMs - settings.engine.httpTimeoutMs)) };
  }

  // src/ad-diagnostic.js
  function cleanSurface(raw) {
    const text = (value) => typeof value === "string" ? value.replace(/[\r\n]/g, " ").slice(0, 100) : "";
    return {
      frames: Array.isArray(raw?.frames) ? raw.frames.slice(0, 20).map((f) => ({ host: text(f.host), visible: f.visible === true })) : [],
      controls: Array.isArray(raw?.controls) ? raw.controls.slice(0, 20).map(text) : [],
      videos: Number.isInteger(raw?.videos) ? Math.max(0, Math.min(100, raw.videos)) : 0
    };
  }

  // src/ad-frame-gate.js
  var ziga = (url) => /^https:\/\/(www\.)?zigavn\.com\//.test(url || "");
  var adFrame = (url) => {
    try {
      return /(^|\.)(googlesyndication\.com|doubleclick\.net|googleadservices\.com)$/.test(new URL(url).hostname);
    } catch {
      return false;
    }
  };
  var AdFrameGate = class {
    constructor(leaseMs, { probeAfterMs = 15e3, probeRetryMs = 1e4, probeMax = 8 } = {}) {
      Object.assign(this, { leaseMs, probeAfterMs, probeRetryMs, probeMax });
      this.tabs = /* @__PURE__ */ new Map();
      this.logs = /* @__PURE__ */ new Map();
      this.surfaces = /* @__PURE__ */ new Map();
      this.revision = 0;
    }
    surface(tab, frame, raw) {
      if (!raw)
        return;
      const data = { frame, ...cleanSurface(raw) }, all = this.surfaces.get(tab) || {};
      if (JSON.stringify(all[frame]) === JSON.stringify(data))
        return;
      if (!all[frame] && Object.keys(all).length >= 40)
        return;
      all[frame] = data;
      this.surfaces.set(tab, all);
      this.revision++;
    }
    record(tab, event) {
      const log = this.logs.get(tab) || [];
      if (JSON.stringify(log.at(-1)) === JSON.stringify(event))
        return;
      log.push(event);
      if (log.length > 20)
        log.shift();
      this.logs.set(tab, log);
      this.revision++;
    }
    diagnostic(tab) {
      return this.logs.has(tab) ? { events: this.logs.get(tab), surfaces: Object.values(this.surfaces.get(tab) || {}) } : null;
    }
    message(msg, sender, now = Date.now()) {
      const tab = sender.tab?.id;
      if (!Number.isInteger(tab))
        return { allowed: false };
      if (msg.kind === "ad-watch") {
        if (sender.frameId !== 0 || !ziga(sender.url))
          return { allowed: false };
        if (!msg.active) {
          if (this.tabs.has(tab))
            this.record(tab, { stage: "\u0110\xE3 k\u1EBFt th\xFAc theo d\xF5i qu\u1EA3ng c\xE1o" });
          this.tabs.delete(tab);
          return { allowed: false };
        }
        if (typeof msg.adId !== "string" || msg.adId.length > 100)
          return { allowed: false };
        const previous = this.tabs.get(tab);
        if (!previous || previous.adId !== msg.adId) {
          this.record(tab, { stage: "B\u1EAFt \u0111\u1EA7u theo d\xF5i qu\u1EA3ng c\xE1o" });
          this.surfaces.delete(tab);
        }
        this.surface(tab, 0, msg.surface);
        const same = previous?.adId === msg.adId;
        this.tabs.set(tab, { adId: msg.adId, expires: now + this.leaseMs, completed: msg.completed === true || same && previous.completed === true, frames: same ? previous.frames : /* @__PURE__ */ new Map(), startedAt: same ? previous.startedAt : now, lastProbe: same ? previous.lastProbe : -Infinity, probeAttempts: same ? previous.probeAttempts : 0 });
        return { allowed: true };
      }
      if (!["ad-frame-poll", "ad-frame-report", "ad-close-probe"].includes(msg.kind) || sender.frameId === 0 || !(adFrame(sender.url) || adFrame(sender.origin)))
        return { allowed: false };
      const state = this.tabs.get(tab);
      if (!state || now > state.expires)
        return { allowed: false };
      if (msg.kind === "ad-close-probe") {
        if (msg.adId !== state.adId || msg.hasGuard !== true || now - state.startedAt < this.probeAfterMs || now - state.lastProbe < this.probeRetryMs || state.probeAttempts >= this.probeMax)
          return { allowed: false };
        state.lastProbe = now;
        state.probeAttempts++;
        this.record(tab, { stage: "Th\u1EED n\xFAt \u0110\xF3ng qua h\u1ED9p b\u1EA3o v\u1EC7 ph\u1EA7n th\u01B0\u1EDFng", frame: sender.frameId });
        return { allowed: true };
      }
      if (msg.adId === state.adId && msg.videoEnded === true)
        state.completed = true;
      if (msg.kind === "ad-frame-report") {
        if (msg.adId !== state.adId)
          return { allowed: false };
        this.surface(tab, sender.frameId, msg.surface);
        const previous = state.frames.get(sender.frameId);
        const report = { stage: "Khung qu\u1EA3ng c\xE1o", frame: sender.frameId, completed: state.completed === true, candidates: Number.isInteger(msg.candidates) ? Math.max(0, Math.min(100, msg.candidates)) : 0, clicked: msg.clicked === true || previous?.clicked === true, continued: msg.continued === true || previous?.continued === true };
        if (JSON.stringify(previous) !== JSON.stringify(report)) {
          state.frames.set(sender.frameId, report);
          this.record(tab, report);
        }
      } else if (msg.adId !== state.adId)
        this.record(tab, { stage: "\u0110\xE3 nh\u1EADn t\xEDn hi\u1EC7u t\u1EEB iframe", frame: sender.frameId, completed: state.completed === true });
      return { allowed: true, adId: state.adId, startedAt: state.startedAt, completed: state.completed };
    }
  };

  // src/preferences.js
  var defaults = Object.freeze({ time: "auto", book: "5", depth: "0", threads: "2", ponder: true, autoDrawReply: false, autoDrawOffer: false, adHeartThreshold: "0", autoAds: false, maxAds: "3", minimized: false });
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
        if (["auto", "650", "1200", "2500", "5000", "10000", "20000", "30000", "50000"].includes(s))
          out[key] = s;
        continue;
      }
      if (key === "book") {
        if (["0", "3", "4", "5", "6", "7", "8", "9", "10"].includes(s))
          out[key] = s;
        continue;
      }
      const [min, max] = { depth: [0, 64], threads: [1, 16], adHeartThreshold: [0, 1e4], maxAds: [1, 10] }[key];
      if (/^(0|[1-9]\d*)$/.test(s) && Number(s) >= min && Number(s) <= max)
        out[key] = s;
    }
    return out;
  }

  // src/bridge-status.js
  function checkBridgeVersion(health, movetime = 1e4, bookMoves = 5) {
    const version = typeof health?.version === "string" ? health.version.split(".").map(Number) : [];
    if (!health?.ok || version.length < 2 || !version.every(Number.isFinite) || version[0] === 0 && version[1] < 6)
      throw Error("Bridge \u0111ang ch\u1EA1y b\u1EA3n c\u0169, ch\u01B0a h\u1ED7 tr\u1EE3 10 gi\xE2y/ponder. H\xE3y \u0111\xF3ng bridge c\u0169 r\u1ED3i ch\u1EA1y start-bridge.cmd trong th\u01B0 m\u1EE5c extension m\u1EDBi.");
    const maximum = Number.isInteger(health.maxMovetimeMs) ? health.maxMovetimeMs : 1e4;
    if (movetime > maximum)
      throw Error(`Bridge \u0111ang ch\u1EA1y b\u1EA3n c\u0169, ch\u1EC9 h\u1ED7 tr\u1EE3 t\u1ED1i \u0111a ${maximum / 1e3} gi\xE2y. H\xE3y \u0111\xF3ng bridge c\u0169 r\u1ED3i ch\u1EA1y l\u1EA1i start-bridge.cmd b\u1EA3n m\u1EDBi \u0111\u1EC3 d\xF9ng 20/30/50 gi\xE2y.`);
    if (bookMoves > (Number.isInteger(health.maxBookMoves) ? health.maxBookMoves : 5))
      throw Error("Bridge \u0111ang ch\u1EA1y b\u1EA3n c\u0169, ch\u1EC9 h\u1ED7 tr\u1EE3 book t\u1ED1i \u0111a 5 l\u01B0\u1EE3t/b\xEAn. H\xE3y \u0111\xF3ng bridge c\u0169 r\u1ED3i ch\u1EA1y l\u1EA1i start-bridge.cmd b\u1EA3n m\u1EDBi \u0111\u1EC3 d\xF9ng book 6\u201310.");
    return true;
  }
  function bridgeErrorMessage(error) {
    if (error?.name === "AbortError")
      return "\u0110\xE3 h\u1EE7y ho\u1EB7c engine qu\xE1 th\u1EDDi gian.";
    const message = String(error?.message || error);
    const limit = /Invalid movetime.*?[–-](\d+)\s*ms/.exec(message);
    if (limit && Number(limit[1]) < 5e4)
      return `Bridge \u0111ang ch\u1EA1y b\u1EA3n c\u0169 (ch\u1EC9 h\u1ED7 tr\u1EE3 ${Number(limit[1]) / 1e3} gi\xE2y). H\xE3y ch\u1EA1y start-bridge.cmd b\u1EA3n m\u1EDBi, sau \u0111\xF3 Reload extension v\xE0 t\u1EA3i l\u1EA1i Ziga.`;
    if (/Failed to fetch|fetch failed|ECONNREFUSED/i.test(message))
      return "Ch\u01B0a k\u1EBFt n\u1ED1i \u0111\u01B0\u1EE3c bridge \u1EDF c\u1ED5ng 17864. H\xE3y ch\u1EA1y start-bridge.cmd.";
    return message;
  }

  // src/background.js
  var adFrames = new AdFrameGate(settings.ads.frameLeaseMs, { probeAfterMs: settings.ads.googleCloseProbeAfterMs, probeRetryMs: settings.ads.googleCloseRetryMs, probeMax: settings.ads.googleCloseMaxProbes });
  chrome.runtime.onMessage.addListener((msg, sender, reply) => {
    if (!["ad-watch", "ad-frame-poll", "ad-frame-report", "ad-close-probe"].includes(msg?.kind))
      return;
    const revision = adFrames.revision;
    const previous = adFrames.tabs.get(sender.tab?.id);
    const result = adFrames.message(msg, sender);
    reply(result);
    if (adFrames.revision !== revision)
      chrome.storage.session.set({ ["ad-diagnostic." + sender.tab.id]: adFrames.diagnostic(sender.tab.id) }).catch(() => {
      });
    const current = adFrames.tabs.get(sender.tab?.id);
    if (msg.kind === "ad-watch" && result.allowed && (!previous || previous.adId !== current?.adId || previous.completed !== current?.completed)) {
      chrome.tabs.sendMessage(sender.tab.id, { kind: "ad-frame-wake" }).catch(() => {
      });
    }
  });
  chrome.tabs.onRemoved.addListener((tab) => {
    adFrames.tabs.delete(tab);
    adFrames.logs.delete(tab);
    adFrames.surfaces.delete(tab);
    chrome.storage.session.remove("ad-diagnostic." + tab).catch(() => {
    });
  });
  var jobs = /* @__PURE__ */ new Map();
  var bridgeUrl = "http://127.0.0.1:17864";
  var lastHealthAt = 0;
  var lastHealth = null;
  chrome.runtime.onMessage.addListener((msg, sender, reply) => {
    if (!/^https:\/\/(www\.)?zigavn\.com\//.test(sender.url || "") || typeof msg?.id !== "string")
      return;
    const key = sender.tab.id + ":" + sender.frameId + ":" + msg.id;
    if (msg.kind === "ad-diagnostics") {
      chrome.storage.session.get("ad-diagnostic." + sender.tab.id).then((data) => reply({ diagnostic: adFrames.diagnostic(sender.tab.id) || data["ad-diagnostic." + sender.tab.id] || { events: [{ stage: "Ch\u01B0a nh\u1EADn t\xEDn hi\u1EC7u iframe qu\u1EA3ng c\xE1o. C\xF3 th\u1EC3 khung kh\xF4ng thu\u1ED9c mi\u1EC1n \u0111\u01B0\u1EE3c h\u1ED7 tr\u1EE3 ho\u1EB7c extension ch\u01B0a Reload." }] } })).catch((e) => reply({ error: e.message }));
      return true;
    }
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
    if (msg.kind !== "stop" && (typeof msg.fen !== "string" || msg.fen.length > 200 || !Number.isInteger(msg.movetime) || msg.movetime < 100 || msg.movetime > MAX_MOVETIME_MS)) {
      reply({ error: "Invalid request" });
      return;
    }
    const controller = new AbortController();
    jobs.set(key, controller);
    const timer = setTimeout(() => controller.abort(), budgetTimeouts(msg.movetime).bridgeMs);
    Promise.resolve().then(async () => {
      if (msg.kind !== "stop" && Date.now() - lastHealthAt > settings.engine.healthCacheMs) {
        const response = await fetch(bridgeUrl + "/health", { signal: controller.signal });
        lastHealth = await response.json();
        lastHealthAt = Date.now();
      }
      if (msg.kind !== "stop")
        checkBridgeVersion(lastHealth, msg.movetime, msg.bookMoves);
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
