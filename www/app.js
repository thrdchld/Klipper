// ========================================
// APPLICATION STATE
// ========================================
const AppState = {
    currentStep: 1,
    videoFile: null,
    videoURL: null,
    parts: [],
    watermark: {
        enabled: false,
        text: localStorage.getItem('watermarkText') || '',
        position: 'center'
    },
    processing: {
        isRunning: false,
        progress: 0,
        completedClips: 0,
        totalClips: 0
    }
};

// ========================================
// DOM ELEMENTS
// ========================================
const Elements = {
    // Step sections
    steps: document.querySelectorAll('.step-section'),

    // Step 1
    videoInput: document.getElementById('videoInput'),
    selectVideoBtn: document.getElementById('selectVideoBtn'),
    videoPreviewContainer: document.getElementById('videoPreviewContainer'),
    videoPreview: document.getElementById('videoPreview'),
    watermarkOverlay: document.getElementById('watermarkOverlay'),

    // Step 2
    timestampInput: document.getElementById('timestampInput'),
    timestampError: document.getElementById('timestampError'),

    // Step 3
    videoPreview3: document.getElementById('videoPreview3'),
    watermarkOverlay3: document.getElementById('watermarkOverlay3'),
    watermarkToggle: document.getElementById('watermarkToggle'),
    watermarkOptions: document.getElementById('watermarkOptions'),
    watermarkText: document.getElementById('watermarkText'),
    watermarkPosition: document.getElementById('watermarkPosition'),
    partsList: document.getElementById('partsList'),

    // Step 4
    progressBar: document.getElementById('progressFill'),
    progressText: document.getElementById('progressText'),
    clipsCompleted: document.getElementById('clipsCompleted'),
    processStatus: document.getElementById('processStatus'),
    outputPath: document.getElementById('outputPath'),

    // Navigation
    backBtn: document.getElementById('backBtn'),
    nextBtn: document.getElementById('nextBtn'),
    stepDots: document.querySelectorAll('.step-dot'),

    // Dialogs
    confirmDialog: document.getElementById('confirmDialog'),
    cancelNo: document.getElementById('cancelNo'),
    cancelYes: document.getElementById('cancelYes'),
    editDialog: document.getElementById('editDialog'),
    editStart: document.getElementById('editStart'),
    editEnd: document.getElementById('editEnd'),
    editSave: document.getElementById('editSave'),
    editCancel: document.getElementById('editCancel')
};

// ========================================
// NAVIGATION SYSTEM
// ========================================
function goToStep(step) {
    if (step < 1 || step > 4) return;

    AppState.currentStep = step;

    // Update step visibility
    Elements.steps.forEach((section, index) => {
        section.classList.toggle('active', index + 1 === step);
    });

    // Update step indicator
    Elements.stepDots.forEach((dot, index) => {
        dot.classList.toggle('active', index + 1 === step);
    });

    // Update navigation buttons
    updateNavButtons();

    // Step-specific actions
    if (step === 3) {
        if (AppState.videoURL) {
            Elements.videoPreview3.src = AppState.videoURL;
        }
        updateWatermarkDisplay();
    }

    if (step === 4) {
        prepareProcessingStep();
    }
}

function updateNavButtons() {
    const step = AppState.currentStep;

    // Back button
    if (step === 1) {
        Elements.backBtn.classList.add('hidden');
    } else {
        Elements.backBtn.classList.remove('hidden');
    }

    // Next button visibility and text
    if (step === 1) {
        Elements.nextBtn.classList.toggle('hidden', !AppState.videoFile);
        Elements.nextBtn.textContent = 'Lanjut';
        Elements.nextBtn.innerHTML = 'Lanjut<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>';
    } else if (step === 2) {
        Elements.nextBtn.classList.remove('hidden');
        Elements.nextBtn.innerHTML = 'Lanjut<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>';
    } else if (step === 3) {
        Elements.nextBtn.classList.remove('hidden');
        Elements.nextBtn.innerHTML = 'Lanjut<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>';
    } else if (step === 4) {
        Elements.nextBtn.classList.remove('hidden');
        updateProcessButtonState();
    }
}

