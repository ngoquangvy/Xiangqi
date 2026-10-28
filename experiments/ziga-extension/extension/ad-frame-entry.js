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
      exposedRecoveryMs: 1e4,
      framePollMs: 500,
      frameLeaseMs: 2e3,
      googleCloseProbeAfterMs: 15e3,
      googleCloseRetryMs: 1e4,
      googleCloseMaxProbes: 8
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
      check(s.move[key] >= 100 && s.move[key] <= 1e4, `move.${key} must be 100\u201310000`);
    check(s.draw.replySearchMs >= 100 && s.draw.replySearchMs <= 1e4, "draw.replySearchMs must be 100\u201310000");
    check(s.move.pollMs >= 50 && s.cpu.sampleMs >= 250, "poll/sample interval too small");
    check(s.engine.httpTimeoutMs > s.move.complexSearchMs + s.engine.stopTimeoutMs, "HTTP timeout must exceed search + stop timeout");
    check(s.engine.clientTimeoutMs > s.engine.httpTimeoutMs, "client timeout must exceed HTTP timeout");
    for (const entries of Object.values(s))
      Object.freeze(entries);
    return Object.freeze(s);
  }
  var settings = validateSettings(settings_default);

  // src/ad-frame.js
  function adRoots(doc) {
    const roots = [doc];
    for (let i = 0; i < roots.length && i < 40; i++) {
      for (const node of roots[i].querySelectorAll("*"))
        if (node.shadowRoot)
          roots.push(node.shadowRoot);
    }
    return roots;
  }
  var closeSelectors = '#dismiss-button, #dismiss-button-element, #close-button, #close_button, .close-button, [aria-label="Close ad"], [aria-label="Close Ad"], [aria-label="\u0110\xF3ng qu\u1EA3ng c\xE1o"], [aria-label="Close"], [aria-label="\u0110\xF3ng"]';
  function visibleControl(w, el, root = w.document) {
    if (!el)
      return false;
    const r = el.getBoundingClientRect(), style = w.getComputedStyle(el);
    if (el.disabled || el.getAttribute("aria-disabled") === "true" || r.width <= 0 || r.height <= 0 || style.display === "none" || style.visibility === "hidden" || style.opacity === "0" || style.pointerEvents === "none")
      return false;
    const top = root.elementFromPoint?.(r.left + r.width / 2, r.top + r.height / 2) || w.document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return top === el || el.contains(top);
  }
  function rewardGuard(w) {
    for (const root of adRoots(w.document))
      for (const dialog of root.querySelectorAll("#close-confirmation-dialog")) {
        if (dialog.id !== "close-confirmation-dialog")
          continue;
        if (!visibleControl(w, dialog, root))
          continue;
        const text = (dialog.innerText || "").replace(/\s+/g, " ");
        if (!/mất phần thưởng|lose.*reward|forfeit.*reward/i.test(text))
          return { visible: true, resumed: false };
        for (const button of dialog.querySelectorAll('button, [role="button"], [tabindex], #resume-button, #resume-ad-button, #continue-ad-button')) {
          const label = (button.innerText || button.getAttribute("aria-label") || "").trim();
          if (/^(tiếp tục(?: xem)?|continue(?: watching)?|resume(?: ad)?)$/i.test(label) && visibleControl(w, button, root)) {
            button.click();
            return { visible: true, resumed: true };
          }
        }
        return { visible: true, resumed: false };
      }
    return { visible: false, resumed: false };
  }
  function hasGoogleRewardGuard(doc) {
    return adRoots(doc).some((root) => Array.from(root.querySelectorAll("#close-confirmation-dialog")).some((dialog) => /mất phần thưởng|lose.*reward|forfeit.*reward/i.test(dialog.textContent || "")) && root.querySelectorAll("#dismiss-button, #dismiss-button-element").length > 0);
  }
  function videoFinished(doc) {
    const videos = adRoots(doc).flatMap((root) => Array.from(root.querySelectorAll("video"))).filter((v) => Number.isFinite(v.duration) && v.duration > 0);
    return videos.length > 0 && videos.every((v) => v.ended === true);
  }
  function closeFrameAd(w, completed, clicked = /* @__PURE__ */ new WeakSet(), { googleOnly = false } = {}) {
    const doc = w.document;
    if (!completed || doc.visibilityState === "hidden")
      return false;
    if (rewardGuard(w).visible)
      return false;
    const selectors = googleOnly ? "#dismiss-button, #dismiss-button-element" : closeSelectors;
    for (const root of adRoots(doc))
      for (const el of root.querySelectorAll(selectors)) {
        if (el.closest?.("#close-confirmation-dialog"))
          continue;
        const r = el.getBoundingClientRect(), style = w.getComputedStyle(el);
        if (clicked.has(el) || el.disabled || el.getAttribute("aria-disabled") === "true" || r.width <= 0 || r.height <= 0 || style.display === "none" || style.visibility === "hidden" || style.opacity === "0" || style.pointerEvents === "none")
          continue;
        const text = [typeof el.innerText === "string" ? el.innerText : el.textContent, el.getAttribute("aria-label")].join(" ");
        if (/\d|skip|bỏ qua/i.test(text))
          continue;
        const top = root.elementFromPoint?.(r.left + r.width / 2, r.top + r.height / 2) || doc.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        if (top !== el && !el.contains(top))
          continue;
        clicked.add(el);
        el.click();
        return true;
      }
    return false;
  }

  // src/ad-diagnostic.js
  function adSurface(w) {
    const frames = [], controls = [];
    let videos = 0;
    const doc = w.document;
    if (typeof doc?.querySelectorAll !== "function")
      return { frames, controls, videos };
    for (const root of adRoots(doc)) {
      videos += root.querySelectorAll("video").length;
      for (const frame of root.querySelectorAll("iframe")) {
        if (frames.length >= 20)
          break;
        let host = "kh\xF4ng c\xF3 src";
        try {
          const url = new URL(frame.src || frame.getAttribute?.("src") || "", w.location?.href);
          host = url.hostname || url.protocol;
        } catch {
        }
        const r = frame.getBoundingClientRect?.();
        frames.push({ host, visible: !!r && r.width > 0 && r.height > 0 });
      }
      for (const el of root.querySelectorAll('button, [role="button"], [aria-label], [id*="close"], [id*="dismiss"], [class*="close"]')) {
        if (controls.length >= 20)
          break;
        const label = [el.innerText, el.getAttribute?.("aria-label"), el.id].filter(Boolean).join(" ").trim();
        if (!/close|dismiss|đóng|skip|bỏ qua|reward|thưởng/i.test(label))
          continue;
        const r = el.getBoundingClientRect?.();
        if (!r || r.width <= 0 || r.height <= 0)
          continue;
        controls.push(label.replace(/\s+/g, " ").slice(0, 100));
      }
    }
    return { frames, controls, videos };
  }

  // src/ad-frame-entry.js
  if (window !== window.top) {
    let observeVideos = function() {
      for (const root of adRoots(document))
        if (!observedRoots.has(root)) {
          observedRoots.add(root);
          root.addEventListener("ended", (event) => {
            if (event.target?.tagName === "VIDEO" && event.target.ended && adId) {
              endedAdId = adId;
              void tick();
            }
          }, true);
        }
    };
    let busy = false, adId = null, clicked = /* @__PURE__ */ new WeakSet(), endedAdId = null;
    const observedRoots = /* @__PURE__ */ new WeakSet();
    async function tick() {
      if (busy || document.visibilityState === "hidden")
        return;
      busy = true;
      try {
        const state = await chrome.runtime.sendMessage({ kind: "ad-frame-poll", adId, videoEnded: adId !== null && (videoFinished(document) || endedAdId === adId) });
        document.documentElement.dataset.zigaAdState = state?.allowed ? state.completed ? "completed" : "watching" : "inactive";
        if (!state?.allowed)
          return;
        observeVideos();
        if (adId !== state.adId) {
          adId = state.adId;
          endedAdId = null;
          clicked = /* @__PURE__ */ new WeakSet();
          setTimeout(tick, 0);
        }
        const candidates = adRoots(document).reduce((n, root) => n + root.querySelectorAll(closeSelectors).length, 0);
        const guard = rewardGuard(window);
        let didClick = false;
        if (!guard.visible) {
          if (state.completed)
            didClick = closeFrameAd(window, true, clicked);
          else if (hasGoogleRewardGuard(document)) {
            const permission = await chrome.runtime.sendMessage({ kind: "ad-close-probe", adId, hasGuard: true });
            if (permission?.allowed)
              didClick = closeFrameAd(window, true, /* @__PURE__ */ new WeakSet(), { googleOnly: true });
          }
        }
        await chrome.runtime.sendMessage({ kind: "ad-frame-report", adId, candidates, clicked: didClick, continued: guard.resumed, surface: adSurface(window) });
      } catch (e) {
        document.documentElement.dataset.zigaAdState = "error: " + e.message;
      } finally {
        busy = false;
      }
    }
    document.addEventListener("ended", () => void tick(), true);
    new MutationObserver(() => void tick()).observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ["disabled", "aria-disabled", "hidden", "style", "class"] });
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg?.kind === "ad-frame-wake")
        void tick();
    });
    setInterval(tick, settings.ads.framePollMs);
    void tick();
  }
})();
