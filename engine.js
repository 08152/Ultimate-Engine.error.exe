// ==========================================
// 1. MATHEMATIK & HILFSKLASSEN (Vector3, Matrix4x4)
// ==========================================
class Vector3 {
    constructor(x = 0, y = 0, z = 0) {
        this.x = x; this.y = y; this.z = z;
    }
    static add(v1, v2) { return new Vector3(v1.x + v2.x, v1.y + v2.y, v1.z + v2.z); }
    static zero() { return new Vector3(0, 0, 0); }
    static one() { return new Vector3(1, 1, 1); }
}

class Matrix4x4 {
    constructor() {
        this.m = Array(16).fill(0);
        this.identity();
    }
    identity() {
        this.m.fill(0);
        this.m[0] = 1; this.m[5] = 1; this.m[10] = 1; this.m[15] = 1;
    }
    static createProjection(fov, aspect, near, far) {
        const mat = new Matrix4x4();
        const fovRad = 1.0 / Math.tan(fov * 0.5 * Math.PI / 180);
        mat.m[0] = aspect * fovRad;
        mat.m[5] = fovRad;
        mat.m[10] = far / (far - near);
        mat.m[11] = 1.0;
        mat.m[14] = (-far * near) / (far - near);
        mat.m[15] = 0.0;
        return mat;
    }
    static createRotation(x, y, z) {
        const mat = new Matrix4x4();
        const radX = x * Math.PI / 180, radY = y * Math.PI / 180, radZ = z * Math.PI / 180;
        const cx = Math.cos(radX), sx = Math.sin(radX);
        const cy = Math.cos(radY), sy = Math.sin(radY);
        const cz = Math.cos(radZ), sz = Math.sin(radZ);
        
        mat.m[0] = cy * cz;
        mat.m[1] = cy * sz;
        mat.m[2] = -sy;
        mat.m[4] = sx * sy * cz - cx * sz;
        mat.m[5] = sx * sy * sz + cx * cz;
        mat.m[6] = sx * cy;
        mat.m[8] = cx * sy * cz + sx * sz;
        mat.m[9] = cx * sy * sz - sx * cz;
        mat.m[10] = cx * cy;
        mat.m[15] = 1.0;
        return mat;
    }
    static multiplyVector(m, v) {
        const res = new Vector3();
        res.x = v.x * m.m[0] + v.y * m.m[4] + v.z * m.m[8] + m.m[12];
        res.y = v.x * m.m[1] + v.y * m.m[5] + v.z * m.m[9] + m.m[13];
        res.z = v.x * m.m[2] + v.y * m.m[6] + v.z * m.m[10] + m.m[14];
        const w = v.x * m.m[3] + v.y * m.m[7] + v.z * m.m[11] + m.m[15];
        if (w !== 0.0) { res.x /= w; res.y /= w; res.z /= w; }
        return res;
    }
}

// ==========================================
// 2. ENGINE SYSTEME (Input, Time)
// ==========================================
class Input {
    static keys = {};
    static init() {
        window.addEventListener('keydown', e => this.keys[e.key.toLowerCase()] = true);
        window.addEventListener('keyup', e => this.keys[e.key.toLowerCase()] = false);
    }
    static getKey(key) { return !!this.keys[key.toLowerCase()]; }
}

class Time {
    static deltaTime = 0;
    static time = 0;
}

// ==========================================
// 3. UNITY ARCHITEKTUR: COMPONENT SYSTEM
// ==========================================
class Component {
    constructor() { this.gameObject = null; }
    awake() {}
    start() {}
    update() {}
    get transform() { return this.gameObject.transform; }
}

class Transform extends Component {
    constructor() {
        super();
        this.position = Vector3.zero();
        this.rotation = Vector3.zero();
        this.scale = Vector3.one();
    }
}

class MeshFilter extends Component {
    constructor() {
        super();
        this.vertices = [];
        this.faces = []; // Indizes der Vertices für Dreiecke/Quads
    }
}

class MeshRenderer extends Component {
    constructor() {
        super();
        this.color = '#00ff99';
    }
}

// ==========================================
// 4. UNITY ARCHITEKTUR: GAMEOBJECT SYSTEM
// ==========================================
class GameObject {
    constructor(name = "New GameObject") {
        this.name = name;
        this.components = [];
        this.transform = this.addComponent(Transform);
    }

    addComponent(ComponentClass) {
        const comp = new ComponentClass();
        comp.gameObject = this;
        this.components.push(comp);
        return comp;
    }

    getComponent(ComponentClass) {
        return this.components.find(c => c instanceof ComponentClass) || null;
    }
}

// ==========================================
// 5. UNITY ARCHITEKTUR: SCENE SYSTEM & RENDERING
// ==========================================
class Scene {
    constructor(name) {
        this.name = name;
        this.gameObjects = [];
    }
    addGameObject(go) { this.gameObjects.push(go); }
}

