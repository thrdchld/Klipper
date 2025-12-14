package com.klipper.app;

import android.os.Bundle;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Enable WebView debugging for Chrome DevTools
        WebView.setWebContentsDebuggingEnabled(true);
        
        registerPlugin(FFmpegPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
