// ── SCENE ────────────────────────────────────────────────
const scene = new THREE.Scene();
const hemiLight = new THREE.HemisphereLight(0x5b9bd5, 0xffffff, 0.6);
scene.add(hemiLight);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.z = 10;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x5b9bd5);
document.body.appendChild(renderer.domElement);

// ── DICE FACE TEXTURES (canvas-generated) ────────────────
function makeFaceTex(num) {
  const sz = 256;
  const cv = document.createElement('canvas');
  cv.width = cv.height = sz;
  const c = cv.getContext('2d');

  // White background
  c.fillStyle = '#ffffff';
  c.fillRect(0, 0, sz, sz);

  // Rounded border
  c.strokeStyle = '#cccccc';
  c.lineWidth = 10;
  c.beginPath();
  const r = 24;
  c.moveTo(r, 0); c.lineTo(sz-r, 0); c.arcTo(sz,0,sz,r,r);
  c.lineTo(sz,sz-r); c.arcTo(sz,sz,sz-r,sz,r);
  c.lineTo(r,sz); c.arcTo(0,sz,0,sz-r,r);
  c.lineTo(0,r); c.arcTo(0,0,r,0,r);
  c.closePath();
  c.stroke();

  // Black dots
  c.fillStyle = '#111111';
  const m = sz*0.27, mid = sz/2, e = sz-m;
  const dots = {
    1: [[mid,mid]],
    2: [[m,m],[e,e]],
    3: [[m,m],[mid,mid],[e,e]],
    4: [[m,m],[e,m],[m,e],[e,e]],
    5: [[m,m],[e,m],[mid,mid],[m,e],[e,e]],
    6: [[m,m],[e,m],[m,mid],[e,mid],[m,e],[e,e]],
  }[num] || [];
  dots.forEach(([dx,dy]) => {
    c.beginPath();
    c.arc(dx, dy, sz*0.09, 0, Math.PI*2);
    c.fill();
  });
  return new THREE.CanvasTexture(cv);
}

// ── DICE MESH ─────────────────────────────────────────────
const materials = [1,2,3,4,5,6].map(n =>
  new THREE.MeshStandardMaterial({ map: makeFaceTex(n) })
);
const cube = new THREE.Mesh(new THREE.BoxGeometry(1.4,1.4,1.4,3,3,3), materials);
scene.add(cube);

// Ground plane
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(120,50),
  new THREE.MeshStandardMaterial({ color: 0xffffff })
);
ground.rotation.x = -Math.PI/2;
ground.position.y = -10;
scene.add(ground);

const pointLight = new THREE.PointLight(0xffffff, 1);
pointLight.position.set(5,5,10);
scene.add(pointLight);

// ── PHYSICS ───────────────────────────────────────────────
let velocity = new THREE.Vector2(0.15, 0.05);
const gravity = -0.007;
let isFrozen = false;

function getBounds() {
  const fov = camera.fov * (Math.PI/180);
  const height = 2 * Math.tan(fov/2) * camera.position.z;
  const width  = height * camera.aspect;
  return { width: width/2 - 0.5, height: height/2 - 0.5 };
}

// ── DRAG ──────────────────────────────────────────────────
const mouse = new THREE.Vector2();
let isDragging = false;
let prevPos = new THREE.Vector3(), currentPos = new THREE.Vector3(), dragOffset = new THREE.Vector3();

function screenToWorld(e) {
  mouse.x =  (e.clientX / window.innerWidth)  * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(mouse, camera);
  const planeZ = new THREE.Plane(new THREE.Vector3(0,0,1), 0);
  const point  = new THREE.Vector3();
  raycaster.ray.intersectPlane(planeZ, point);
  return point;
}

function clampPosition(obj) {
  const b = getBounds();
  obj.position.x = Math.max(-b.width,  Math.min(b.width,  obj.position.x));
  obj.position.y = Math.max(-b.height, Math.min(b.height, obj.position.y));
}

