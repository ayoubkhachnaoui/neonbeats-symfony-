import { Controller } from '@hotwired/stimulus';
// No 'Turbo' import needed if global, but we use it via window usually

export default class extends Controller {
    static targets = ["playBtn", "progress", "progressHandle", "currentTime", "duration", "albumArt", "audio"];
    static values = {
        trackId: String,
        trackUrl: String,
        trackTitle: String,
        trackArtist: String,
        trackCover: String
    };

    connect() {
        // --- BIND METHODS ---
        this.updatePlayState = this.updatePlayState.bind(this);
        this.updateDuration = this.updateDuration.bind(this);
        this.syncUI = this.syncUI.bind(this);

        this.viewCounted = false;

        if (this.hasAudioTarget) {
            this.globalPlayer = this.audioTarget;
            this.setupListeners();
            // Bind for voice assistant
            window.NeonPlayer = this;

            // Force duration update if audio is already loaded
            if (this.globalPlayer.readyState > 0) {
                this.updateDuration();
            }
        } else {
            console.error('Local audio target not found');
        }
    }

    setupListeners() {
        // Sync with local player
        this.syncInterval = setInterval(this.syncUI, 200);

        // Event Listeners
        this.globalPlayer.addEventListener('play', () => {
            this.updatePlayState();

            // View count tracking (5 seconds of playback)
            if (!this.viewCounted) {
                this.viewCountTimer = setTimeout(() => {
                    this.viewCounted = true;
                    fetch(`/api/track/${this.trackIdValue}/play`, { method: 'POST' })
                        .then(res => res.json())
                        .then(data => {
                            // Update play counters on the page
                            if (data.plays) {
                                const counters = document.querySelectorAll(`.play-count-${this.trackIdValue}`);
                                counters.forEach(c => c.textContent = data.plays);
                            }
                        })
                        .catch(e => console.error('Error updating play count:', e));
                }, 5000);
            }
        });

        this.globalPlayer.addEventListener('pause', () => {
            this.updatePlayState();
            if (this.viewCountTimer) {
                clearTimeout(this.viewCountTimer);
            }
        });

        this.globalPlayer.addEventListener('loadedmetadata', this.updateDuration);
        this.globalPlayer.addEventListener('timeupdate', this.syncUI);

        // Auto play next song when current finishes
        this.globalPlayer.addEventListener('ended', () => {
            if (!this.globalPlayer.loop) {
                const nextBtn = document.getElementById('btn-next');
                if (nextBtn && nextBtn.href) {
                    window.location.href = nextBtn.href;
                }
            }
        });
    }

    disconnect() {
        clearInterval(this.syncInterval);
        if (this.viewCountTimer) {
            clearTimeout(this.viewCountTimer);
        }

        // PAUSE AUDIO when navigating away to prevent overlapping
        if (this.globalPlayer) {
            this.globalPlayer.pause();
            this.globalPlayer.currentTime = 0;

            // CRITICAL FIX: Turbo caches the DOM. If we clone an node with "autoplay", it'll start playing 
            // in the background the moment it's cached or restored! We must completely strip its life source.
            this.globalPlayer.removeAttribute('autoplay');
            this.globalPlayer.removeAttribute('src');
            this.globalPlayer.load(); // Flush the buffer
        }

        if (window.NeonPlayer === this) {
            delete window.NeonPlayer;
        }
    }

    toggle() {
        if (!this.globalPlayer) return;

        if (this.globalPlayer.paused) {
            this.globalPlayer.play().catch(e => console.warn('Play prevented:', e));
        } else {
            this.globalPlayer.pause();
        }
        this.updatePlayState();
    }

    play() {
        if (this.globalPlayer && this.globalPlayer.paused) {
            this.globalPlayer.play().catch(e => console.warn('Play prevented:', e));
            this.updatePlayState();
        }
    }

    pause() {
        if (this.globalPlayer && !this.globalPlayer.paused) {
            this.globalPlayer.pause();
            this.updatePlayState();
        }
    }

    playNext() {
        const nextBtn = document.getElementById('btn-next');
        if (nextBtn && nextBtn.href) {
            window.location.href = nextBtn.href;
        }
    }

    playPrev() {
        const prevBtn = document.getElementById('btn-prev');
        if (prevBtn && prevBtn.href) {
            window.location.href = prevBtn.href;
        }
    }

    // --- UI UPDATES ---

    updatePlayState() {
        if (!this.hasPlayBtnTarget) return;
        const icon = this.playBtnTarget.querySelector('i');
        const art = this.hasAlbumArtTarget ? this.albumArtTarget : null;

        if (this.globalPlayer.paused) {
            if (icon) {
                icon.classList.remove('fa-pause');
                icon.classList.add('fa-play', 'ml-1'); // adjust margin for play icon center
            }
            if (art) art.style.animationPlayState = 'paused';
        } else {
            if (icon) {
                icon.classList.add('fa-pause');
                icon.classList.remove('fa-play', 'ml-1');
            }
            if (art) art.style.animationPlayState = 'running';
        }
    }

    syncUI() {
        if (!this.globalPlayer) return;

        const currentTime = this.globalPlayer.currentTime;
        const duration = this.globalPlayer.duration;

        // Progress Bar
        if (this.hasProgressTarget && isFinite(duration) && duration > 0) {
            const percent = (currentTime / duration) * 100;
            this.progressTarget.style.width = `${percent}%`;
            if (this.hasProgressHandleTarget) {
                this.progressHandleTarget.style.left = `${percent}%`;
            }
        }

        // Time Display
        if (this.hasCurrentTimeTarget) {
            this.currentTimeTarget.textContent = this.formatTime(currentTime);
        }
    }

    updateDuration() {
        if (this.hasDurationTarget && this.globalPlayer && isFinite(this.globalPlayer.duration)) {
            this.durationTarget.textContent = this.formatTime(this.globalPlayer.duration);
        }
    }

    seek(event) {
        // We need the width of the progress container
        // The event currentTarget should be the container
        const rect = event.currentTarget.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const width = rect.width;
        const percent = Math.min(Math.max(0, x / width), 1);

        if (this.globalPlayer && isFinite(this.globalPlayer.duration)) {
            this.globalPlayer.currentTime = percent * this.globalPlayer.duration;
        }
    }

    // --- Public API for Voice Assistant ---
    volumeUp() {
        if (this.globalPlayer) this.globalPlayer.volume = Math.min(1, this.globalPlayer.volume + 0.1);
    }

    volumeDown() {
        if (this.globalPlayer) this.globalPlayer.volume = Math.max(0, this.globalPlayer.volume - 0.1);
    }

    setVolume(value) {
        if (this.globalPlayer) {
            const vol = Math.max(0, Math.min(1, value));
            this.globalPlayer.volume = vol;
        }
    }

    toggleShuffle() {
        // Implement shuffle logic if there's a playlist queue
        document.dispatchEvent(new CustomEvent('neon:toggle-shuffle'));
    }

    toggleLoop(event) {
        if (this.globalPlayer) {
            this.globalPlayer.loop = !this.globalPlayer.loop;

            // Toggle UI button color if triggered from DOM
            if (event && event.currentTarget) {
                const icon = event.currentTarget.querySelector('i');
                if (this.globalPlayer.loop) {
                    event.currentTarget.classList.replace('text-gray-500', 'text-fuchsia-400');
                } else {
                    event.currentTarget.classList.replace('text-fuchsia-400', 'text-gray-500');
                }
            }
            return this.globalPlayer.loop;
        }
        return false;
    }

    // Formatting
    formatTime(seconds) {
        if (isNaN(seconds)) return "0:00";
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    }
}
