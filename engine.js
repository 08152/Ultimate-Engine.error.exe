// ==========================================
// 1. ENGINE SYSTEME & UTILITIES (Input, Time)
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
// 2. UNITY ARCHITEKTUR: COMPONENT SYSTEM
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
        this.position = { x: 0, y: 0, z: 0 };
        this.rotation = { x: 0, y: 0, z: 0 };
        this.scale = { x: 1, y: 1, z: 1 };
    }
}

class MeshRenderer extends Component {
    constructor() {
        super();
        this.mesh = null;
    }

    createBox(width, height, depth, color = 0x00ff99) {
        // Nutzt die geladenen Core-Komponenten aus dem globalen THREE-Namensraum
        const geometry = new THREE.BoxGeometry(width, height, depth);
        const material = new THREE.MeshStandardMaterial({ color: color, roughness: 0.4 });
        this.mesh = new THREE.Mesh(geometry, material);
        
        Engine.Instance.renderer3D.scene.add(this.mesh);
    }

    update() {
        if (!this.mesh) return;
        // Synchronisation der logischen GameEngine-Werte mit dem Three.js Render-Objekt
        this.mesh.position.set(this.transform.position.x, this.transform.position.y, this.transform.position.z);
        this.mesh.rotation.set(
            THREE.MathUtils.degToRad(this.transform.rotation.x),
            THREE.MathUtils.degToRad(this.transform.rotation.y),
            THREE.MathUtils.degToRad(this.transform.rotation.z)
        );
        this.mesh.scale.set(this.transform.scale.x, this.transform.scale.y, this.transform.scale.z);
    }
}

// ==========================================
// 3. UNITY ARCHITEKTUR: GAMEOBJECT SYSTEM
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

class Scene {
    constructor(name) {
        this.name = name;
        this.gameObjects = [];
    }
    addGameObject(go) { this.gameObjects.push(go); }
}

// ==========================================
// 4. MINI-RENDERER WRAPPER
// ==========================================
class Renderer3D {
    constructor() {
        this.scene = new THREE.Scene();
        this.scene.background = null;

        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(0, 4, 7);
        this.camera.lookAt(0, 0, 0);

        this.webGLRenderer = new THREE.WebGLRenderer({ antialias: true });
        this.webGLRenderer.setSize(window.innerWidth, window.innerHeight);
        document.body.appendChild(this.webGLRenderer.domElement);

        this.setupLights();
        window.addEventListener('resize', () => this.onWindowResize());
    }

    setupLights() {
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(5, 10, 7);
        this.scene.add(dirLight);
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.webGLRenderer.setSize(window.innerWidth, window.innerHeight);
    }

    render() {
        this.webGLRenderer.render(this.scene, this.camera);
    }
}

// ==========================================
// 5. GAMEPLAY LOGIK (Custom Component)
// ==========================================
class PlayerController extends Component {
    update() {
        // Kontinuierliche Rotation im Raum
        this.transform.rotation.y += 45 * Time.deltaTime;
        this.transform.rotation.x += 15 * Time.deltaTime;

        // Bewegung über Input (WASD / Pfeiltasten)
        const moveSpeed = 5.0;
        if (Input.getKey('arrowup') || Input.getKey('w')) this.transform.position.z -= moveSpeed * Time.deltaTime;
        if (Input.getKey('arrowdown') || Input.getKey('s')) this.transform.position.z += moveSpeed * Time.deltaTime;
        if (Input.getKey('arrowleft') || Input.getKey('a')) this.transform.position.x -= moveSpeed * Time.deltaTime;
        if (Input.getKey('arrowright') || Input.getKey('d')) this.transform.position.x += moveSpeed * Time.deltaTime;
    }
}

// ==========================================
// 6. ENGINE CORE & GAME LOOP
// ==========================================
class Engine {
    static Instance = null;

    constructor() {
        Engine.Instance = this;
        Input.init();
        this.renderer3D = new Renderer3D();
        this.activeScene = new Scene("Main Scene");
        this.clock = new THREE.Clock();
        this.fpsContainer = document.getElementById('fps-counter');
        this.fpsTimer = 0;
    }

    start() {
        // Gitterboden zur Orientierung im 3D-Raum
        const gridHelper = new THREE.GridHelper(20, 20, 0x555555, 0x333333);
        gridHelper.position.y = -1;
        this.renderer3D.scene.add(gridHelper);

        for (const go of this.activeScene.gameObjects) {
            for (const comp of go.components) comp.start();
        }
        
        this.renderer3D.webGLRenderer.setAnimationLoop(() => this.loop());
    }

    loop() {
        Time.deltaTime = this.clock.getDelta();
        Time.time = this.clock.getElapsedTime();

        this.fpsTimer += Time.deltaTime;
        if (this.fpsTimer >= 0.5) {
            this.fpsContainer.innerText = Math.round(1 / Time.deltaTime);
            this.fpsTimer = 0;
        }

        for (const go of this.activeScene.gameObjects) {
            for (const comp of go.components) comp.update();
        }

        this.renderer3D.render();
    }
}

// ==========================================
// 7. INITIALISIERUNG
// ==========================================
const engine = new Engine();

const player = new GameObject("PlayerCube");
const meshRenderer = player.addComponent(MeshRenderer);
meshRenderer.createBox(1.5, 1.5, 1.5, 0x00ff99);
player.addComponent(PlayerController);

engine.activeScene.addGameObject(player);
engine.start();