// ========================================
// STEP 1: VIDEO SELECTION
// ========================================
Elements.selectVideoBtn.addEventListener('click', () => {
    Elements.videoInput.click();
});

Elements.videoInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Revoke old URL if exists
    if (AppState.videoURL) {
        URL.revokeObjectURL(AppState.videoURL);
    }

    AppState.videoFile = file;
    AppState.videoURL = URL.createObjectURL(file);

    // Show preview
    Elements.videoPreview.src = AppState.videoURL;
    Elements.videoPreviewContainer.classList.remove('hidden');

    updateNavButtons();
});

// ========================================
// STEP 2: TIMESTAMP PARSING
// ========================================
function parseTimestamp(timeStr) {
    // Format: HH:MM:SS or MM:SS
    const parts = timeStr.trim().split(':').map(p => parseInt(p, 10));

    if (parts.length === 2) {
        // MM:SS
        return parts[0] * 60 + parts[1];
    } else if (parts.length === 3) {
        // HH:MM:SS
        return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }

    return null;
}

function formatTimestamp(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;

    if (h > 0) {
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    } else {
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
}

function parseTimestamps() {
    const input = Elements.timestampInput.value.trim();
    if (!input) {
        showTimestampError('Mohon masukkan timestamp');
        return false;
    }

    const lines = input.split('\n').filter(line => line.trim());

    if (lines.length === 0) {
        showTimestampError('Mohon masukkan timestamp');
        return false;
    }

    if (lines.length > 20) {
        showTimestampError('Maksimal 20 part');
        return false;
    }

    const newParts = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        const match = line.match(/^(.+?)\s*-\s*(.+?)$/);

        if (!match) {
            showTimestampError(`Baris ${i + 1}: Format salah. Gunakan "HH:MM:SS - HH:MM:SS"`);
            return false;
        }

        const startTime = parseTimestamp(match[1]);
        const endTime = parseTimestamp(match[2]);

        if (startTime === null || endTime === null) {
            showTimestampError(`Baris ${i + 1}: Format waktu tidak valid`);
            return false;
        }

        if (startTime >= endTime) {
            showTimestampError(`Baris ${i + 1}: Waktu mulai harus lebih kecil dari waktu selesai`);
            return false;
        }

        newParts.push({
            id: Date.now() + i,
            start: startTime,
            end: endTime,
            startStr: formatTimestamp(startTime),
            endStr: formatTimestamp(endTime)
        });
    }

    AppState.parts = newParts;
    Elements.timestampError.classList.add('hidden');
    renderPartsList();
    return true;
}

function showTimestampError(message) {
    Elements.timestampError.textContent = message;
    Elements.timestampError.classList.remove('hidden');
}

// ========================================
// STEP 3: PREVIEW & EDITING
// ========================================

function renderPartsList() {
    Elements.partsList.innerHTML = '';

    AppState.parts.forEach((part, index) => {
        const partItem = document.createElement('div');
        partItem.className = 'part-item';
        partItem.innerHTML = `
            <div class="part-info">
                <div class="part-number">Part ${index + 1}</div>
                <div class="part-time">${part.startStr} - ${part.endStr}</div>
            </div>
            <div class="part-actions">
                <button class="part-btn" onclick="previewPart(${part.id})">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polygon points="5 3 19 12 5 21 5 3"/>
                    </svg>
                </button>
                <button class="part-btn" onclick="editPart(${part.id})">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                </button>
                <button class="part-btn danger" onclick="deletePart(${part.id})">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    </svg>
                </button>
            </div>
        `;

        Elements.partsList.appendChild(partItem);
    });
}

function previewPart(partId) {
    const part = AppState.parts.find(p => p.id === partId);
    if (part) {
        Elements.videoPreview3.currentTime = part.start;
        Elements.videoPreview3.play();
    }
}

