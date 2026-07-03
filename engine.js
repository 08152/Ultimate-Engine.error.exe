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
        this.position = new THREE.Vector3(0, 0, 0);
        this.rotation = new THREE.Vector3(0, 0, 0);
        this.scale = new THREE.Vector3(1, 1, 1);
    }
}

// Koppelt ein Three.js Mesh an ein Unity GameObject
class MeshRenderer extends Component {
    constructor() {
        super();
        this.mesh = null;
    }

    createBox(width, height, depth, color = 0x00ff99) {
        const geometry = new THREE.BoxGeometry(width, height, depth);
        const material = new THREE.MeshStandardMaterial({ color: color, roughness: 0.4 });
        this.mesh = new THREE.Mesh(geometry, material);
        
        // Dem globalen Three.js Scene-Graph hinzufügen
        engine.renderer3D.scene.add(this.mesh);
    }

    update() {
        if (!this.mesh) return;
        // Synchronisiere die logischen Transform-Werte mit dem Three.js Mesh
        this.mesh.position.copy(this.transform.position);
        this.mesh.rotation.set(
            THREE.MathUtils.degToRad(this.transform.rotation.x),
            THREE.MathUtils.degToRad(this.transform.rotation.y),
            THREE.MathUtils.degToRad(this.transform.rotation.z)
        );
        this.mesh.scale.copy(this.transform.scale);
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

// ==========================================
// 4. UNITY ARCHITEKTUR: SCENE SYSTEM
// ==========================================
class Scene {
    constructor(name) {
        this.name = name;
        this.gameObjects = [];
    }
    addGameObject(go) { this.gameObjects.push(go); }
}

// ==========================================
// 5. THREE.JS WRAPPER (Renderer & Environment)
// ==========================================
class Renderer3D {
    constructor() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x111111);

        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(0, 4, 7); // Leicht angehoben für bessere Sicht
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
// 6. CUSTOM GAME CODE (Gameplay Script)
// ==========================================
class PlayerController extends Component {
    start() {
        this.transform.position.set(0, 0, 0);
    }

    update() {
        // Kontinuierliche Eigenrotation
        this.transform.rotation.y += 45 * Time.deltaTime;
        this.transform.rotation.x += 15 * Time.deltaTime;

        // Bewegung über Input-Abfrage (WASD / Pfeiltasten)
        const moveSpeed = 5.0;
        if (Input.getKey('arrowup') || Input.getKey('w')) this.transform.position.z -= moveSpeed * Time.deltaTime;
        if (Input.getKey('arrowdown') || Input.getKey('s')) this.transform.position.z += moveSpeed * Time.deltaTime;
        if (Input.getKey('arrowleft') || Input.getKey('a')) this.transform.position.x -= moveSpeed * Time.deltaTime;
        if (Input.getKey('arrowright') || Input.getKey('d')) this.transform.position.x += moveSpeed * Time.deltaTime;
    }
}

class EnvironmentSetup {
    static createGrid(scene) {
        const gridHelper = new THREE.GridHelper(20, 20, 0x555555, 0x333333);
        gridHelper.position.y = -1; // Leicht unter dem Würfel platziert
        scene.add(gridHelper);
    }
}

// ==========================================
// 7. ENGINE CORE & GAME LOOP
// ==========================================
class Engine {
    constructor() {
        Input.init();
        this.renderer3D = new Renderer3D();
        this.activeScene = new Scene("Main Scene");
        this.clock = new THREE.Clock();
        this.fpsContainer = document.getElementById('fps-counter');
        this.fpsTimer = 0;
    }

    start() {
        EnvironmentSetup.createGrid(this.renderer3D.scene);

        // Erst den Awake/Start-Lifecycle für alle Komponenten aufrufen
        for (const go of this.activeScene.gameObjects) {
            for (const comp of go.components) comp.start();
        }
        
        // Loop starten
        this.renderer3D.webGLRenderer.setAnimationLoop(() => this.loop());
    }

    loop() {
        Time.deltaTime = this.clock.getDelta();
        Time.time = this.clock.getElapsedTime();

        // FPS-Anzeige aktualisieren
        this.fpsTimer += Time.deltaTime;
        if (this.fpsTimer >= 0.5) {
            this.fpsContainer.innerText = Math.round(1 / Time.deltaTime);
            this.fpsTimer = 0;
        }

        // Update Logik & Synchronisation
        for (const go of this.activeScene.gameObjects) {
            for (const comp of go.components) comp.update();
        }

        // Zeichnen
        this.renderer3D.render();
    }
}

// ==========================================
// 8. INITIALISIERUNG & SCENE SETUP
// ==========================================
const engine = new Engine();

// 1. GameObject erstellen
const player = new GameObject("PlayerCube");

// 2. MeshRenderer hinzufügen und Box ERZEUGEN
const meshRenderer = player.addComponent(MeshRenderer);
meshRenderer.createBox(1.5, 1.5, 1.5, 0x00ff99); // Würfel wird direkt initialisiert

// 3. Controller-Skript für Logik und Input anhängen
player.addComponent(PlayerController);

// 4. Der Engine übergeben und starten
engine.activeScene.addGameObject(player);
engine.start();
