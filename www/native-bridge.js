// Native Bridge - Connects web frontend to Capacitor native plugins
// This module provides native file picking and processing capabilities

import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { FilePicker } from '@capawesome/capacitor-file-picker';

// Check if running on native platform
export const isNative = Capacitor.isNativePlatform();

/**
 * Pick a video file using native file picker
 * @returns {Promise<{path: string, name: string, mimeType: string, blob: Blob}>}
 */
export async function pickVideoFile() {
    if (!isNative) {
        // Fallback for web - use standard file input
        return new Promise((resolve, reject) => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'video/*';
            input.onchange = (e) => {
                const file = e.target.files[0];
                if (file) {
                    resolve({
                        path: URL.createObjectURL(file),
                        name: file.name,
                        mimeType: file.type,
                        blob: file,
                        isWeb: true
                    });
                } else {
                    reject(new Error('No file selected'));
                }
            };
            input.click();
        });
    }

    // Native file picker
    const result = await FilePicker.pickVideos({
        limit: 1
    });

    if (result.files.length === 0) {
        throw new Error('No video selected');
    }

    const file = result.files[0];
    return {
        path: file.path,
        name: file.name,
        mimeType: file.mimeType,
        size: file.size,
        isWeb: false
    };
}

/**
 * Create output directory for clips
 * @returns {Promise<string>} Output directory path
 */
export async function createOutputDirectory() {
    if (!isNative) {
        return '/output'; // Mock for web
    }

    const dirName = 'KlipperOutput';

    try {
        await Filesystem.mkdir({
            path: dirName,
            directory: Directory.Documents,
            recursive: true
        });
    } catch (e) {
        // Directory might already exist
        console.log('Directory exists or error:', e);
    }

    return `${Directory.Documents}/${dirName}`;
}

/**
 * Write a file to storage
 * @param {string} filename 
 * @param {string} data - Base64 encoded data
 * @returns {Promise<string>} File path
 */
export async function saveFile(filename, data) {
    if (!isNative) {
        // Web fallback - trigger download
        const link = document.createElement('a');
        link.href = data;
        link.download = filename;
        link.click();
        return filename;
    }

    const result = await Filesystem.writeFile({
        path: `KlipperOutput/${filename}`,
        data: data,
        directory: Directory.Documents
    });

    return result.uri;
}

/**
 * Get video duration (seconds)
 * @param {string} videoPath 
 * @returns {Promise<number>}
 */
export function getVideoDuration(videoPath) {
    return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.onloadedmetadata = () => {
            resolve(video.duration);
        };
        video.onerror = reject;
        video.src = videoPath;
    });
}

console.log('Native Bridge loaded. Platform:', isNative ? 'Native' : 'Web');
