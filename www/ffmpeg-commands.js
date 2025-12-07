// FFmpeg Command Builder
// Generates FFmpeg commands for video processing
// Note: Actual FFmpeg execution requires native plugin or server-side processing

/**
 * Build FFmpeg command for 9:16 crop (portrait)
 * Centers the crop on the video
 * @param {string} inputPath 
 * @param {string} outputPath 
 * @returns {string[]} FFmpeg arguments
 */
export function buildCropCommand(inputPath, outputPath) {
    return [
        '-i', inputPath,
        '-vf', 'crop=ih*9/16:ih:(iw-ih*9/16)/2:0',
        '-c:a', 'copy',
        outputPath
    ];
}

/**
 * Build FFmpeg command for text watermark
 * @param {string} inputPath 
 * @param {string} outputPath 
 * @param {Object} watermark - {text, position, fontSize}
 * @returns {string[]} FFmpeg arguments
 */
export function buildWatermarkCommand(inputPath, outputPath, watermark) {
    const { text, position = 'center', fontSize = 24 } = watermark;

    // Calculate Y position
    let yPos;
    switch (position) {
        case 'top':
            yPos = 'h*0.15';
            break;
        case 'bottom':
            yPos = 'h*0.85-th';
            break;
        default: // center
            yPos = '(h-th)/2';
    }

    // Escape special characters in text
    const escapedText = text.replace(/'/g, "'\\''").replace(/:/g, '\\:');

    const drawtext = `drawtext=text='${escapedText}':fontsize=${fontSize}:fontcolor=white@0.6:x=(w-tw)/2:y=${yPos}:box=1:boxcolor=black@0.4:boxborderw=5`;

    return [
        '-i', inputPath,
        '-vf', drawtext,
        '-c:a', 'aac',
        outputPath
    ];
}

/**
 * Build FFmpeg command to clip video
 * @param {string} inputPath 
 * @param {string} outputPath 
 * @param {number} startSeconds 
 * @param {number} endSeconds 
 * @returns {string[]} FFmpeg arguments
 */
export function buildClipCommand(inputPath, outputPath, startSeconds, endSeconds) {
    const startTime = formatTime(startSeconds);
    const endTime = formatTime(endSeconds);

    return [
        '-i', inputPath,
        '-ss', startTime,
        '-to', endTime,
        '-c', 'copy',
        outputPath
    ];
}

/**
 * Build combined FFmpeg command (crop + watermark + clip)
 * @param {string} inputPath 
 * @param {string} outputPath 
 * @param {Object} options
 * @returns {string[]} FFmpeg arguments
 */
export function buildFullCommand(inputPath, outputPath, options) {
    const {
        startSeconds,
        endSeconds,
        watermark,   // {text, position, fontSize}
        crop = true  // Enable 9:16 crop
    } = options;

    const filters = [];

    // Add crop filter
    if (crop) {
        filters.push('crop=ih*9/16:ih:(iw-ih*9/16)/2:0');
    }

    // Add watermark filter
    if (watermark && watermark.text) {
        const { text, position = 'center', fontSize = 24 } = watermark;

        let yPos;
        switch (position) {
            case 'top': yPos = 'h*0.15'; break;
            case 'bottom': yPos = 'h*0.85-th'; break;
            default: yPos = '(h-th)/2';
        }

        const escapedText = text.replace(/'/g, "'\\''").replace(/:/g, '\\:');
        filters.push(`drawtext=text='${escapedText}':fontsize=${fontSize}:fontcolor=white@0.6:x=(w-tw)/2:y=${yPos}:box=1:boxcolor=black@0.4:boxborderw=5`);
    }

    const args = ['-i', inputPath];

    // Add time range
    if (startSeconds !== undefined) {
        args.push('-ss', formatTime(startSeconds));
    }
    if (endSeconds !== undefined) {
        args.push('-to', formatTime(endSeconds));
    }

    // Add video filters
    if (filters.length > 0) {
        args.push('-vf', filters.join(','));
    }

    // Output settings
    args.push('-c:a', 'aac');
    args.push('-preset', 'fast');
    args.push(outputPath);

    return args;
}

/**
 * Format seconds to HH:MM:SS
 * @param {number} seconds 
 * @returns {string}
 */
function formatTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Generate output filename
 * @param {string} prefix 
 * @param {number} index 
 * @returns {string}
 */
export function generateOutputFilename(prefix, index) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    return `${prefix}_part${index + 1}_${timestamp}.mp4`;
}

console.log('FFmpeg Command Builder loaded');
