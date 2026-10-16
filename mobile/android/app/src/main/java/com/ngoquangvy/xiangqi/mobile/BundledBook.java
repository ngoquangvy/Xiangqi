package com.ngoquangvy.xiangqi.mobile;

import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import org.json.JSONArray;

/** Indexed lookup reads one position, keeping the complete book out of WebView. */
final class BundledBook implements AutoCloseable {
    private SQLiteDatabase database;

    JSONArray lookup(Context context, String fen) throws Exception {
        if (fen == null || fen.length() > 256 || !fen.matches("[^\\r\\n]+ [wb] - - \\d+ \\d+")) throw new IllegalArgumentException("Invalid FEN");
        if (database == null) database = SQLiteDatabase.openDatabase(new AnalysisAssets(context).book().getPath(), null, SQLiteDatabase.OPEN_READONLY);
        String[] parts = fen.trim().split("\\s+");
        try (Cursor cursor = database.rawQuery("SELECT candidates FROM positions WHERE fen = ?", new String[]{parts[0] + " " + parts[1]})) {
            return cursor.moveToFirst() ? new JSONArray(cursor.getString(0)) : new JSONArray();
        }
    }

    public void close() { if (database != null) { database.close(); database = null; } }
}
