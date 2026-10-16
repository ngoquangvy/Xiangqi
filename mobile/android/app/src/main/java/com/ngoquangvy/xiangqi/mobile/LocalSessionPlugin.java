package com.ngoquangvy.xiangqi.mobile;

import android.content.Context;
import android.content.SharedPreferences;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.nio.charset.StandardCharsets;

/** A single private session value. No paths, network, or game rules cross this bridge. */
@CapacitorPlugin(name = "LocalSession")
public class LocalSessionPlugin extends Plugin {
    private SharedPreferences preferences() {
        return getContext().getSharedPreferences("xiangqi_mobile_session", Context.MODE_PRIVATE);
    }

    @PluginMethod
    public void get(PluginCall call) {
        try {
            JSObject result = new JSObject();
            String saved = preferences().getString("session", null);
            // JSONObject removes a key for Java null; keep an explicit JSON
            // null so an empty install differs from a malformed bridge reply.
            result.put("value", saved == null ? org.json.JSONObject.NULL : saved);
            call.resolve(result);
        } catch (RuntimeException error) {
            call.reject("Could not read session", error);
        }
    }

    @PluginMethod
    public void set(PluginCall call) {
        String value = call.getString("value");
        if (value == null || value.getBytes(StandardCharsets.UTF_8).length > 512 * 1024) {
            call.reject("Invalid or oversized session");
            return;
        }
        // Capacitor invokes plugin methods on its background plugin handler, not the UI thread.
        // Resolve only after commit, rather than acknowledging an asynchronous apply().
        try {
            if (preferences().edit().putString("session", value).commit()) call.resolve();
            else call.reject("Could not persist session");
        } catch (RuntimeException error) {
            call.reject("Could not persist session", error);
        }
    }
}
