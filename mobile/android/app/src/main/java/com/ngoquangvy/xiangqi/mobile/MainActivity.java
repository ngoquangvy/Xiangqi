package com.ngoquangvy.xiangqi.mobile;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(LocalSessionPlugin.class);
        registerPlugin(PikafishPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