class Renderer3D {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.resize();
        window.addEventListener('resize', () => this.resize());
        this.matProj = Matrix4x4.createProjection(90, this.canvas.height / this.canvas.width, 0.1, 1000);
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.matProj = Matrix4x4.createProjection(90, this.canvas.height / this.canvas.width, 0.1, 1000);
    }

    clear() {
        this.ctx.fillStyle = '#111111';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    renderScene(scene) {
        this.clear();
        
        for (const go of scene.gameObjects) {
            const meshFilter = go.getComponent(MeshFilter);
            const meshRenderer = go.getComponent(MeshRenderer);
            
            if (!meshFilter || !meshRenderer) continue;

            const matRot = Matrix4x4.createRotation(go.transform.rotation.x, go.transform.rotation.y, go.transform.rotation.z);
            
            // Render Faces (Software Rasterizer / Wireframe Projection)
            for (const face of meshFilter.faces) {
                const projectedPoints = [];
                let behindCamera = false;

                for (const idx of face) {
                    let localVert = meshFilter.vertices[idx];
                    
                    // 1. Scale
                    let v = new Vector3(localVert.x * go.transform.scale.x, localVert.y * go.transform.scale.y, localVert.z * go.transform.scale.z);
                    // 2. Rotate
                    v = Matrix4x4.multiplyVector(matRot, v);
                    // 3. Translate (Position) + Kamera Offset (Z nach hinten verschieben)
                    v = Vector3.add(v, go.transform.position);
                    v.z += 4; // Statische Kamera-Distanz

                    if (v.z <= 0) { behindCamera = true; break; }

                    // 4. Projektion Matrix
                    let proj = Matrix4x4.multiplyVector(this.matProj, v);
                    
                    // 5. Screen Space Transformation
                    proj.x = (proj.x + 1.0) * 0.5 * this.canvas.width;
                    proj.y = (1.0 - proj.y) * 0.5 * this.canvas.height;
                    projectedPoints.push(proj);
                }

                if (behindCamera) continue;

                // Zeichne Linien
                this.ctx.strokeStyle = meshRenderer.color;
                this.ctx.lineWidth = 2;
                this.ctx.beginPath();
                this.ctx.moveTo(projectedPoints[0].x, projectedPoints[0].y);
                for (let i = 1; i < projectedPoints.length; i++) {
                    this.ctx.lineTo(projectedPoints[i].x, projectedPoints[i].y);
                }
                this.ctx.closePath();
                this.ctx.stroke();
            }
        }
    }
}

// ==========================================
// 6. CUSTOM GAME CODE (Custom Component)
// ==========================================
class CubeController extends Component {
    start() {
        this.transform.position = new Vector3(0, 0, 0);
    }
    update() {
        // Kontinuierliche Rotation im Raum
        this.transform.rotation.y += 30 * Time.deltaTime;
        this.transform.rotation.x += 15 * Time.deltaTime;

        // Input-Abfrage wie in Unity
        if (Input.getKey('arrowup') || Input.getKey('w')) this.transform.rotation.x -= 100 * Time.deltaTime;
        if (Input.getKey('arrowdown') || Input.getKey('s')) this.transform.rotation.x += 100 * Time.deltaTime;
        if (Input.getKey('arrowleft') || Input.getKey('a')) this.transform.rotation.y -= 100 * Time.deltaTime;
        if (Input.getKey('arrowright') || Input.getKey('d')) this.transform.rotation.y += 100 * Time.deltaTime;
    }
}

// ==========================================
// 7. ENGINE CORE & GAME LOOP
// ==========================================
class Engine {
    constructor() {
        Input.init();
        this.renderer = new Renderer3D('gameCanvas');
        this.activeScene = new Scene("Main Scene");
        this.lastTime = 0;
        this.fpsContainer = document.getElementById('fps-counter');
        this.fpsTimer = 0;
    }

    start() {
        // Start-Lifecycle für alle Entities aufrufen
        for (const go of this.activeScene.gameObjects) {
            for (const comp of go.components) comp.start();
        }
        requestAnimationFrame((t) => this.loop(t));
    }

    loop(timestamp) {
        // Zeitberechnung (DeltaTime)
        if (!this.lastTime) this.lastTime = timestamp;
        Time.deltaTime = (timestamp - this.lastTime) / 1000;
        Time.time = timestamp / 1000;
        this.lastTime = timestamp;

        // FPS Counter aktualisieren
        this.fpsTimer += Time.deltaTime;
        if (this.fpsTimer >= 0.5) {
            this.fpsContainer.innerText = Math.round(1 / Time.deltaTime);
            this.fpsTimer = 0;
        }

        // 1. Update Loop (Unity Lifecycle)
        for (const go of this.activeScene.gameObjects) {
            for (const comp of go.components) comp.update();
        }

        // 2. Render Loop
        this.renderer.renderScene(this.activeScene);

        requestAnimationFrame((t) => this.loop(t));
    }
}

// ==========================================
// 8. INITIALISIERUNG & SCENE SETUP
// ==========================================
const engine = new Engine();

// Erzeuge 3D Würfel GameObject
const cube = new GameObject("PlayerCube");

// Mesh Daten zuweisen (Würfel Vertices)
const mf = cube.addComponent(MeshFilter);
mf.vertices = [
new Vector3(-1, -1, -1), new Vector3(1, -1, -1), new Vector3(1, 1, -1), new Vector3(-1, 1, -1),
new Vector3(-1, -1, 1), new Vector3(1, -1, 1), new Vector3(1, 1, 1), new Vector3(-1, 1, 1)
];
mf.faces = [, [1, 5, 6, 2], [5, 4, 7, 6], [4, 0, 3, 7], [3, 2, 6, 7], [4, 5, 1, 0]
];

// Renderer & Custom Component anhängen
cube.addComponent(MeshRenderer);
cube.addComponent(CubeController);

// GameObject der Scene hinzufügen und Engine starten
engine.activeScene.addGameObject(cube);
engine.start();

