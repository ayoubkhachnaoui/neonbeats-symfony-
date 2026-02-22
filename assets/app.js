import './stimulus_bootstrap.js';
import '@hotwired/turbo';
import './styles/app.scss';
import './three_bg.js';
import './voice_control.js';

// ===== Scroll Reveal =====
// ===== Scroll Reveal =====
const initScrollReveal = () => {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry, i) => {
            if (entry.isIntersecting) {
                // Stagger delay based on position in viewport
                setTimeout(() => {
                    entry.target.classList.add('revealed');
                }, i * 60);
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1 });

    document.querySelectorAll('.reveal-on-scroll').forEach(el => observer.observe(el));
};
document.addEventListener('turbo:load', initScrollReveal);