function onMouseDown(e) {
  if (isFrozen) isFrozen = false;
  isDragging = true;
  const point = screenToWorld(e);
  dragOffset.copy(point).sub(cube.position);
  prevPos.copy(cube.position);
}
function onMouseMove(e) {
  if (!isDragging) return;
  const point = screenToWorld(e);
  cube.position.copy(point.sub(dragOffset));
  clampPosition(cube);
  currentPos.copy(cube.position);
  velocity.set(currentPos.x - prevPos.x, currentPos.y - prevPos.y);
  prevPos.copy(currentPos);
}
function onMouseUp() { isDragging = false; }

window.addEventListener('mousedown', onMouseDown);
window.addEventListener('mousemove', onMouseMove);
window.addEventListener('mouseup',   onMouseUp);

// ── STOP BUTTON ───────────────────────────────────────────
document.getElementById('stopBtn').addEventListener('click', () => {
  velocity.set(0, 0);
  isFrozen = true;
  cube.position.set(0, 0, 0);
  const step = Math.PI / 2;
  cube.rotation.x = Math.round(cube.rotation.x / step) * step;
  cube.rotation.y = Math.round(cube.rotation.y / step) * step;
});

// ── SNOWFLAKES ────────────────────────────────────────────
const snowflakeCount = 300;
const snowGeometry   = new THREE.BufferGeometry();
const positions = [], speeds = [];
for (let i = 0; i < snowflakeCount; i++) {
  positions.push((Math.random()-0.5)*20, Math.random()*20-10, (Math.random()-0.5)*20);
  speeds.push(0.03 + Math.random()*0.05);
}
snowGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));

const snowCanvas = document.createElement('canvas');
snowCanvas.width = snowCanvas.height = 64;
const sc = snowCanvas.getContext('2d');
const grad = sc.createRadialGradient(32,32,0,32,32,32);
grad.addColorStop(0,   'rgba(255,255,255,1)');
grad.addColorStop(0.4, 'rgba(255,255,255,0.8)');
grad.addColorStop(1,   'rgba(255,255,255,0)');
sc.fillStyle = grad;
sc.fillRect(0,0,64,64);
const snowTex = new THREE.CanvasTexture(snowCanvas);

const snowMaterial = new THREE.PointsMaterial({
  map: snowTex, size: 0.28, transparent: true, alphaTest: 0.01
});
const snowParticles = new THREE.Points(snowGeometry, snowMaterial);
scene.add(snowParticles);

// ── ANIMATE ───────────────────────────────────────────────
function animate() {
  requestAnimationFrame(animate);

  if (!isDragging && !isFrozen) {
    velocity.y += gravity;
    cube.position.x += velocity.x;
    cube.position.y += velocity.y;

    const b = getBounds();
    if (cube.position.x >  b.width  || cube.position.x < -b.width)  velocity.x *= -1;
    if (cube.position.y < -b.height) { cube.position.y = -b.height; velocity.y *= -(0.9 + Math.random()*0.3); }
    if (cube.position.y >  b.height) { cube.position.y =  b.height; velocity.y *= -0.7; }

    cube.rotation.x += 0.025;
    cube.rotation.y += 0.04;
    cube.rotation.z += 0.01;
  }
  clampPosition(cube);

  // Animate snowflakes
  const pos = snowParticles.geometry.attributes.position.array;
  for (let i = 0; i < pos.length; i += 3) {
    pos[i+1] -= speeds[i/3];
    pos[i]   += Math.sin(Date.now()*0.0005 + i) * 0.003;
    if (pos[i+1] < -10) { pos[i+1] = 10; pos[i] = (Math.random()-0.5)*20; }
  }
  snowParticles.geometry.attributes.position.needsUpdate = true;

  renderer.render(scene, camera);
}
animate();

// ── RESIZE ────────────────────────────────────────────────
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
