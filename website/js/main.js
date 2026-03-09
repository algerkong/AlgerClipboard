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

    // 3. Hero title rotator
    initHeroRotator();

    // 4. WebGL particle background
    initWebGLBackground();

    // 5. 2D Canvas mouse trail
    initMouseTrail();

    // 6. Gallery mouse parallax
    initGalleryParallax();
});

/* =========================================================
 *  Hero Typewriter — Two-line fixed layout
 *
 *  Layout:
 *    Line 1 (static):  "为您记忆每一段"     ← fades on switch
 *    Line 2 (typed):   "数字碎片。|"         ← typewriter + cursor
 *
 *  Flow per slogan:
 *    1. Fade in static line + set color
 *    2. Type dynamic text char by char
 *    3. Pause to read
 *    4. Delete dynamic text char by char
 *    5. Fade out static line
 *    6. Move to next slogan
 *
 *  No layout jumps because each line has a fixed min-height
 *  and the typed line is always on its own row.
 * ========================================================= */
function initHeroRotator() {
    const wrapper = document.getElementById('hero-typewriter');
    if (!wrapper) return;

    const staticLine = wrapper.querySelector('.hero-tw-static');
    const typedText = wrapper.querySelector('.hero-tw-dynamic');
    const cursor = wrapper.querySelector('.hero-tw-cursor');

    const TYPE_SPEED = 90;
    const DELETE_SPEED = 45;
    const PAUSE_AFTER = 2400;
    const FADE_DURATION = 300;

    let slogans = [];
    let currentIndex = 0;
    let running = false;

    function getSlogans() {
        const lang = (window.i18n && window.i18n.currentLang) || 'zh-CN';
        const dict = (typeof translations !== 'undefined') && translations[lang];
        return (dict && dict.heroSlogans) || [];
    }

    function setColor(index) {
        const ci = index % 8;
        typedText.className = 'hero-tw-dynamic hero-color-' + ci;
        cursor.className = 'hero-tw-cursor hero-cursor-' + ci;
    }

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async function fadeOutStatic() {
        staticLine.classList.add('fade-out');
        await sleep(FADE_DURATION);
    }

    async function fadeInStatic(text) {
        staticLine.textContent = text;
        staticLine.classList.add('fade-out');
        // Force reflow so the fade-out state is applied before removing
        void staticLine.offsetHeight;
        staticLine.classList.remove('fade-out');
        await sleep(FADE_DURATION);
    }

    async function typeChars(text) {
        typedText.textContent = '';
        for (let i = 0; i <= text.length; i++) {
            if (!running) return;
            typedText.textContent = text.slice(0, i);
            await sleep(TYPE_SPEED);
        }
    }

    async function deleteChars() {
        const text = typedText.textContent;
        for (let i = text.length; i >= 0; i--) {
            if (!running) return;
            typedText.textContent = text.slice(0, i);
            await sleep(DELETE_SPEED);
        }
    }

    async function loop() {
        running = true;
        while (running) {
            const [staticText, dynamicText] = slogans[currentIndex];

            // Set gradient color for this slogan
            setColor(currentIndex);

            // Fade in the static line
            await fadeInStatic(staticText);
            if (!running) return;

            // Type the dynamic (colored) part
            await typeChars(dynamicText);
            if (!running) return;

            // Hold for reading
            await sleep(PAUSE_AFTER);
            if (!running) return;

            // Delete the dynamic part
            await deleteChars();
            if (!running) return;

            // Fade out the static line
            await fadeOutStatic();
            if (!running) return;

            // Next slogan
            currentIndex = (currentIndex + 1) % slogans.length;
        }
    }

    function start() {
        stop();
        slogans = getSlogans();
        if (!slogans.length) return;
        currentIndex = 0;
        staticLine.textContent = '';
        typedText.textContent = '';
        loop();
    }

    function stop() {
        running = false;
    }

    window.heroRotator = {
        setLang() {
            stop();
            setTimeout(start, 100);
        }
    };

    start();
}

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

/* =========================================================
 *  Gallery Mouse Parallax
 *  Cards shift subtly based on mouse position for depth feel.
 * ========================================================= */
function initGalleryParallax() {
    const gallery = document.querySelector('.app-gallery');
    if (!gallery) return;

    const cards = gallery.querySelectorAll('.app-card');
    const depths = [0.03, 0.05, 0.05, 0.02]; // parallax intensity per card

    let targetX = 0, targetY = 0;
    let currentX = 0, currentY = 0;

    document.addEventListener('mousemove', (e) => {
        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;
        targetX = (e.clientX - centerX) / centerX; // -1 to 1
        targetY = (e.clientY - centerY) / centerY;
    });

    function animate() {
        requestAnimationFrame(animate);

        // Smooth lerp
        currentX += (targetX - currentX) * 0.08;
        currentY += (targetY - currentY) * 0.08;

        cards.forEach((card, i) => {
            const depth = depths[i] || 0.03;
            const moveX = currentX * depth * 40;
            const moveY = currentY * depth * 20;
            card.style.setProperty('--parallax-x', moveX + 'px');
            card.style.setProperty('--parallax-y', moveY + 'px');
        });
    }

    animate();
}
