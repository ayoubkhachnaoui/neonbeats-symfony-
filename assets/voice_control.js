/**
 * NeonVoice V2 - Enhanced AI Assistant
 * Features: Auto-Listen, Voice Cues (TTS), Mic Selection, Custom Wake Word, Voice Gender.
 * Upgrades: Direct Player Control (window.NeonPlayer), Fuzzy Matching (Levenshtein).
 */

const NeonVoice = (() => {
    // ── CONFIG ─────────────────────────────────────────────────────────
    const STATE = { IDLE: 'idle', ACTIVE: 'active', PROCESSING: 'processing' };
    const DISMISS_TIMEOUT_MS = 6000;

    // Default Settings
    let settings = {
        autoListen: false,
        voiceCues: true,
        micId: '',
        wakeWord: 'NeonBeats',
        voiceGender: 'female'
    };

    // ── COMMAND REGISTRY ───────────────────────────────────────────────
    // Triggers are normalized (lowercase, trimmed)
    const COMMANDS = {
        PLAY: {
            triggers: ['play', 'resume', 'start', 'begin', 'unpause', 'continue', 'go', 'play music', 'start playing', 'hit it', 'let\'s go'],
            action: () => {
                if (window.NeonPlayer) { window.NeonPlayer.play(); return 'Playing'; }
                return 'Player not ready';
            }
        },
        PAUSE: {
            triggers: ['pause', 'stop', 'halt', 'break', 'wait', 'hold on', 'quiet', 'silence', 'hush', 'mute', 'shut up'],
            action: () => {
                if (window.NeonPlayer) { window.NeonPlayer.pause(); return 'Paused'; }
                return 'Player not ready';
            }
        },
        NEXT: {
            triggers: ['next', 'skip', 'forward', 'pass', 'jump', 'next song', 'next track', 'play next', 'change song', 'another one'],
            action: () => {
                if (window.NeonPlayer) { window.NeonPlayer.playNext(); return 'Skipping'; }
                return 'Player not ready';
            }
        },
        PREVIOUS: {
            triggers: ['previous', 'back', 'go back', 'rewind', 'prev', 'last song', 'previous song', 'restart', 'go back'],
            action: () => {
                if (window.NeonPlayer) { window.NeonPlayer.playPrev(); return 'Previous track'; }
                return 'Player not ready';
            }
        },
        SHUFFLE: {
            triggers: ['shuffle', 'mix', 'mix it up', 'random', 'randomize'],
            action: () => {
                if (window.NeonPlayer) { window.NeonPlayer.toggleShuffle(); return 'Shuffling'; }
                return 'Player not ready';
            }
        },
        LOOP: {
            triggers: ['loop', 'repeat', 'again', 'cycle', 'infinite', 'one more time'],
            action: () => {
                if (window.NeonPlayer) {
                    const isLooping = window.NeonPlayer.toggleLoop();
                    return isLooping ? 'Looping enabled' : 'Looping disabled';
                }
                return 'Player not ready';
            }
        },
        VOL_UP: {
            triggers: ['volume up', 'louder', 'boost', 'turn it up', 'raise volume', 'increase volume'],
            action: () => {
                if (window.NeonPlayer) { window.NeonPlayer.volumeUp(); return 'Volume up'; }
                return 'Player not ready';
            }
        },
        VOL_DOWN: {
            triggers: ['volume down', 'quieter', 'lower', 'turn it down', 'lower volume', 'decrease volume'],
            action: () => {
                if (window.NeonPlayer) { window.NeonPlayer.volumeDown(); return 'Volume down'; }
                return 'Player not ready';
            }
        }
    };

    // ── STATE ──────────────────────────────────────────────────────────
    let recognition = null;
    let currentState = STATE.IDLE;
    let dismissTimer = null;
    let isSupported = false;
    let synth = window.speechSynthesis;
    let voices = [];

    // ── DOM REFS ───────────────────────────────────────────────────────
    const getEl = (id) => document.getElementById(id);
    const getProp = (sel) => document.querySelector(sel);

    // ── PERSISTENCE ────────────────────────────────────────────────────
    function loadSettings() {
        try {
            const saved = localStorage.getItem('neonVoiceSettings');
            if (saved) settings = { ...settings, ...JSON.parse(saved) };
        } catch (e) { console.warn('NeonVoice: Load settings failed', e); }

        updateToggleUI('autoListen', settings.autoListen);
        updateToggleUI('voiceCues', settings.voiceCues);

        const wakeInput = getEl('nv-wake-word');
        if (wakeInput) wakeInput.value = settings.wakeWord;

        const genderSelect = getEl('nv-voice-gender');
        if (genderSelect) genderSelect.value = settings.voiceGender;
    }

    function saveSettings() {
        localStorage.setItem('neonVoiceSettings', JSON.stringify(settings));
    }

    function updateToggleUI(key, value) {
        const btn = key === 'autoListen' ? getEl('nv-auto-toggle') : getEl('nv-cues-toggle');
        if (btn) {
            if (value) btn.classList.add('nv-on');
            else btn.classList.remove('nv-on');
            btn.setAttribute('aria-checked', String(value));
        }
        if (key === 'autoListen') {
            setDot(value);
            setWidgetStatus(value ? `👂 Listening for "${settings.wakeWord}"...` : 'Auto-listen off');
        }
    }

    function syncUI() {
        updateToggleUI('autoListen', settings.autoListen);
        updateToggleUI('voiceCues', settings.voiceCues);

        const wakeInput = getEl('nv-wake-word');
        if (wakeInput) wakeInput.value = settings.wakeWord;

        const genderSelect = getEl('nv-voice-gender');
        if (genderSelect) genderSelect.value = settings.voiceGender;

        // Restore active indicator if listening
        setDot(settings.autoListen);

        // Populate mic select if needed (with slight delay for DOM)
        setTimeout(populateMicDevices, 200);
    }

    // ── SETTINGS PUBLIC API ────────────────────────────────────────────
    function setWakeWord(word) {
        const clean = word.trim();
        if (clean.length > 1) {
            settings.wakeWord = clean;
            saveSettings();
            setWidgetStatus(settings.autoListen ? `👂 Listening for "${settings.wakeWord}"...` : 'Auto-listen off');
            showToast(`Wake word set to "${clean}"`);
        }
    }

    function setVoiceGender(gender) {
        settings.voiceGender = gender;
        saveSettings();
        speak(`Voice set to ${gender}`);
    }

    // ── UI HELPERS ─────────────────────────────────────────────────────
    function setDot(on) {
        const core = getEl('nv-dot-core');
        const ping = getProp('.nv-dot-ping');
        const w = getEl('nv-widget');

        if (core) core.style.background = on ? '#4ade80' : '#4b5563';
        if (ping) ping.style.opacity = on ? '0.75' : '0';
        if (w) w.classList.toggle('nv-listening', on);
    }

    function setWidgetStatus(msg) {
        const el = getEl('nv-status-widget');
        if (el) el.textContent = msg;
    }

    function showToast(msg, type = 'info') {
        const container = getEl('nv-toast-container');
        const toast = getEl('nv-toast');
        if (!container || !toast) return;

        container.classList.remove('hidden');
        toast.textContent = msg;
        setTimeout(() => { container.classList.add('hidden'); }, 3000);
    }

    function setState(newState) {
        currentState = newState;
        const ov = getEl('nv-overlay');
        if (!ov) return;

        ov.classList.remove('nv-idle', 'nv-active', 'nv-processing');
        ov.classList.add('nv-' + newState);

        if (newState === STATE.IDLE) {
            ov.classList.remove('nv-visible');
            const t = getEl('nv-transcript');
            if (t) t.textContent = '';
            getEl('nv-manual-btn')?.classList.remove('nv-active');
            setWidgetStatus(settings.autoListen ? `👂 Listening for "${settings.wakeWord}"...` : 'Auto-listen off');
        } else {
            ov.classList.add('nv-visible');
            getEl('nv-manual-btn')?.classList.add('nv-active');
        }

        const msgs = { [STATE.ACTIVE]: '🎙️ Listening...', [STATE.PROCESSING]: '⚡ Processing...' };
        const st = getEl('nv-status');
        if (st) st.textContent = msgs[newState] || '';
        setWidgetStatus(msgs[newState] || '');
    }

    // ── AUDIO CUES (TTS) ───────────────────────────────────────────────
    function loadVoices() {
        if (!synth) return;
        voices = synth.getVoices();
        synth.onvoiceschanged = () => { voices = synth.getVoices(); };
    }

    function speak(text) {
        if (!settings.voiceCues || !synth) return;

        synth.cancel();
        const u = new SpeechSynthesisUtterance(text);

        if (voices.length === 0) voices = synth.getVoices();

        let preferredVoice = null;
        const gender = settings.voiceGender.toLowerCase();

        if (gender === 'female') {
            preferredVoice = voices.find(v => v.name.includes('Female') || v.name.includes('Zira') || v.name.includes('Google US English'));
        } else {
            preferredVoice = voices.find(v => v.name.includes('Male') || v.name.includes('David'));
        }

        if (preferredVoice) u.voice = preferredVoice;
        u.volume = 0.8;
        synth.speak(u);
    }

    // ── MIC DEVICE ─────────────────────────────────────────────────────
    async function populateMicDevices() {
        const sel = getEl('nv-mic-select');
        if (!sel || !navigator.mediaDevices?.enumerateDevices) return;

        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const mics = devices.filter(d => d.kind === 'audioinput');

            sel.innerHTML = '<option value="">Default Device</option>';
            mics.forEach((mic, i) => {
                const opt = document.createElement('option');
                opt.value = mic.deviceId;
                opt.text = mic.label || `Microphone ${i + 1}`;
                if (mic.deviceId === settings.micId) opt.selected = true;
                sel.appendChild(opt);
            });
        } catch (e) { console.warn('NeonVoice: Device enum failed', e); }
    }

    function setMicDevice(deviceId) {
        settings.micId = deviceId;
        saveSettings();
        refreshEngine();
        showToast('Microphone updated');
    }

    function refreshDevices() {
        populateMicDevices();
        showToast('Refreshing devices...');
    }

    // ── FUZZY MATCHING (Levenshtein) ───────────────────────────────────
    function levenshtein(a, b) {
        if (a.length === 0) return b.length;
        if (b.length === 0) return a.length;
        const matrix = [];
        for (let i = 0; i <= b.length; i++) matrix[i] = [i];
        for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

        for (let i = 1; i <= b.length; i++) {
            for (let j = 1; j <= a.length; j++) {
                if (b.charAt(i - 1) === a.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }
        return matrix[b.length][a.length];
    }

    function findCommand(text) {
        // 1. Exact string match (Priority)
        for (const [key, cmd] of Object.entries(COMMANDS)) {
            for (const trigger of cmd.triggers) {
                if (text === trigger) return cmd;
            }
        }

        // 2. Partial match for longer phrases
        for (const [key, cmd] of Object.entries(COMMANDS)) {
            for (const trigger of cmd.triggers) {
                if (trigger.length > 5 && text.includes(trigger)) return cmd;
            }
        }

        // 3. Stricter Fuzzy Match
        const words = text.split(/\s+/);
        for (const [key, cmd] of Object.entries(COMMANDS)) {
            for (const trigger of cmd.triggers) {
                // Fuzzy only for single words and prevent false positives on common filler
                if (trigger.length < 4) continue;

                for (const word of words) {
                    const dist = levenshtein(word, trigger);
                    // ONLY 1 error allowed for long words, else exact
                    const allowed = trigger.length >= 6 ? 1 : 0;
                    if (dist <= allowed) return cmd;
                }
            }
        }

        // 4. Pattern Match: "Volume [number]" or "Set volume to [number]"
        const volMatch = text.match(/(?:set )?volume(?: to| at)?\s+(\d+)(?:%)?/);
        if (volMatch) {
            const level = parseInt(volMatch[1], 10);
            if (!isNaN(level)) {
                return {
                    action: () => {
                        if (window.NeonPlayer) {
                            window.NeonPlayer.setVolume(level / 100);
                            return `Volume set to ${level} percent`;
                        }
                        return 'Player not ready';
                    }
                };
            }
        }

        // 5. Pattern Match: "Play [song name]"
        if (text.startsWith('play ') && text.length > 5) {
            const q = text.replace(/^play\s+(track\s+|song\s+|the\s+)?/, '').trim();
            if (q.length > 1 && q !== 'music') {
                return {
                    action: () => {
                        window.location.href = '/discover?q=' + encodeURIComponent(q) + '&autoplay=1';
                        return `Playing ${q}`;
                    }
                };
            }
        }

        return null;
    }

    // ── ENGINE LOGIC ───────────────────────────────────────────────────
    function executeCommand(transcript) {
        const text = transcript.toLowerCase().trim();
        const t = getEl('nv-transcript');
        if (t) t.textContent = `"${transcript}"`;

        setState(STATE.PROCESSING);

        const cmd = findCommand(text);

        if (cmd) {
            const feedback = cmd.action();
            speak(feedback);
            showToast(feedback);
            setTimeout(() => setState(STATE.IDLE), 1000);
        } else {
            // Check if it's just silence or very short noise
            if (text.length > 1) {
                speak("I didn't catch that");
                const st = getEl('nv-status');
                if (st) st.textContent = '❓ Not recognized';
            }
            setTimeout(() => setState(STATE.IDLE), 1500);
        }
    }

    function setupRecognition() {
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SR) return false;

        recognition = new SR();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';
        recognition.maxAlternatives = 1;

        recognition.onresult = (e) => {
            let interim = '', final = '';
            for (let i = e.resultIndex; i < e.results.length; i++) {
                const r = e.results[i];
                if (r.isFinal) final += r[0].transcript;
                else interim += r[0].transcript;
            }
            const full = (final || interim).toLowerCase();

            if (currentState === STATE.IDLE && settings.autoListen) {
                const target = settings.wakeWord.toLowerCase();
                if (full.includes(target)) {
                    clearTimeout(dismissTimer);
                    setState(STATE.ACTIVE);
                    speak("Yes?");
                    dismissTimer = setTimeout(() => setState(STATE.IDLE), DISMISS_TIMEOUT_MS);
                }
            } else if (currentState === STATE.ACTIVE && final) {
                let cmdText = final.toLowerCase();
                const target = settings.wakeWord.toLowerCase();
                cmdText = cmdText.replace(new RegExp(target, 'gi'), '').trim();

                if (cmdText.length > 1) {
                    clearTimeout(dismissTimer);
                    executeCommand(cmdText);
                }
            }
        };

        recognition.onend = () => {
            if (settings.autoListen || currentState !== STATE.IDLE) {
                refreshEngine();
            }
        };

        return true;
    }

    function refreshEngine() {
        try { if (recognition) recognition.stop(); } catch (e) { }

        // Short delay to allow mic to release
        setTimeout(() => {
            try {
                if (settings.autoListen || currentState !== STATE.IDLE) {
                    recognition.start();
                }
            } catch (e) { }
        }, 300);
    }

    function toggleSetting(key) {
        settings[key] = !settings[key];
        saveSettings();
        updateToggleUI(key, settings[key]);
        if (key === 'autoListen') {
            if (settings.autoListen) refreshEngine();
            else try { recognition.stop(); } catch (e) { }
        } else if (key === 'voiceCues') {
            speak(settings.voiceCues ? "Voice cues enabled" : "");
        }
    }

    async function activate() {
        if (!isSupported) { showToast('Browser not supported'); return; }

        try {
            await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch (err) {
            showToast('Microphone access denied by browser');
            setWidgetStatus('❌ Mic access denied');
            return;
        }

        speak("Listening");
        refreshEngine();
        setState(STATE.ACTIVE);
        dismissTimer = setTimeout(() => setState(STATE.IDLE), DISMISS_TIMEOUT_MS);
    }

    function deactivate() {
        speak("Cancelled");
        clearTimeout(dismissTimer);
        setState(STATE.IDLE);
        if (!settings.autoListen) try { recognition.stop(); } catch (e) { }
    }

    async function init() {
        isSupported = setupRecognition();
        if (!isSupported) { setWidgetStatus('❌ Not supported'); return; }

        loadSettings();
        loadVoices();

        if (settings.autoListen) {
            try {
                await navigator.mediaDevices.getUserMedia({ audio: true });
                refreshEngine();
            } catch (err) {
                showToast('Auto-listen paused: Mic access denied');
                updateToggleUI('autoListen', false);
                settings.autoListen = false;
            }
        }
        // console.log('🎙️ NeonVoice V2 ready.');
    }

    return {
        init, activate, deactivate, toggleSetting,
        setMicDevice, setWakeWord, setVoiceGender, refreshDevices,
        setState, STATE, syncUI
    };
})();

window.NeonVoice = NeonVoice;

// Handle Initial Load
document.addEventListener('turbo:load', () => {
    if (!window._neonVoiceInited) {
        NeonVoice.init();
        window._neonVoiceInited = true;
    } else {
        // Just sync UI on subsequent loads
        NeonVoice.syncUI();
    }
});

// Stop recognition before cache to avoid ghost processes
document.addEventListener('turbo:before-cache', () => {
    try {
        if (NeonVoice.STATE) NeonVoice.setState(NeonVoice.STATE.IDLE);
    } catch (e) { }
});
