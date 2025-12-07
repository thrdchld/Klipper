package com.klipper.app;

import android.util.Log;

import com.arthenica.ffmpegkit.FFmpegKit;
import com.arthenica.ffmpegkit.FFmpegSession;
import com.arthenica.ffmpegkit.ReturnCode;
import com.arthenica.ffmpegkit.Statistics;
import com.arthenica.ffmpegkit.StatisticsCallback;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "FFmpegPlugin")
public class FFmpegPlugin extends Plugin {
    
    private static final String TAG = "FFmpegPlugin";
    
    @PluginMethod
    public void execute(PluginCall call) {
        String command = call.getString("command");
        
        if (command == null || command.isEmpty()) {
            call.reject("Command is required");
            return;
        }
        
        Log.d(TAG, "Executing FFmpeg command: " + command);
        
        // Execute FFmpeg command
        FFmpegSession session = FFmpegKit.execute(command);
        
        JSObject result = new JSObject();
        
        if (ReturnCode.isSuccess(session.getReturnCode())) {
            result.put("success", true);
            result.put("output", session.getOutput());
            call.resolve(result);
        } else if (ReturnCode.isCancel(session.getReturnCode())) {
            result.put("success", false);
            result.put("error", "Command cancelled");
            call.resolve(result);
        } else {
            String error = session.getFailStackTrace();
            result.put("success", false);
            result.put("error", error != null ? error : "Unknown error");
            call.resolve(result);
        }
    }
    
    @PluginMethod
    public void executeAsync(PluginCall call) {
        String command = call.getString("command");
        
        if (command == null || command.isEmpty()) {
            call.reject("Command is required");
            return;
        }
        
        Log.d(TAG, "Executing async FFmpeg command: " + command);
        
        FFmpegKit.executeAsync(command, session -> {
            JSObject result = new JSObject();
            
            if (ReturnCode.isSuccess(session.getReturnCode())) {
                result.put("success", true);
                result.put("output", session.getOutput());
            } else {
                String error = session.getFailStackTrace();
                result.put("success", false);
                result.put("error", error != null ? error : "Command failed");
            }
            
            notifyListeners("ffmpegComplete", result);
        }, log -> {
            // Log callback - optional
            Log.d(TAG, log.getMessage());
        }, statistics -> {
            // Statistics callback for progress
            JSObject progress = new JSObject();
            progress.put("time", statistics.getTime());
            progress.put("size", statistics.getSize());
            progress.put("bitrate", statistics.getBitrate());
            progress.put("speed", statistics.getSpeed());
            
            notifyListeners("ffmpegProgress", progress);
        });
        
        JSObject result = new JSObject();
        result.put("started", true);
        call.resolve(result);
    }
    
    @PluginMethod
    public void cancel(PluginCall call) {
        FFmpegKit.cancel();
        
        JSObject result = new JSObject();
        result.put("cancelled", true);
        call.resolve(result);
    }
}
