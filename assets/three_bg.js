import * as THREE from 'three';

const initThreeBg = () => {
    const container = document.getElementById('canvas-container');
    if (!container) return;

    // Clean up any existing canvas to prevent ghosting
    container.innerHTML = '';

    // SCENE SETUP
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 30;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    // NEBULA PARTICLES
    const particleCount = 2000;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);

    const colorPalette = [
        new THREE.Color('#06b6d4'), // Cyan
        new THREE.Color('#8b5cf6'), // Violet
        new THREE.Color('#3b82f6'), // Blue
    ];

    for (let i = 0; i < particleCount; i++) {
        positions[i * 3] = (Math.random() - 0.5) * 100;
        positions[i * 3 + 1] = (Math.random() - 0.5) * 60;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 50;

        const color = colorPalette[Math.floor(Math.random() * colorPalette.length)];
        colors[i * 3] = color.r;
        colors[i * 3 + 1] = color.g;
        colors[i * 3 + 2] = color.b;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
        size: 0.2,
        vertexColors: true,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending
    });

    const particles = new THREE.Points(geometry, material);
    scene.add(particles);

    // CLICK RIPPLE EFFECT
    const raycaster = new THREE.Raycaster();
    const ripples = [];

    const onClick = (event) => {
        const mouse = new THREE.Vector2(
            (event.clientX / window.innerWidth) * 2 - 1,
            -(event.clientY / window.innerHeight) * 2 + 1
        );
        raycaster.setFromCamera(mouse, camera);

        // Spawn ripple
        const rippleGeom = new THREE.RingGeometry(0.1, 0.2, 32);
        const rippleMat = new THREE.MeshBasicMaterial({
            color: 0x06b6d4,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.6
        });
        const ripple = new THREE.Mesh(rippleGeom, rippleMat);

        // Project to z=0 or somewhere in view
        const targetZ = 0;
        const dist = (targetZ - camera.position.z) / raycaster.ray.direction.z;
        const pos = raycaster.ray.origin.clone().add(raycaster.ray.direction.multiplyScalar(dist));

        ripple.position.copy(pos);
        ripple.lookAt(camera.position); // Face camera

        scene.add(ripple);
        ripples.push({ mesh: ripple, age: 0 });
    };
    document.addEventListener('click', onClick);

    // ANIMATION LOOP
    let time = 0;
    let animationId;
    const animate = () => {
        animationId = requestAnimationFrame(animate);
        time += 0.005;

        // Animate particles (wave effect)
        const positions = particles.geometry.attributes.position.array;
        for (let i = 0; i < particleCount; i++) {
            const x = positions[i * 3];
            // Sine wave movement
            positions[i * 3 + 1] += Math.sin(time + x * 0.1) * 0.02;
        }
        particles.geometry.attributes.position.needsUpdate = true;

        // Rotate cloud
        particles.rotation.y = time * 0.05;

        // Animate ripples
        for (let i = ripples.length - 1; i >= 0; i--) {
            const r = ripples[i];
            r.age += 0.02;
            r.mesh.scale.multiplyScalar(1.05);
            r.mesh.material.opacity = 0.6 * (1 - r.age);

            if (r.age >= 1) {
                scene.remove(r.mesh);
                r.mesh.geometry.dispose();
                r.mesh.material.dispose();
                ripples.splice(i, 1);
            }
        }

        renderer.render(scene, camera);
    };
    animate();

    // RESIZE HANDLER
    const onResize = () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', onResize);

    // CLEANUP
    const cleanup = () => {
        cancelAnimationFrame(animationId);
        document.removeEventListener('click', onClick);
        window.removeEventListener('resize', onResize);
        document.removeEventListener('turbo:before-cache', cleanup);

        if (renderer && renderer.domElement) {
            renderer.domElement.remove();
            renderer.dispose();
        }

        // Dispose geometries and materials
        geometry.dispose();
        material.dispose();
        scene.clear();
    };

    document.addEventListener('turbo:before-cache', cleanup);
};

document.addEventListener('turbo:load', () => {
    initThreeBg();
});

