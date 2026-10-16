package com.ngoquangvy.xiangqi.mobile;

import android.content.Context;
import android.os.SystemClock;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.*;
import java.util.function.BiConsumer;
import java.util.function.BooleanSupplier;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** One process, one serialized control thread and one stdout reader. No game rules. */
final class PikafishProcess {
    // Kept in sync with JS lineLimits by a unit guard and real engine tests.
    static final int VARIATION_COUNT = 5;
    private static final Pattern MULTIPV = Pattern.compile("\\bmultipv\\s+(\\S+)");
    private volatile Process process;
    private volatile String requestId;
    private volatile CompletableFuture<Void> searchDone = CompletableFuture.completedFuture(null);
    private BufferedWriter input;
    private String profile;
    private volatile BlockingQueue<String> barriers = new LinkedBlockingQueue<>(32);
    private final BiConsumer<String, String> output;
    private final BiConsumer<String, String> failure;

    PikafishProcess(BiConsumer<String, String> output, BiConsumer<String, String> failure) {
        this.output = output; this.failure = failure;
    }

    void analyze(Context context, String id, String initialFen, String moves, String mode, BooleanSupplier current) throws Exception {
        silence();
        stopSearch();
        if (!current.getAsBoolean()) return;
        if (!alive()) start(context, current);
        if (!current.getAsBoolean()) return;
        org.json.JSONObject settings = new AnalysisAssets(context).profile(mode);
        if (!mode.equals(profile)) {
            int threads = settings.getInt("threads"), hash = settings.getInt("hash");
            send("setoption name Threads value " + threads);
            send("setoption name Hash value " + hash);
            send("setoption name MultiPV value " + VARIATION_COUNT);
            profile = mode;
        }
        barriers.clear(); send("isready"); await("readyok", 10000);
        if (!current.getAsBoolean()) return;
        send("position fen " + initialFen + (moves.isEmpty() ? "" : " moves " + moves));
        searchDone = new CompletableFuture<>(); requestId = id;
        int depth = settings.getInt("depth"), time = settings.getInt("milliseconds");
        send("go depth " + depth + " movetime " + time);
    }

    private void start(Context context, BooleanSupplier current) throws Exception {
        File binary = new File(context.getApplicationInfo().nativeLibraryDir, "libpikafish.so");
        if (!binary.canExecute()) throw new IOException("Pikafish is not packaged for this device ABI");
        File network = new AnalysisAssets(context).network();
        if (!current.getAsBoolean()) return;
        BlockingQueue<String> signals = new LinkedBlockingQueue<>(32);
        barriers = signals; profile = null;
        Process child = new ProcessBuilder(binary.getAbsolutePath()).directory(network.getParentFile()).redirectErrorStream(true).start();
        process = child;
        input = new BufferedWriter(new OutputStreamWriter(child.getOutputStream(), StandardCharsets.UTF_8));
        Thread reader = new Thread(() -> read(child, signals), "pikafish-stdout"); reader.setDaemon(true); reader.start();
        // A lifecycle stop can race process creation. Recheck after assigning it.
        if (!current.getAsBoolean()) { close(); return; }
        send("uci"); await("uciok", 10000);
        send("setoption name EvalFile value " + network.getAbsolutePath());
        send("isready"); await("readyok", 10000);
    }

    void silence() { requestId = null; }
    void stopSearch() throws Exception {
        silence();
        CompletableFuture<Void> pending = searchDone;
        if (alive() && !pending.isDone()) {
            // A completion future cannot lose bestmove when natural completion
            // races stop. Clearing a queue here would occasionally lose it.
            send("stop"); pending.get(3000, TimeUnit.MILLISECONDS);
        }
    }

    private void read(Process child, BlockingQueue<String> signals) {
        long[] last = new long[VARIATION_COUNT];
        String[] latest = new String[VARIATION_COUNT];
        String previousId = null;
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(child.getInputStream(), StandardCharsets.UTF_8))) {
            for (String line; (line = reader.readLine()) != null;) {
                CompletableFuture<Void> completion = searchDone;
                if (process != child) return;
                if (line.equals("uciok") || line.equals("readyok") || line.startsWith("bestmove ")) {
                    String id = requestId;
                    if (line.startsWith("bestmove ")) {
                        if (id != null) {
                            // Flush final PVs even if throttling suppressed the
                            // last completed depth immediately before bestmove.
                            if (id.equals(previousId)) for (String info : latest) if (info != null) output.accept(id, info);
                            output.accept(id, line);
                        }
                        completion.complete(null);
                    } else {
                        signals.offer(line);
                    }
                } else if (line.startsWith("info ") && line.contains(" pv ")) {
                    String id = requestId;
                    if (id == null) continue;
                    if (!id.equals(previousId)) {
                        previousId = id; java.util.Arrays.fill(last, 0); java.util.Arrays.fill(latest, null);
                    }
                    int rank = rankOf(line);
                    if (rank < 0 || rank >= VARIATION_COUNT) continue;
                    latest[rank] = line;
                    long now = SystemClock.elapsedRealtime();
                    if (id != null && now - last[rank] >= 100) { last[rank] = now; output.accept(id, line); }
                }
            }
        } catch (IOException ignored) { /* EOF is handled below, deliberate close is silent. */ }
        CompletableFuture<Void> completion = searchDone;
        String id = requestId;
        if (process == child) {
            signals.offer("closed");
            completion.completeExceptionally(new IOException("Pikafish closed"));
            if (id != null) failure.accept(id, "Pikafish exited unexpectedly");
        }
    }

    private static int rankOf(String line) {
        Matcher match = MULTIPV.matcher(line);
        if (!match.find()) return 0; // UCI permits omitting multipv for rank one.
        try { return Integer.parseInt(match.group(1)) - 1; }
        catch (NumberFormatException invalid) { return -1; }
    }

    private void send(String command) throws IOException { input.write(command); input.newLine(); input.flush(); }
    private void await(String expected, long milliseconds) throws Exception {
        long deadline = SystemClock.elapsedRealtime() + milliseconds;
        while (true) {
            long remaining = deadline - SystemClock.elapsedRealtime();
            String line = remaining > 0 ? barriers.poll(remaining, TimeUnit.MILLISECONDS) : null;
            if (line == null || line.equals("closed")) throw new IOException("Pikafish timeout/exit waiting for " + expected);
            if (line.equals(expected)) return;
        }
    }

    boolean alive() {
        Process child = process;
        if (child == null) return false;
        try { child.exitValue(); return false; } catch (IllegalThreadStateException running) { return true; }
    }
    boolean searching() { return alive() && !searchDone.isDone(); }
    String activeId() { return requestId; }

    // Safe from Android lifecycle callbacks: never wait on a search/UI thread.
    void close() {
        silence(); searchDone.completeExceptionally(new IOException("Pikafish stopped"));
        Process child = process; process = null;
        if (child != null) {
            if (android.os.Build.VERSION.SDK_INT >= 26) child.destroyForcibly();
            else child.destroy();
        }
        barriers.offer("closed");
    }
}
