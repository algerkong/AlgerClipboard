/**
 * main.js
 * Handles UI interactions, scroll events, reveal animations,
 * Three.js particle background, and 2D canvas mouse trail.
 */

document.addEventListener('DOMContentLoaded', () => {

    // 1. Navbar scroll effect
    const navbar = document.querySelector('.navbar');

    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    });

    // 2. Intersection Observer for reveal animations
    const revealElements = document.querySelectorAll('.reveal');

    const revealOptions = {
        threshold: 0.15,
        rootMargin: "0px 0px -50px 0px"
    };

    const revealOnScroll = new IntersectionObserver(function (entries, observer) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
                observer.unobserve(entry.target);
            }
        });
    }, revealOptions);

    revealElements.forEach(el => {
        revealOnScroll.observe(el);
    });

    // 3. WebGL particle background
    initWebGLBackground();

    // 4. 2D Canvas mouse trail
    initMouseTrail();
});

/* =========================================================
 *  Three.js Particle Starfield Background
 * ========================================================= */
function initWebGLBackground() {
    const container = document.getElementById('webgl-canvas-container');
    if (!container || !window.THREE) return;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x030303, 0.001);

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
    camera.position.z = 800;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // Particles
    const particleCount = 2000;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);

    const baseColor = new THREE.Color(0x94a3b8);
    const accentColor = new THREE.Color(0x00FFA3);

    for (let i = 0; i < particleCount; i++) {
        const r = 1500 * Math.cbrt(Math.random());
        const theta = Math.random() * 2 * Math.PI;
        const phi = Math.acos(2 * Math.random() - 1);

        positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
        positions[i * 3 + 2] = r * Math.cos(phi);

        const mixColor = Math.random() > 0.9 ? accentColor : baseColor;
        colors[i * 3] = mixColor.r;
        colors[i * 3 + 1] = mixColor.g;
        colors[i * 3 + 2] = mixColor.b;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
        size: 2.5,
        vertexColors: true,
        transparent: true,
        opacity: 0.6,
        sizeAttenuation: true,
        blending: THREE.AdditiveBlending
    });

    const particles = new THREE.Points(geometry, material);
    scene.add(particles);

    // Mouse parallax
    let mouseX = 0, mouseY = 0;
    const halfW = window.innerWidth / 2;
    const halfH = window.innerHeight / 2;

    document.addEventListener('mousemove', (e) => {
        mouseX = e.clientX - halfW;
        mouseY = e.clientY - halfH;
    });

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    let time = 0;
    function animate() {
        requestAnimationFrame(animate);
        time += 0.001;

        camera.position.x += (mouseX * 0.1 - camera.position.x) * 0.05;
        camera.position.y += (-mouseY * 0.1 - camera.position.y) * 0.05;
        camera.lookAt(scene.position);

        particles.rotation.y = time * 0.2;
        particles.rotation.x = time * 0.1;

        renderer.render(scene, camera);
    }
    animate();
}

/* =========================================================
 *  2D Canvas Mosaic Mouse Trail
 *  Background grid-based mosaic effect with short lifespan.
 * ========================================================= */
function initMouseTrail() {
    const canvas = document.createElement('canvas');
    canvas.id = 'trail-canvas';
    // position behind the UI (z-index: -1), but above the webgl (z-index: -2)
    canvas.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;pointer-events:none;z-index:-1;';
    document.body.appendChild(canvas);

    const ctx = canvas.getContext('2d');

    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    // Grid size for mosaic
    const gridSize = 40;
    
    // Grid map to store the activation level of each cell
    const cells = new Map();

    document.addEventListener('mousemove', (e) => {
        const col = Math.floor(e.clientX / gridSize);
        const row = Math.floor(e.clientY / gridSize);
        
        // Light up the cell and its immediate neighbors to form a chunky cross/block
        const neighbors = [
            [0,0, 1.0], [-1,0, 0.6], [1,0, 0.6], [0,-1, 0.6], [0,1, 0.6],
            [-1,-1, 0.3], [1,-1, 0.3], [-1,1, 0.3], [1,1, 0.3]
        ];
        
        neighbors.forEach(([dx, dy, intensity]) => {
            const nCol = col + dx;
            const nRow = row + dy;
            const key = `${nCol},${nRow}`;
            const currentLife = cells.get(key) || 0;
            // Only increase life, avoid jumping backwards
            cells.set(key, Math.max(currentLife, intensity));
        });
    });

    function draw() {
        requestAnimationFrame(draw);

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Iterate over cells and draw them, then decay their life
        for (const [key, life] of cells.entries()) {
            // Cutoff threshold to clean up map and keep array size small
            if (life <= 0.05) {
                cells.delete(key);
                continue;
            }

            // Parse grid coordinates
            const sepIndex = key.indexOf(',');
            const col = parseInt(key.slice(0, sepIndex));
            const row = parseInt(key.slice(sepIndex + 1));

            // Draw mosaic block (emerald color, using life as opacity multiplier)
            ctx.fillStyle = `rgba(0, 255, 163, ${life * 0.3})`; // Cap opacity at 30% for a subtle background effect
            
            // Draw a square with a tiny 1px gap to emphasize the mosaic grid look
            ctx.fillRect(col * gridSize + 1, row * gridSize + 1, gridSize - 2, gridSize - 2);

            // Decay life (Fast decay: 0.85 means it disappears rapidly)
            cells.set(key, life * 0.85); 
        }
    }

    draw();
}