let editingPartId = null;

function editPart(partId) {
    const part = AppState.parts.find(p => p.id === partId);
    if (!part) return;

    editingPartId = partId;
    Elements.editStart.value = part.startStr;
    Elements.editEnd.value = part.endStr;
    Elements.editDialog.classList.remove('hidden');
}

function deletePart(partId) {
    AppState.parts = AppState.parts.filter(p => p.id !== partId);
    renderPartsList();
}

// Watermark handling
Elements.watermarkToggle.addEventListener('change', (e) => {
    AppState.watermark.enabled = e.target.checked;
    Elements.watermarkOptions.classList.toggle('hidden', !e.target.checked);
    updateWatermarkDisplay();
});

Elements.watermarkText.addEventListener('input', (e) => {
    AppState.watermark.text = e.target.value;
    localStorage.setItem('watermarkText', e.target.value);
    updateWatermarkDisplay();
});

Elements.watermarkPosition.addEventListener('change', (e) => {
    AppState.watermark.position = e.target.value;
    updateWatermarkDisplay();
});

function updateWatermarkDisplay() {
    const overlays = [Elements.watermarkOverlay, Elements.watermarkOverlay3];

    overlays.forEach(overlay => {
        if (!overlay) return;

        if (AppState.watermark.enabled && AppState.watermark.text) {
            overlay.textContent = AppState.watermark.text;
            overlay.classList.remove('hidden');

            // Remove existing position classes
            overlay.classList.remove('position-top', 'position-bottom', 'position-center');
            // Add position class
            overlay.classList.add(`position-${AppState.watermark.position}`);

            // Dynamic font sizing - more aggressive for longer text
            const textLength = AppState.watermark.text.length;
            let fontSize;

            if (textLength <= 10) {
                fontSize = '16px';
            } else if (textLength <= 15) {
                fontSize = '14px';
            } else if (textLength <= 20) {
                fontSize = '12px';
            } else if (textLength <= 30) {
                fontSize = '11px';
            } else if (textLength <= 40) {
                fontSize = '10px';
            } else if (textLength <= 50) {
                fontSize = '9px';
            } else {
                fontSize = '8px';
            }

            overlay.style.fontSize = fontSize;
        } else {
            overlay.classList.add('hidden');
            overlay.style.fontSize = '';
        }
    });
}

// Load saved watermark text
if (AppState.watermark.text) {
    Elements.watermarkText.value = AppState.watermark.text;
}

// (Button removed from Step 3 - functionality moved to bottom nav)

// ========================================
// STEP 4: PROCESSING
// ========================================
function prepareProcessingStep() {
    AppState.processing = {
        isRunning: false,
        progress: 0,
        completedClips: 0,
        totalClips: AppState.parts.length
    };

    Elements.progressBar.style.width = '0%';
    Elements.progressText.textContent = '0%';
    Elements.clipsCompleted.textContent = `0 / ${AppState.parts.length}`;
    Elements.processStatus.textContent = 'Siap';
    Elements.outputPath.textContent = '/storage/emulated/0/VideoClipper/output/';
    updateProcessButtonState();
}

function updateProcessButtonState() {
    if (!AppState.processing.isRunning && AppState.processing.progress === 0) {
        Elements.nextBtn.textContent = 'Mulai Proses';
    } else if (AppState.processing.isRunning) {
        Elements.nextBtn.textContent = 'Batalkan Proses';
    } else if (AppState.processing.progress === 100) {
        Elements.nextBtn.textContent = 'Selesai';
    }
}

function handleProcessButtonClick() {
    if (!AppState.processing.isRunning && AppState.processing.progress === 0) {
        startProcessing();
    } else if (AppState.processing.isRunning) {
        showCancelConfirmation();
    } else if (AppState.processing.progress === 100) {
        resetToStep1();
    }
}

