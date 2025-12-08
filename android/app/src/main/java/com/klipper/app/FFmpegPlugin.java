package com.klipper.app;

import android.content.ContentResolver;
import android.database.Cursor;
import android.net.Uri;
import android.provider.OpenableColumns;
import android.util.Log;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;

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
    public void copyToCache(PluginCall call) {
        String contentUri = call.getString("uri");
        
        if (contentUri == null || contentUri.isEmpty()) {
            call.reject("URI is required");
            return;
        }
        
        Log.d(TAG, "Copying to cache: " + contentUri);
        
        try {
            Uri uri = Uri.parse(contentUri);
            ContentResolver resolver = getContext().getContentResolver();
            
            // Get filename
            String filename = "input_video.mp4";
            Cursor cursor = resolver.query(uri, null, null, null, null);
            if (cursor != null && cursor.moveToFirst()) {
                int nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                if (nameIndex >= 0) {
                    filename = cursor.getString(nameIndex);
                }
                cursor.close();
            }
            
            // Copy to cache
            File cacheDir = getContext().getCacheDir();
            File outputFile = new File(cacheDir, "ffmpeg_input_" + System.currentTimeMillis() + ".mp4");
            
            InputStream input = resolver.openInputStream(uri);
            OutputStream output = new FileOutputStream(outputFile);
            
            byte[] buffer = new byte[4096];
            int bytesRead;
            while ((bytesRead = input.read(buffer)) != -1) {
                output.write(buffer, 0, bytesRead);
            }
            
            output.close();
            input.close();
            
            Log.d(TAG, "Copied to: " + outputFile.getAbsolutePath());
            
            JSObject result = new JSObject();
            result.put("success", true);
            result.put("path", outputFile.getAbsolutePath());
            result.put("originalName", filename);
            call.resolve(result);
            
        } catch (Exception e) {
            Log.e(TAG, "Copy failed: " + e.getMessage());
            JSObject result = new JSObject();
            result.put("success", false);
            result.put("error", e.getMessage());
            call.resolve(result);
        }
    }
    
    @PluginMethod
    public void execute(PluginCall call) {
        String command = call.getString("command");
        
        if (command == null || command.isEmpty()) {
            call.reject("Command is required");
            return;
        }
        
        Log.d(TAG, "Executing FFmpeg command: " + command);
        
        try {
            // Execute FFmpeg command
            FFmpegSession session = FFmpegKit.execute(command);
            
            JSObject result = new JSObject();
            int returnCode = session.getReturnCode().getValue();
            String output = session.getOutput();
            
            result.put("returnCode", returnCode);
            result.put("logs", output != null ? output : "");
            
            if (ReturnCode.isSuccess(session.getReturnCode())) {
                result.put("success", true);
                result.put("output", output);
                Log.d(TAG, "FFmpeg success. Output: " + (output != null ? output.substring(0, Math.min(500, output.length())) : "null"));
            } else if (ReturnCode.isCancel(session.getReturnCode())) {
                result.put("success", false);
                result.put("error", "Command cancelled");
                Log.d(TAG, "FFmpeg cancelled");
            } else {
                String stackTrace = session.getFailStackTrace();
                String errorMsg = "FFmpeg failed with return code " + returnCode;
                
                if (stackTrace != null && !stackTrace.isEmpty()) {
                    errorMsg += ": " + stackTrace;
                } else if (output != null && !output.isEmpty()) {
                    // Get last 500 chars of output for error message
                    int start = Math.max(0, output.length() - 500);
                    errorMsg += ". Output: " + output.substring(start);
                }
                
                result.put("success", false);
                result.put("error", errorMsg);
                Log.e(TAG, "FFmpeg failed: " + errorMsg);
            }
            
            call.resolve(result);
            
        } catch (Exception e) {
            Log.e(TAG, "FFmpeg exception: " + e.getMessage());
            JSObject result = new JSObject();
            result.put("success", false);
            result.put("error", "Exception: " + e.getMessage());
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
