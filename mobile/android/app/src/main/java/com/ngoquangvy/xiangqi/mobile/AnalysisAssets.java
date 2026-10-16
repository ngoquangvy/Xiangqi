package com.ngoquangvy.xiangqi.mobile;

import android.content.Context;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import org.json.JSONObject;

/** Only fixed, APK-bundled assets. Executable code is NEVER copied to writable storage. */
final class AnalysisAssets {
    private final Context context;
    private final JSONObject metadata;

    AnalysisAssets(Context context) throws Exception {
        this.context = context;
        try (InputStream input = context.getAssets().open("analysis/bundle.json")) {
            ByteArrayOutputStream bytes = new ByteArrayOutputStream();
            copy(input, bytes);
            metadata = new JSONObject(bytes.toString(StandardCharsets.UTF_8.name()));
        }
    }

    File network() throws Exception { return extract("pikafish.nnue", metadata.getString("nnueSha256")); }
    File book() throws Exception { return extract("book.sqlite", metadata.getString("bookSha256")); }
    JSONObject profile(String name) throws Exception { return metadata.getJSONObject("profiles").getJSONObject(name); }

    private File extract(String name, String hash) throws Exception {
        File directory = new File(context.getNoBackupFilesDir(), "analysis");
        if (!directory.isDirectory() && !directory.mkdirs()) throw new IOException("Cannot create analysis storage");
        File target = new File(directory, hash.substring(0, 16) + "-" + name);
        if (target.isFile() && hash.equals(digest(target))) return target;
        File pending = new File(directory, target.getName() + ".tmp");
        try {
            try (InputStream input = context.getAssets().open("analysis/" + name);
                 FileOutputStream output = new FileOutputStream(pending)) {
                copy(input, output);
                output.getFD().sync();
            }
            if (!hash.equals(digest(pending))) throw new IOException("Bundled asset checksum mismatch");
            if (!pending.renameTo(target)) throw new IOException("Cannot install bundled analysis data");
            return target;
        } finally { pending.delete(); }
    }

    private static String digest(File file) throws Exception {
        MessageDigest hash = MessageDigest.getInstance("SHA-256");
        try (InputStream input = new FileInputStream(file)) {
            byte[] buffer = new byte[65536];
            for (int n; (n = input.read(buffer)) != -1;) hash.update(buffer, 0, n);
        }
        StringBuilder value = new StringBuilder();
        for (byte part : hash.digest()) value.append(String.format(java.util.Locale.ROOT, "%02x", part & 255));
        return value.toString();
    }

    private static void copy(InputStream input, OutputStream output) throws IOException {
        byte[] buffer = new byte[65536];
        for (int n; (n = input.read(buffer)) != -1;) output.write(buffer, 0, n);
    }
}
