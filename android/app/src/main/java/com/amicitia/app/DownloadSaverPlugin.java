package com.amicitia.app;

import android.Manifest;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStream;

@CapacitorPlugin(
    name = "DownloadSaver",
    permissions = {
        @Permission(
            alias = "storage",
            strings = { Manifest.permission.WRITE_EXTERNAL_STORAGE }
        )
    }
)
public class DownloadSaverPlugin extends Plugin {

    @PluginMethod
    public void saveFileToDownloads(PluginCall call) {
        if (requiresLegacyStoragePermission() && getPermissionState("storage") != PermissionState.GRANTED) {
            requestPermissionForAlias("storage", call, "storagePermissionCallback");
            return;
        }

        saveFile(call);
    }

    @PermissionCallback
    private void storagePermissionCallback(PluginCall call) {
        if (call == null) {
            return;
        }

        if (getPermissionState("storage") != PermissionState.GRANTED) {
            call.reject("Storage permission is required to save files to Downloads.");
            return;
        }

        saveFile(call);
    }

    private boolean requiresLegacyStoragePermission() {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.Q;
    }

    private void saveFile(PluginCall call) {
        String fileName = call.getString("fileName");
        String mimeType = call.getString("mimeType");
        String base64Data = call.getString("base64Data");
        String subdirectory = call.getString("subdirectory", "Amicitia");

        if (fileName == null || fileName.trim().isEmpty()) {
            call.reject("fileName is required");
            return;
        }

        if (mimeType == null || mimeType.trim().isEmpty()) {
            call.reject("mimeType is required");
            return;
        }

        if (base64Data == null || base64Data.trim().isEmpty()) {
            call.reject("base64Data is required");
            return;
        }

        try {
            byte[] bytes = Base64.decode(normalizeBase64(base64Data), Base64.DEFAULT);
            SaveResult result = saveWithBestAvailableStrategy(fileName, mimeType, bytes, subdirectory);

            JSObject response = new JSObject();
            response.put("uri", result.uri.toString());
            response.put("displayPath", result.displayPath);
            call.resolve(response);
        } catch (Exception ex) {
            call.reject("Failed to save file: " + ex.getMessage(), ex);
        }
    }

    private String normalizeBase64(String base64Data) {
        int commaIndex = base64Data.indexOf(',');
        if (commaIndex >= 0) {
            return base64Data.substring(commaIndex + 1);
        }
        return base64Data;
    }

    private SaveResult saveWithBestAvailableStrategy(String fileName, String mimeType, byte[] bytes, String subdirectory) throws IOException {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            try {
                return saveWithMediaStoreDownloads(fileName, mimeType, bytes, subdirectory);
            } catch (Exception ignored) {
                return saveWithMediaStoreFiles(fileName, mimeType, bytes, subdirectory);
            }
        }

        return saveWithLegacyStorage(fileName, mimeType, bytes, subdirectory);
    }

    private SaveResult saveWithMediaStoreDownloads(String fileName, String mimeType, byte[] bytes, String subdirectory) throws IOException {
        ContentResolver resolver = getContext().getContentResolver();
        ContentValues values = new ContentValues();
        values.put(MediaStore.MediaColumns.DISPLAY_NAME, fileName);
        values.put(MediaStore.MediaColumns.MIME_TYPE, mimeType);
        values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/" + subdirectory);
        values.put(MediaStore.MediaColumns.IS_PENDING, 1);

        Uri collection = MediaStore.Downloads.EXTERNAL_CONTENT_URI;
        Uri itemUri = resolver.insert(collection, values);
        if (itemUri == null) {
            throw new IOException("Could not create download entry");
        }

        try (OutputStream outputStream = resolver.openOutputStream(itemUri, "w")) {
            if (outputStream == null) {
                throw new IOException("Could not open file output stream");
            }
            outputStream.write(bytes);
            outputStream.flush();
        }

        ContentValues completedValues = new ContentValues();
        completedValues.put(MediaStore.MediaColumns.IS_PENDING, 0);
        resolver.update(itemUri, completedValues, null, null);

        return new SaveResult(itemUri, "Downloads/" + subdirectory + "/" + fileName);
    }

    private SaveResult saveWithMediaStoreFiles(String fileName, String mimeType, byte[] bytes, String subdirectory) throws IOException {
        ContentResolver resolver = getContext().getContentResolver();
        ContentValues values = new ContentValues();
        values.put(MediaStore.MediaColumns.DISPLAY_NAME, fileName);
        values.put(MediaStore.MediaColumns.MIME_TYPE, mimeType);
        values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/" + subdirectory);
        values.put(MediaStore.MediaColumns.IS_PENDING, 1);

        Uri collection = MediaStore.Files.getContentUri("external");
        Uri itemUri = resolver.insert(collection, values);
        if (itemUri == null) {
            throw new IOException("Could not create fallback download entry");
        }

        try (OutputStream outputStream = resolver.openOutputStream(itemUri, "w")) {
            if (outputStream == null) {
                throw new IOException("Could not open fallback file output stream");
            }
            outputStream.write(bytes);
            outputStream.flush();
        }

        ContentValues completedValues = new ContentValues();
        completedValues.put(MediaStore.MediaColumns.IS_PENDING, 0);
        resolver.update(itemUri, completedValues, null, null);

        return new SaveResult(itemUri, "Downloads/" + subdirectory + "/" + fileName);
    }

    private SaveResult saveWithLegacyStorage(String fileName, String mimeType, byte[] bytes, String subdirectory) throws IOException {
        File downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
        File targetDir = new File(downloadsDir, subdirectory);
        if (!targetDir.exists() && !targetDir.mkdirs()) {
            throw new IOException("Could not create target directory");
        }

        File targetFile = new File(targetDir, fileName);
        try (FileOutputStream outputStream = new FileOutputStream(targetFile)) {
            outputStream.write(bytes);
            outputStream.flush();
        }

        Uri uri = FileProvider.getUriForFile(
            getContext(),
            getContext().getPackageName() + ".fileprovider",
            targetFile
        );

        return new SaveResult(uri, "Downloads/" + subdirectory + "/" + fileName);
    }

    private static class SaveResult {
        final Uri uri;
        final String displayPath;

        SaveResult(Uri uri, String displayPath) {
            this.uri = uri;
            this.displayPath = displayPath;
        }
    }
}
