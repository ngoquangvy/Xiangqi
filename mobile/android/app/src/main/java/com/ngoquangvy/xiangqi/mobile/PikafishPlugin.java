package com.ngoquangvy.xiangqi.mobile;

import com.getcapacitor.*;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicLong;

/** Fixed catalog bridge; callers cannot execute paths, commands or arbitrary options. */
@CapacitorPlugin(name = "Pikafish")
public class PikafishPlugin extends Plugin {
    private final ExecutorService control = Executors.newSingleThreadExecutor();
    private final AtomicLong revision = new AtomicLong();
    private volatile boolean foreground = true;
    private final BundledBook book = new BundledBook();
    private final PikafishProcess engine = new PikafishProcess(
        (id, line) -> emit("output", id, line), (id, message) -> emit("failure", id, message));

    private void emit(String event, String id, String line) {
        JSObject value = new JSObject(); value.put("id", id); value.put("line", line);
        notifyListeners(event, value);
    }

    @PluginMethod
    public void analyze(PluginCall call) {
        String id = call.getString("id"), fen = call.getString("initialFen"), moves = call.getString("moves", ""), profile = call.getString("profile", "balanced");
        if (id == null || !id.matches("[a-zA-Z0-9-]{1,64}") || fen == null || fen.length() > 256
            || !fen.matches("[rnbakcpheRNBAKCPHE1-9/]+ [wb] - - \\d+ \\d+")
            || moves.length() > 50000 || !moves.matches("(?:[a-i][0-9][a-i][0-9](?: [a-i][0-9][a-i][0-9])*)?")
            || !(profile.equals("eco") || profile.equals("balanced") || profile.equals("deep") || profile.equals("unlimited") || profile.equals("deep_cool"))) {
            call.reject("Invalid analysis request"); return;
        }
        long expected = revision.incrementAndGet(); engine.silence();
        control.execute(() -> {
            try {
                if (foreground && revision.get() == expected) engine.analyze(getContext(), id, fen, moves, profile,
                    () -> foreground && revision.get() == expected);
                call.resolve();
            } catch (Exception error) {
                engine.close();
                call.reject("Pikafish could not analyze: " + error.getMessage());
            }
        });
    }

    @PluginMethod
    public void stop(PluginCall call) {
        revision.incrementAndGet(); engine.silence();
        control.execute(() -> {
            try { engine.stopSearch(); call.resolve(); }
            catch (Exception error) { engine.close(); call.reject("Could not stop Pikafish"); }
        });
    }

    @PluginMethod
    public void lookupBook(PluginCall call) {
        control.execute(() -> {
            try { JSObject value = new JSObject(); value.put("rows", book.lookup(getContext(), call.getString("fen"))); call.resolve(value); }
            catch (Exception error) { call.reject("Bundled book unavailable"); }
        });
    }

    @PluginMethod
    public void status(PluginCall call) {
        JSObject value = new JSObject(); value.put("alive", engine.alive()); value.put("searching", engine.searching()); value.put("id", engine.activeId()); value.put("foreground", foreground);
        call.resolve(value);
    }

    @Override protected void handleOnPause() { foreground = false; revision.incrementAndGet(); engine.close(); }
    @Override protected void handleOnResume() { foreground = true; }
    @Override protected void handleOnDestroy() {
        foreground = false; revision.incrementAndGet(); engine.close();
        control.execute(book::close); control.shutdown();
    }
}
