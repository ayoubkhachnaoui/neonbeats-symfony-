import { Controller } from '@hotwired/stimulus';
import * as THREE from 'three';

export default class extends Controller {
    connect() {
        this.audio = document.querySelector('audio[data-full-player-target="audio"]');
        this.container = this.element; // The controller is attached to #visualizer-container

        if (!this.audio) return;

        this.initVisualizer();
        this.animate = this.animate.bind(this);
        this.resize = this.resize.bind(this);

        window.addEventListener('resize', this.resize);
        this.animationId = requestAnimationFrame(this.animate);
    }

    disconnect() {
        if (this.animationId) cancelAnimationFrame(this.animationId);
        window.removeEventListener('resize', this.resize);

        // Cleanup Three.js
        if (this.renderer) {
            this.renderer.dispose();
            this.container.removeChild(this.renderer.domElement);
        }
        if (this.scene) {
            this.scene.clear();
        }
    }

    initVisualizer() {
        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.FogExp2(0x000000, 0.02);

        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.z = 8;
        this.camera.position.y = 3;
        this.camera.rotation.x = -0.2;

        this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.container.appendChild(this.renderer.domElement);

        // Create a wavy plane
        const geometry = new THREE.PlaneGeometry(100, 100, 50, 50);
        const material = new THREE.MeshBasicMaterial({
            color: 0xff00ff,
            wireframe: true,
            transparent: true,
            opacity: 0.3
        });

        this.terrain = new THREE.Mesh(geometry, material);
        this.terrain.rotation.x = - Math.PI / 2;
        this.scene.add(this.terrain);

        // Second plane (ceiling - mirrored)
        const ceilingMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ffff,
            wireframe: true,
            transparent: true,
            opacity: 0.15
        });
        this.ceiling = new THREE.Mesh(geometry, ceilingMaterial);
        this.ceiling.rotation.x = Math.PI / 2;
        this.ceiling.position.y = 10;
        this.scene.add(this.ceiling);

        // Store original positions for wave math
        const positionAttribute = geometry.attributes.position;
        this.count = positionAttribute.count;
        this.originalZ = new Float32Array(this.count);

        for (let i = 0; i < this.count; i++) {
            this.originalZ[i] = positionAttribute.getZ(i);
        }

        this.positionAttribute = positionAttribute;

        // Apply Colors (Randomized)
        const neonPalettes = [0x00ffff, 0xff00ff, 0x39ff14, 0xff69b4, 0x9400d3];
        const color = neonPalettes[Math.floor(Math.random() * neonPalettes.length)];
        material.color.setHex(color);
        ceilingMaterial.color.setHex(0xffffff ^ color);

        this.frame = 0;
    }

    animate() {
        this.animationId = requestAnimationFrame(this.animate);
        this.frame += 0.05;

        const isPaused = this.audio.paused;
        const intensity = isPaused ? 0.5 : 2.5;
        const speed = isPaused ? 0.2 : 0.8;

        for (let i = 0; i < this.count; i++) {
            const x = this.positionAttribute.getX(i);
            const y = this.positionAttribute.getY(i);

            const z = this.originalZ[i] +
                Math.sin(x * 0.2 + this.frame * speed) * intensity +
                Math.cos(y * 0.2 + this.frame * speed) * intensity;

            this.positionAttribute.setZ(i, z);
        }
        this.positionAttribute.needsUpdate = true;

        this.terrain.position.z = (this.frame * 5) % 2;
        this.ceiling.position.z = (this.frame * 5) % 2;

        if (!isPaused) {
            this.camera.rotation.z = Math.sin(this.frame * 0.05) * 0.05;
        }

        this.renderer.render(this.scene, this.camera);
    }

    resize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
}