function startProcessing() {
    AppState.processing.isRunning = true;
    updateProcessButtonState();
    Elements.processStatus.textContent = 'Berjalan...';

    simulateProcessing();
}

function simulateProcessing() {
    const totalClips = AppState.parts.length;
    let currentClip = 0;

    const interval = setInterval(() => {
        if (!AppState.processing.isRunning) {
            clearInterval(interval);
            return;
        }

        // Simulate progress
        const progress = Math.min(100, AppState.processing.progress + (100 / totalClips / 10));
        AppState.processing.progress = progress;

        Elements.progressBar.style.width = `${progress}%`;
        Elements.progressText.textContent = `${Math.round(progress)}%`;

        // Update completed clips
        const completed = Math.floor((progress / 100) * totalClips);
        if (completed > currentClip) {
            currentClip = completed;
            AppState.processing.completedClips = completed;
            Elements.clipsCompleted.textContent = `${completed} / ${totalClips}`;
        }

        // Check if complete
        if (progress >= 100) {
            clearInterval(interval);
            finishProcessing();
        }
    }, 100);
}

function finishProcessing() {
    AppState.processing.isRunning = false;
    updateProcessButtonState();
    Elements.processStatus.textContent = 'Selesai';
}

function showCancelConfirmation() {
    Elements.confirmDialog.classList.remove('hidden');
}

function cancelProcessing() {
    AppState.processing.isRunning = false;
    AppState.processing.progress = 0;
    updateProcessButtonState();
    Elements.processStatus.textContent = 'Dibatalkan';
}

function resetToStep1() {
    // Reset state
    AppState.currentStep = 1;
    AppState.parts = [];
    AppState.processing = {
        isRunning: false,
        progress: 0,
        completedClips: 0,
        totalClips: 0
    };

    // Clear inputs
    Elements.timestampInput.value = '';
    Elements.partsList.innerHTML = '';

    goToStep(1);
}

// ========================================
// DIALOG HANDLERS
// ========================================
Elements.cancelNo.addEventListener('click', () => {
    Elements.confirmDialog.classList.add('hidden');
});

Elements.cancelYes.addEventListener('click', () => {
    cancelProcessing();
    Elements.confirmDialog.classList.add('hidden');
});

Elements.editCancel.addEventListener('click', () => {
    Elements.editDialog.classList.add('hidden');
    editingPartId = null;
});

Elements.editSave.addEventListener('click', () => {
    if (editingPartId === null) return;

    const startTime = parseTimestamp(Elements.editStart.value);
    const endTime = parseTimestamp(Elements.editEnd.value);

    if (startTime === null || endTime === null) {
        alert('Format waktu tidak valid');
        return;
    }

    if (startTime >= endTime) {
        alert('Waktu mulai harus lebih kecil dari waktu selesai');
        return;
    }

    const part = AppState.parts.find(p => p.id === editingPartId);
    if (part) {
        part.start = startTime;
        part.end = endTime;
        part.startStr = formatTimestamp(startTime);
        part.endStr = formatTimestamp(endTime);
        renderPartsList();
    }

    Elements.editDialog.classList.add('hidden');
    editingPartId = null;
});

// ========================================
// NAVIGATION BUTTON HANDLERS
// ========================================
Elements.backBtn.addEventListener('click', () => {
    if (AppState.currentStep > 1) {
        goToStep(AppState.currentStep - 1);
    }
});

Elements.nextBtn.addEventListener('click', () => {
    if (AppState.currentStep === 1 && AppState.videoFile) {
        goToStep(2);
    } else if (AppState.currentStep === 2) {
        if (parseTimestamps()) {
            goToStep(3);
        }
    } else if (AppState.currentStep === 3) {
        goToStep(4);
    } else if (AppState.currentStep === 4) {
        handleProcessButtonClick();
    }
});

// ========================================
// INITIALIZATION
// ========================================
function init() {
    goToStep(1);
}

// Start the app
init();
