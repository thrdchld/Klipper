package com.klipper.app;

import android.Manifest;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.provider.OpenableColumns;
import android.provider.Settings;
import android.util.Log;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import java.io.File;
import java.io.FileInputStream;
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
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

@CapacitorPlugin(
    name = "FFmpegPlugin",
    permissions = {
        @Permission(
            alias = "storage",
            strings = {
                Manifest.permission.READ_EXTERNAL_STORAGE,
                Manifest.permission.WRITE_EXTERNAL_STORAGE
            }
        )
    }
)
public class FFmpegPlugin extends Plugin {
    
    private static final String TAG = "FFmpegPlugin";
    private static final int PERMISSION_REQUEST_CODE = 1001;
    
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
    
    @PluginMethod
    public void moveToPublic(PluginCall call) {
        String sourcePath = call.getString("source");
        String filename = call.getString("filename");
        String destFolder = call.getString("destFolder");
        
        if (sourcePath == null || sourcePath.isEmpty()) {
            call.reject("Source path is required");
            return;
        }
        
        if (filename == null || filename.isEmpty()) {
            filename = new File(sourcePath).getName();
        }
        
        Log.d(TAG, "Moving to public: " + sourcePath + " -> " + filename);
        
        try {
            File sourceFile = new File(sourcePath);
            if (!sourceFile.exists()) {
                JSObject result = new JSObject();
                result.put("success", false);
                result.put("error", "Source file not found");
                call.resolve(result);
                return;
            }
            
            // Create output directory (use custom folder or default to Movies/Klipper)
            File outputDir;
            if (destFolder != null && !destFolder.isEmpty()) {
                outputDir = new File(destFolder);
            } else {
                outputDir = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_MOVIES), "Klipper");
            }
            
            if (!outputDir.exists()) {
                outputDir.mkdirs();
            }
            
            File destFile = new File(outputDir, filename);
            
            // Copy file
            InputStream input = new FileInputStream(sourceFile);
            OutputStream output = new FileOutputStream(destFile);
            
            byte[] buffer = new byte[4096];
            int bytesRead;
            while ((bytesRead = input.read(buffer)) != -1) {
                output.write(buffer, 0, bytesRead);
            }
            
            output.close();
            input.close();
            
            // Delete source file
            sourceFile.delete();
            
            // Scan file so it appears in gallery
            MediaScannerConnection.scanFile(getContext(), 
                new String[]{destFile.getAbsolutePath()}, 
                new String[]{"video/mp4"}, 
                null);
            
            Log.d(TAG, "Moved to: " + destFile.getAbsolutePath());
            
            JSObject result = new JSObject();
            result.put("success", true);
            result.put("path", destFile.getAbsolutePath());
            call.resolve(result);
            
        } catch (Exception e) {
            Log.e(TAG, "Move failed: " + e.getMessage());
            JSObject result = new JSObject();
            result.put("success", false);
            result.put("error", e.getMessage());
            call.resolve(result);
        }
    }
    
    @PluginMethod
    public void checkStoragePermission(PluginCall call) {
        boolean hasPermission = false;
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            // Android 11+ - use MANAGE_EXTERNAL_STORAGE or scoped storage
            hasPermission = Environment.isExternalStorageManager() || 
                            ContextCompat.checkSelfPermission(getContext(), Manifest.permission.READ_EXTERNAL_STORAGE) == PackageManager.PERMISSION_GRANTED;
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            // Android 6-10
            hasPermission = ContextCompat.checkSelfPermission(getContext(), Manifest.permission.WRITE_EXTERNAL_STORAGE) == PackageManager.PERMISSION_GRANTED;
        } else {
            // Below Android 6 - permission granted at install
            hasPermission = true;
        }
        
        JSObject result = new JSObject();
        result.put("granted", hasPermission);
        result.put("androidVersion", Build.VERSION.SDK_INT);
        call.resolve(result);
    }
    
    @PluginMethod
    public void requestStoragePermission(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            // Android 11+ - Open app settings for "All Files Access" permission
            try {
                Intent intent = new Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION);
                intent.setData(Uri.parse("package:" + getContext().getPackageName()));
                getActivity().startActivity(intent);
                
                JSObject result = new JSObject();
                result.put("opened", true);
                result.put("message", "Settings opened. Please grant permission.");
                call.resolve(result);
            } catch (Exception e) {
                // Fallback to general storage settings
                try {
                    Intent intent = new Intent(Settings.ACTION_MANAGE_ALL_FILES_ACCESS_PERMISSION);
                    getActivity().startActivity(intent);
                    
                    JSObject result = new JSObject();
                    result.put("opened", true);
                    call.resolve(result);
                } catch (Exception e2) {
                    // Last fallback - open app info
                    openAppSettings(call);
                }
            }
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            // Android 6-10 - Use standard permission request
            requestPermissionForAlias("storage", call, "storagePermissionCallback");
        } else {
            JSObject result = new JSObject();
            result.put("granted", true);
            call.resolve(result);
        }
    }
    
    @PluginMethod
    public void openAppSettings(PluginCall call) {
        try {
            Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
            intent.setData(Uri.parse("package:" + getContext().getPackageName()));
            getActivity().startActivity(intent);
            
            JSObject result = new JSObject();
            result.put("opened", true);
            call.resolve(result);
        } catch (Exception e) {
            JSObject result = new JSObject();
            result.put("opened", false);
            result.put("error", e.getMessage());
            call.resolve(result);
        }
    }
    
    @PermissionCallback
    private void storagePermissionCallback(PluginCall call) {
        boolean granted = getPermissionState("storage") == com.getcapacitor.PermissionState.GRANTED;
        
        JSObject result = new JSObject();
        result.put("granted", granted);
        call.resolve(result);
    }
}
