import { Canvas, useFrame } from "@react-three/fiber";
import { PointerLockControls } from "@react-three/drei";
import {
  CatmullRomCurve3,
  CanvasTexture,
  DoubleSide,
  MeshStandardMaterial,
  PCFShadowMap,
  RepeatWrapping,
  Shape,
  ShapeGeometry,
  SRGBColorSpace,
  TubeGeometry,
  Vector3,
} from "three";
import { useEffect, useMemo, useRef } from "react";
import {
  ROOM_BOUNDS,
  ROOM_SCALE,
  roomLayouts,
  scaleRoomFurniture,
  scaleRoomPoint,
} from "./roomLayouts";
import DevilModel from "./Devil";

const PLAYER_RADIUS = 0.34;
const START_POSITION = scaleRoomPoint({ x: 0, z: 1.6 });
const BOOK_COLORS = ["#6e2929", "#244334", "#87652e", "#292d46", "#5a382a", "#783d52"];

function isBlocked(x, z, furniture) {
  if (x < ROOM_BOUNDS.minX || x > ROOM_BOUNDS.maxX || z < ROOM_BOUNDS.minZ || z > ROOM_BOUNDS.maxZ) {
    return true;
  }

  return furniture.some((item) => (
    Math.abs(x - item.x) < item.width / 2 + PLAYER_RADIUS
    && Math.abs(z - item.z) < item.depth / 2 + PLAYER_RADIUS
  ));
}

function createCanvasTexture(painter, repeat = [1, 1]) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  painter(canvas.getContext("2d"), canvas.width, canvas.height);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.repeat.set(repeat[0], repeat[1]);
  texture.anisotropy = 4;
  return texture;
}

function createMansionTextures() {
  const woodPainter = (context, width, height) => {
    const gradient = context.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, "#b99b78");
    gradient.addColorStop(0.5, "#947353");
    gradient.addColorStop(1, "#c2a27d");
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);

    for (let row = 0; row < 8; row += 1) {
      const y = row * 64;
      context.fillStyle = row % 2 ? "rgba(20, 10, 7, .27)" : "rgba(210, 156, 100, .1)";
      context.fillRect(0, y, width, 3);
      for (let line = 0; line < 16; line += 1) {
        const x = ((line * 71 + row * 29) % width);
        context.beginPath();
        context.moveTo(x, y + 5);
        context.bezierCurveTo(x + 24, y + 18, x - 16, y + 43, x + 17, y + 59);
        context.strokeStyle = line % 3 ? "rgba(18, 10, 7, .22)" : "rgba(224, 172, 115, .16)";
        context.lineWidth = line % 4 === 0 ? 2 : 1;
        context.stroke();
      }
    }
  };

  const plasterPainter = (context, width, height) => {
    context.fillStyle = "#a39889";
    context.fillRect(0, 0, width, height);
    for (let index = 0; index < 1800; index += 1) {
      const x = (index * 97) % width;
      const y = (index * 193) % height;
      context.fillStyle = index % 2 ? "rgba(24, 19, 20, .1)" : "rgba(245, 227, 198, .12)";
      context.fillRect(x, y, 1 + (index % 4), 1 + (index % 3));
    }
    context.strokeStyle = "rgba(26, 22, 23, .16)";
    context.lineWidth = 2;
    for (let x = 35; x < width; x += 117) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x + 8, height);
      context.stroke();
    }
  };

  const stonePainter = (context, width, height) => {
    context.fillStyle = "#342d30";
    context.fillRect(0, 0, width, height);
    const blockHeight = 64;
    for (let row = 0; row < 8; row += 1) {
      const offset = row % 2 ? -48 : 0;
      for (let column = -1; column < 5; column += 1) {
        const x = column * 128 + offset;
        const shade = 88 + ((row * 19 + column * 11 + 40) % 38);
        context.fillStyle = `rgb(${shade}, ${shade - 5}, ${shade - 2})`;
        context.fillRect(x + 2, row * blockHeight + 2, 124, blockHeight - 4);
        context.fillStyle = "rgba(12, 10, 12, .55)";
        context.fillRect(x, row * blockHeight, 128, 3);
        context.fillRect(x, row * blockHeight, 3, blockHeight);
        context.fillStyle = "rgba(205, 178, 142, .12)";
        context.fillRect(x + 5, row * blockHeight + 5, 116, 2);
      }
    }
  };

  const portraitPainter = (context, width, height) => {
    const background = context.createLinearGradient(0, 0, width, height);
    background.addColorStop(0, "#3a2525");
    background.addColorStop(1, "#11141b");
    context.fillStyle = background;
    context.fillRect(0, 0, width, height);
    context.fillStyle = "rgba(211, 166, 100, .2)";
    context.beginPath();
    context.ellipse(width / 2, height * 0.44, width * 0.34, height * 0.36, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#141114";
    context.beginPath();
    context.ellipse(width / 2, height * 0.42, width * 0.17, height * 0.25, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#9c7951";
    context.beginPath();
    context.ellipse(width / 2, height * 0.42, width * 0.105, height * 0.17, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#21191a";
    context.beginPath();
    context.ellipse(width * 0.47, height * 0.41, 5, 3, 0, 0, Math.PI * 2);
    context.ellipse(width * 0.54, height * 0.41, 5, 3, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#171214";
    context.beginPath();
    context.moveTo(width * 0.24, height);
    context.quadraticCurveTo(width * 0.28, height * 0.68, width / 2, height * 0.65);
    context.quadraticCurveTo(width * 0.75, height * 0.68, width * 0.78, height);
    context.fill();
    context.strokeStyle = "rgba(191, 154, 111, .36)";
    context.lineWidth = 4;
    context.strokeRect(12, 12, width - 24, height - 24);
  };

  return {
    floor: createCanvasTexture(woodPainter, [3, 4]),
    wood: createCanvasTexture(woodPainter, [1, 1]),
    plaster: createCanvasTexture(plasterPainter, [2, 1]),
    stone: createCanvasTexture(stonePainter, [2, 1]),
    portrait: createCanvasTexture(portraitPainter),
  };
}

function ArchBeam({ z, material }) {
  const geometry = useMemo(() => {
    const curve = new CatmullRomCurve3([
      new Vector3(-4.75, 2.85, z),
      new Vector3(-3.9, 3.45, z),
      new Vector3(-2.6, 3.85, z),
      new Vector3(0, 4.02, z),
      new Vector3(2.6, 3.85, z),
      new Vector3(3.9, 3.45, z),
      new Vector3(4.75, 2.85, z),
    ]);
    return new TubeGeometry(curve, 32, 0.095, 8, false);
  }, [z]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh geometry={geometry} material={material} castShadow receiveShadow />
  );
}

function GothicWindow({ item, stainedMaterial, woodMaterial }) {
  const geometry = useMemo(() => {
    const shape = new Shape();
    const width = item.width * 0.72;
    const height = item.height * 0.82;
    shape.moveTo(-width / 2, 0);
    shape.lineTo(-width / 2, height * 0.62);
    shape.quadraticCurveTo(-width / 2, height * 0.78, 0, height);
    shape.quadraticCurveTo(width / 2, height * 0.78, width / 2, height * 0.62);
    shape.lineTo(width / 2, 0);
    shape.closePath();
    return new ShapeGeometry(shape);
  }, [item.height, item.width]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <group position={[item.x, 0.78, item.z]}>
      <mesh geometry={geometry} position={[0, 0.15, 0]}>
        <primitive object={stainedMaterial} attach="material" />
      </mesh>
      <mesh geometry={geometry} position={[0, 0.15, 0.035]} scale={1.08}>
        <meshStandardMaterial color="#6e5234" wireframe side={DoubleSide} />
      </mesh>
      <mesh position={[0, item.height * 0.45, 0.055]}>
        <boxGeometry args={[0.07, item.height * 0.8, 0.08]} />
        <primitive object={woodMaterial} attach="material" />
      </mesh>
      <mesh position={[0, item.height * 0.47, 0.06]}>
        <boxGeometry args={[item.width * 0.65, 0.055, 0.08]} />
        <primitive object={woodMaterial} attach="material" />
      </mesh>
    </group>
  );
}

function Candle({ position, scale = 1 }) {
  const flame = useRef(null);
  const light = useRef(null);

  useFrame(({ clock }) => {
    const time = clock.getElapsedTime();
    if (flame.current) {
      flame.current.scale.y = 0.88 + Math.sin(time * 17 + position[0]) * 0.16;
      flame.current.rotation.z = Math.sin(time * 11 + position[2]) * 0.12;
    }
    if (light.current) light.current.intensity = 1.7 + Math.sin(time * 13 + position[0]) * 0.35;
  });

  return (
    <group position={position} scale={scale}>
      <mesh castShadow position={[0, 0.13, 0]}>
        <cylinderGeometry args={[0.075, 0.09, 0.26, 10]} />
        <meshStandardMaterial color="#b4a17d" roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.285, 0]}>
        <cylinderGeometry args={[0.012, 0.012, 0.045, 6]} />
        <meshStandardMaterial color="#171316" />
      </mesh>
      <mesh ref={flame} position={[0, 0.36, 0]}>
        <sphereGeometry args={[0.045, 10, 10]} />
        <meshStandardMaterial color="#ff9d38" emissive="#ff6a13" emissiveIntensity={4} />
      </mesh>
      <pointLight ref={light} position={[0, 0.48, 0]} color="#ff9b43" intensity={1.8} distance={3.5} />
    </group>
  );
}

function WallSconce({ position, rotation = [0, 0, 0] }) {
  return (
    <group position={position} rotation={rotation}>
      <mesh castShadow>
        <boxGeometry args={[0.16, 0.38, 0.12]} />
        <meshStandardMaterial color="#30221b" roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.17, 0.11]}>
        <cylinderGeometry args={[0.09, 0.07, 0.22, 8]} />
        <meshStandardMaterial color="#b19a74" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.33, 0.11]}>
        <sphereGeometry args={[0.07, 10, 10]} />
        <meshStandardMaterial color="#ffad54" emissive="#ff7a21" emissiveIntensity={4} />
      </mesh>
      <pointLight position={[0, 0.48, 0.25]} color="#ff983b" intensity={1.6} distance={4.5} />
    </group>
  );
}

function Portrait({ item, portraitTexture, woodMaterial }) {
  const frame = 0.085;
  const z = item.depth / 2;

  return (
    <group position={[item.x, item.height / 2 + 0.55, item.z]}>
      <mesh castShadow>
        <boxGeometry args={[item.width, item.height, item.depth]} />
        <primitive object={woodMaterial} attach="material" />
      </mesh>
      <mesh position={[0, 0, z + 0.012]}>
        <planeGeometry args={[item.width - frame * 2, item.height - frame * 2]} />
        <meshStandardMaterial map={portraitTexture} roughness={0.96} />
      </mesh>
      {[
        [0, item.height / 2 - frame / 2, item.width, frame],
        [0, -item.height / 2 + frame / 2, item.width, frame],
        [-item.width / 2 + frame / 2, 0, frame, item.height],
        [item.width / 2 - frame / 2, 0, frame, item.height],
      ].map(([x, y, width, height], index) => (
        <mesh key={index} castShadow position={[x, y, z + 0.035]}>
          <boxGeometry args={[width, height, 0.075]} />
          <meshStandardMaterial color="#684526" map={woodMaterial.map} roughness={0.62} metalness={0.12} />
        </mesh>
      ))}
    </group>
  );
}

function Bookshelf({ item, woodMaterial }) {
  const levels = [0.38, 0.84, 1.3, 1.76, 2.22];

  return (
    <group position={[item.x, 0, item.z]}>
      <mesh castShadow receiveShadow position={[0, item.height / 2, -item.depth / 2 + 0.045]}>
        <boxGeometry args={[item.width, item.height, 0.09]} />
        <meshStandardMaterial color="#302119" map={woodMaterial.map} roughness={0.88} />
      </mesh>
      {[-item.width / 2 + 0.06, item.width / 2 - 0.06].map((x) => (
        <mesh key={x} castShadow position={[x, item.height / 2, 0]}>
          <boxGeometry args={[0.12, item.height, item.depth]} />
          <primitive object={woodMaterial} attach="material" />
        </mesh>
      ))}
      {levels.map((y) => (
        <mesh key={y} castShadow receiveShadow position={[0, y, 0]}>
          <boxGeometry args={[item.width, 0.09, item.depth]} />
          <primitive object={woodMaterial} attach="material" />
        </mesh>
      ))}
      {levels.slice(0, -1).map((level, row) => Array.from({ length: 6 }, (_, index) => {
        const width = 0.085 + ((index + row) % 3) * 0.015;
        const height = 0.28 + ((index * 3 + row) % 4) * 0.035;
        const x = -item.width / 2 + 0.14 + index * 0.115;
        return (
          <group key={`${row}-${index}`} position={[x, level + 0.045 + height / 2, 0.04]}>
            <mesh castShadow>
              <boxGeometry args={[width, height, item.depth * 0.68]} />
              <meshStandardMaterial color={BOOK_COLORS[(index + row * 2) % BOOK_COLORS.length]} roughness={0.9} />
            </mesh>
            <mesh position={[0, 0, item.depth * 0.34 + 0.004]}>
              <boxGeometry args={[width * 0.72, 0.018, 0.008]} />
              <meshStandardMaterial color="#c0a475" metalness={0.2} roughness={0.6} />
            </mesh>
          </group>
        );
      }))}
    </group>
  );
}

function Table({ item, woodMaterial, includeCandle = false }) {
  const top = item.height;
  const legHeight = top - 0.13;
  const legX = item.width / 2 - 0.1;
  const legZ = item.depth / 2 - 0.1;

  return (
    <group position={[item.x, 0, item.z]}>
      <mesh castShadow receiveShadow position={[0, top - 0.06, 0]}>
        <boxGeometry args={[item.width, 0.13, item.depth]} />
        <primitive object={woodMaterial} attach="material" />
      </mesh>
      {[-legX, legX].flatMap((x) => [-legZ, legZ].map((z) => (
        <mesh key={`${x}-${z}`} castShadow position={[x, legHeight / 2, z]}>
          <boxGeometry args={[0.13, legHeight, 0.13]} />
          <primitive object={woodMaterial} attach="material" />
        </mesh>
      )))}
      <mesh castShadow position={[0, top - 0.22, 0]}>
        <boxGeometry args={[item.width * 0.82, 0.16, item.depth * 0.72]} />
        <meshStandardMaterial color="#35231a" map={woodMaterial.map} roughness={0.9} />
      </mesh>
      {includeCandle && <Candle position={[-0.42, top + 0.005, 0]} scale={0.72} />}
      {includeCandle && (
        <mesh castShadow position={[0.35, top + 0.16, -0.06]}>
          <dodecahedronGeometry args={[0.19, 0]} />
          <meshStandardMaterial color="#807363" roughness={0.75} />
        </mesh>
      )}
    </group>
  );
}

function Desk({ item, woodMaterial }) {
  const legHeight = item.height - 0.14;

  return (
    <group position={[item.x, 0, item.z]}>
      <mesh castShadow receiveShadow position={[0, item.height - 0.07, 0]}>
        <boxGeometry args={[item.width, 0.14, item.depth]} />
        <primitive object={woodMaterial} attach="material" />
      </mesh>
      {[-1, 1].flatMap((x) => [-1, 1].map((z) => (
        <mesh key={`${x}-${z}`} castShadow position={[x * (item.width / 2 - 0.12), legHeight / 2, z * (item.depth / 2 - 0.12)]}>
          <boxGeometry args={[0.14, legHeight, 0.14]} />
          <primitive object={woodMaterial} attach="material" />
        </mesh>
      )))}
      <mesh castShadow position={[0, item.height - 0.29, item.depth / 2 - 0.04]}>
        <boxGeometry args={[item.width * 0.58, 0.34, 0.12]} />
        <meshStandardMaterial color="#39271c" map={woodMaterial.map} roughness={0.82} />
      </mesh>
      <mesh position={[0, item.height - 0.29, item.depth / 2 + 0.03]}>
        <boxGeometry args={[0.18, 0.025, 0.035]} />
        <meshStandardMaterial color="#b49a67" metalness={0.55} roughness={0.35} />
      </mesh>
      <mesh castShadow position={[-0.38, item.height + 0.012, -0.12]} rotation={[0, -0.12, 0]}>
        <boxGeometry args={[0.4, 0.035, 0.28]} />
        <meshStandardMaterial color="#74362c" roughness={0.9} />
      </mesh>
      <mesh position={[-0.38, item.height + 0.034, -0.12]}>
        <boxGeometry args={[0.34, 0.008, 0.23]} />
        <meshStandardMaterial color="#c0ae8c" roughness={0.95} />
      </mesh>
      <Candle position={[0.52, item.height, -0.1]} scale={0.75} />
    </group>
  );
}

function Chair({ item, woodMaterial }) {
  return (
    <group position={[item.x, 0, item.z]}>
      <mesh castShadow position={[0, 0.49, 0]}>
        <boxGeometry args={[item.width, 0.13, item.depth]} />
        <primitive object={woodMaterial} attach="material" />
      </mesh>
      {[-0.24, 0.24].flatMap((x) => [-0.23, 0.23].map((z) => (
        <mesh key={`${x}-${z}`} castShadow position={[x, 0.24, z]}>
          <boxGeometry args={[0.075, 0.48, 0.075]} />
          <primitive object={woodMaterial} attach="material" />
        </mesh>
      )))}
      <mesh castShadow position={[0, 0.96, -0.25]}>
        <boxGeometry args={[item.width, 0.82, 0.11]} />
        <primitive object={woodMaterial} attach="material" />
      </mesh>
      <mesh position={[0, 0.96, -0.185]}>
        <boxGeometry args={[item.width * 0.56, 0.06, 0.025]} />
        <meshStandardMaterial color="#a47c52" roughness={0.72} />
      </mesh>
    </group>
  );
}

function Pew({ item, woodMaterial }) {
  return (
    <group position={[item.x, 0, item.z]}>
      <mesh castShadow receiveShadow position={[0, 0.48, 0]}>
        <boxGeometry args={[item.width, 0.16, item.depth]} />
        <primitive object={woodMaterial} attach="material" />
      </mesh>
      {[-item.width / 2 + 0.13, item.width / 2 - 0.13].map((x) => (
        <mesh key={x} castShadow position={[x, 0.24, 0]}>
          <boxGeometry args={[0.13, 0.48, item.depth - 0.14]} />
          <primitive object={woodMaterial} attach="material" />
        </mesh>
      ))}
      <mesh castShadow position={[0, 0.94, -item.depth * 0.42]}>
        <boxGeometry args={[item.width, 0.76, 0.14]} />
        <primitive object={woodMaterial} attach="material" />
      </mesh>
      <mesh castShadow position={[0, 0.8, -item.depth * 0.42 - 0.08]}>
        <boxGeometry args={[item.width * 0.6, 0.12, 0.045]} />
        <meshStandardMaterial color="#98734c" roughness={0.78} />
      </mesh>
    </group>
  );
}

function Altar({ item, woodMaterial }) {
  return (
    <group position={[item.x, 0, item.z]}>
      <mesh castShadow receiveShadow position={[0, 0.44, 0]}>
        <boxGeometry args={[item.width * 0.74, 0.88, item.depth * 0.72]} />
        <meshStandardMaterial color="#393238" map={woodMaterial.map} roughness={0.82} />
      </mesh>
      <mesh castShadow position={[0, 0.94, 0]}>
        <boxGeometry args={[item.width, 0.18, item.depth]} />
        <primitive object={woodMaterial} attach="material" />
      </mesh>
      <mesh castShadow position={[0, 1.08, 0]}>
        <boxGeometry args={[item.width * 0.92, 0.055, item.depth * 0.9]} />
        <meshStandardMaterial color="#b49a67" metalness={0.32} roughness={0.56} />
      </mesh>
      <mesh position={[0, 1.5, -0.08]}>
        <boxGeometry args={[0.1, 0.75, 0.08]} />
        <meshStandardMaterial color="#b49a67" metalness={0.45} roughness={0.5} />
      </mesh>
      <mesh position={[0, 1.58, -0.08]}>
        <boxGeometry args={[0.44, 0.09, 0.08]} />
        <meshStandardMaterial color="#b49a67" metalness={0.45} roughness={0.5} />
      </mesh>
      <Candle position={[-0.62, 1.04, 0]} scale={0.9} />
      <Candle position={[0.62, 1.04, 0]} scale={0.9} />
    </group>
  );
}

function Coat({ item }) {
  return (
    <group position={[item.x, 0.03, item.z]} rotation={[0, -0.4, -0.18]}>
      <mesh castShadow rotation={[0, 0, Math.PI / 2]}>
        <capsuleGeometry args={[0.24, 0.45, 5, 10]} />
        <meshStandardMaterial color={item.color} roughness={0.98} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} castShadow position={[side * 0.37, 0.04, 0]} rotation={[0, 0, side * 0.85]}>
          <capsuleGeometry args={[0.1, 0.42, 4, 8]} />
          <meshStandardMaterial color="#35282a" roughness={0.98} />
        </mesh>
      ))}
      <mesh castShadow position={[0, 0.12, 0.22]} rotation={[0.2, 0, 0]}>
        <coneGeometry args={[0.18, 0.28, 4]} />
        <meshStandardMaterial color="#342426" roughness={0.98} />
      </mesh>
    </group>
  );
}

function Papers({ item }) {
  return (
    <group position={[item.x, 0.03, item.z]}>
      {[-1, 0, 1].map((index) => (
        <mesh key={index} castShadow position={[index * 0.13, index * 0.018, index * -0.08]} rotation={[-Math.PI / 2, 0, index * 0.18]}>
          <planeGeometry args={[0.42, 0.58]} />
          <meshStandardMaterial color={index === 0 ? "#c4b391" : "#8f8067"} roughness={0.96} side={DoubleSide} />
        </mesh>
      ))}
    </group>
  );
}

function Candelabrum({ item, woodMaterial }) {
  return (
    <group position={[item.x, 0, item.z]}>
      <mesh castShadow position={[0, 0.08, 0]}>
        <cylinderGeometry args={[0.28, 0.32, 0.16, 12]} />
        <meshStandardMaterial color="#564637" metalness={0.62} roughness={0.42} />
      </mesh>
      <mesh castShadow position={[0, 0.67, 0]}>
        <cylinderGeometry args={[0.075, 0.12, 1.1, 10]} />
        <meshStandardMaterial color="#67523c" metalness={0.55} roughness={0.48} />
      </mesh>
      <mesh castShadow position={[0, 1.25, 0]}>
        <boxGeometry args={[0.76, 0.08, 0.12]} />
        <primitive object={woodMaterial} attach="material" />
      </mesh>
      {[-0.32, 0, 0.32].map((x) => (
        <Candle key={x} position={[x, 1.28, 0]} scale={0.82} />
      ))}
    </group>
  );
}

function Pedestal({ item, woodMaterial }) {
  return (
    <group position={[item.x, 0, item.z]}>
      <mesh castShadow receiveShadow position={[0, item.height / 2, 0]}>
        <cylinderGeometry args={[item.width * 0.34, item.width * 0.44, item.height, 8]} />
        <primitive object={woodMaterial} attach="material" />
      </mesh>
      <mesh castShadow position={[0, item.height + 0.08, 0]}>
        <cylinderGeometry args={[item.width * 0.52, item.width * 0.52, 0.16, 10]} />
        <meshStandardMaterial color="#6a4930" map={woodMaterial.map} roughness={0.68} />
      </mesh>
      <mesh castShadow position={[0, item.height + 0.42, 0]}>
        <dodecahedronGeometry args={[0.24, 1]} />
        <meshStandardMaterial color="#736955" roughness={0.7} metalness={0.1} />
      </mesh>
    </group>
  );
}

function FallenBook({ item }) {
  return (
    <group position={[item.x, 0.08, item.z]} rotation={[-0.12, 0.38, 0]}>
      <mesh castShadow>
        <boxGeometry args={[item.width, item.height, item.depth]} />
        <meshStandardMaterial color={item.color} roughness={0.85} />
      </mesh>
      <mesh position={[0, item.height / 2 + 0.006, 0]}>
        <boxGeometry args={[item.width * 0.84, 0.012, item.depth * 0.84]} />
        <meshStandardMaterial color="#c9b894" roughness={0.95} />
      </mesh>
      <mesh position={[0, item.height / 2 + 0.014, 0]}>
        <boxGeometry args={[item.width * 0.7, 0.003, 0.012]} />
        <meshStandardMaterial color="#756553" roughness={0.95} />
      </mesh>
    </group>
  );
}

function FurnitureModel({ item, textures }) {
  const woodMaterial = useMemo(() => new MeshStandardMaterial({
    color: item.color || "#65452f",
    map: textures.wood,
    roughness: 0.84,
    bumpMap: textures.wood,
    bumpScale: 0.035,
  }), [item.color, textures.wood]);
  const stainedGlassMaterial = useMemo(() => new MeshStandardMaterial({
    color: "#53627f",
    emissive: "#15233d",
    emissiveIntensity: 0.35,
    transparent: true,
    opacity: 0.86,
    side: DoubleSide,
  }), []);

  useEffect(() => () => {
    woodMaterial.dispose();
    stainedGlassMaterial.dispose();
  }, [stainedGlassMaterial, woodMaterial]);

  switch (item.type) {
    case "portrait":
      return <Portrait item={item} portraitTexture={textures.portrait} woodMaterial={woodMaterial} />;
    case "wardrobe":
      return (
        <group position={[item.x, item.height / 2, item.z]}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[item.width, item.height, item.depth]} />
            <primitive object={woodMaterial} attach="material" />
          </mesh>
          <mesh castShadow position={[0, 0, item.depth / 2 + 0.045]}>
            <boxGeometry args={[item.width * 0.86, item.height * 0.88, 0.1]} />
            <meshStandardMaterial color="#493024" map={textures.wood} roughness={0.62} />
          </mesh>
          {[-1, 1].map((side) => (
            <mesh key={side} position={[side * 0.025, 0, item.depth / 2 + 0.101]}>
              <boxGeometry args={[0.028, item.height * 0.84, 0.035]} />
              <meshStandardMaterial color="#a47c52" roughness={0.6} />
            </mesh>
          ))}
          {[-0.12, 0.12].map((x) => (
            <mesh key={x} position={[x, 0, item.depth / 2 + 0.13]}>
              <boxGeometry args={[0.018, item.height * 0.82, 0.025]} />
              <meshStandardMaterial color="#2a1b17" roughness={0.75} />
            </mesh>
          ))}
          <mesh position={[0.29, -0.04, item.depth / 2 + 0.16]}>
            <sphereGeometry args={[0.035, 8, 8]} />
            <meshStandardMaterial color="#c0a16c" metalness={0.72} roughness={0.32} />
          </mesh>
        </group>
      );
    case "bookshelf":
      return <Bookshelf item={item} woodMaterial={woodMaterial} />;
    case "desk":
      return <Desk item={item} woodMaterial={woodMaterial} />;
    case "table":
      return <Table item={item} woodMaterial={woodMaterial} includeCandle={item.name === "console"} />;
    case "chair":
      return <Chair item={item} woodMaterial={woodMaterial} />;
    case "pew":
      return <Pew item={item} woodMaterial={woodMaterial} />;
    case "altar":
      return <Altar item={item} woodMaterial={woodMaterial} />;
    case "coat":
      return <Coat item={item} />;
    case "papers":
      return <Papers item={item} />;
    case "book":
      return <FallenBook item={item} />;
    case "pedestal":
      return <Pedestal item={item} woodMaterial={woodMaterial} />;
    case "candelabrum":
      return <Candelabrum item={item} woodMaterial={woodMaterial} />;
    case "stained-window":
      return <GothicWindow item={item} stainedMaterial={stainedGlassMaterial} woodMaterial={woodMaterial} />;
    default:
      return null;
  }
}

function FlickeringLight() {
  const light = useRef(null);
  const timeToFlicker = useRef(3.4);
  const flickerRemaining = useRef(0);

  useFrame((_, delta) => {
    if (!light.current) return;
    timeToFlicker.current -= delta;
    if (timeToFlicker.current <= 0) {
      flickerRemaining.current = 0.06 + Math.random() * 0.12;
      timeToFlicker.current = 4 + Math.random() * 7;
    }

    flickerRemaining.current = Math.max(0, flickerRemaining.current - delta);
    const targetIntensity = flickerRemaining.current > 0 ? 0.18 : 3.1;
    const response = 1 - Math.exp(-delta * (flickerRemaining.current > 0 ? 35 : 5));
    light.current.intensity += (targetIntensity - light.current.intensity) * response;
  });

  return <pointLight ref={light} position={[5, 2.4, 2]} intensity={3.1} distance={16} color="#b74150" />;
}

function WallPanel({ position, size, material }) {
  return (
    <mesh position={position} castShadow receiveShadow>
      <boxGeometry args={size} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

function EntryDoor({ side, woodMaterial }) {
  const hingeX = side * 3.42;
  const openDirection = -side;

  return (
    <group position={[hingeX, 0, 3.82]} rotation={[0, side * 1.08, 0]}>
      <mesh castShadow receiveShadow position={[openDirection * 0.82, 1.3, 0]}>
        <boxGeometry args={[1.64, 2.6, 0.14]} />
        <primitive object={woodMaterial} attach="material" />
      </mesh>
      <mesh castShadow position={[openDirection * 0.82, 1.32, 0.085]}>
        <boxGeometry args={[1.3, 2.28, 0.035]} />
        <meshStandardMaterial color="#39261e" map={woodMaterial.map} roughness={0.76} />
      </mesh>
      {[-0.31, 0.31].map((x) => (
        <mesh key={x} position={[openDirection * 0.82 + x, 1.34, 0.11]}>
          <boxGeometry args={[0.48, 0.86, 0.045]} />
          <meshStandardMaterial color="#533526" map={woodMaterial.map} roughness={0.72} />
        </mesh>
      ))}
      <mesh position={[openDirection * 0.82 + side * 0.53, 1.2, 0.16]}>
        <sphereGeometry args={[0.055, 10, 10]} />
        <meshStandardMaterial color="#bd9b5b" metalness={0.75} roughness={0.3} />
      </mesh>
    </group>
  );
}

function RoomEnvironment({ roomIndex, textures }) {
  const { furniture } = roomLayouts[roomIndex];
  const plasterMaterial = useMemo(() => new MeshStandardMaterial({
    map: textures.plaster,
    color: roomIndex === 2 ? "#9aa0ad" : roomIndex === 1 ? "#b3a087" : "#ae8f85",
    roughness: 0.98,
    bumpMap: textures.plaster,
    bumpScale: 0.045,
    side: DoubleSide,
  }), [roomIndex, textures.plaster]);
  const stoneMaterial = useMemo(() => new MeshStandardMaterial({
    map: textures.stone,
    color: roomIndex === 2 ? "#a5a1ad" : "#b2a398",
    roughness: 0.96,
    bumpMap: textures.stone,
    bumpScale: 0.09,
    side: DoubleSide,
  }), [roomIndex, textures.stone]);
  const woodMaterial = useMemo(() => new MeshStandardMaterial({
    map: textures.wood,
    color: "#694832",
    roughness: 0.82,
    bumpMap: textures.wood,
    bumpScale: 0.035,
  }), [textures.wood]);

  useEffect(() => () => {
    plasterMaterial.dispose();
    stoneMaterial.dispose();
    woodMaterial.dispose();
  }, [plasterMaterial, stoneMaterial, woodMaterial]);

  return (
    <group scale={[ROOM_SCALE, 1, ROOM_SCALE]}>
      <mesh position={[0, -0.045, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[10, 8]} />
        <meshStandardMaterial map={textures.floor} bumpMap={textures.floor} bumpScale={0.055} roughness={0.78} color="#d7bf9c" />
      </mesh>
      <mesh position={[0, -0.13, 0]} receiveShadow>
        <boxGeometry args={[10.08, 0.12, 8.08]} />
        <meshStandardMaterial color="#211a1b" roughness={0.92} />
      </mesh>
      <mesh position={[0, 4.05, 0]} rotation={[Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[10, 8]} />
        <meshStandardMaterial map={textures.plaster} color="#a99b91" roughness={1} side={DoubleSide} />
      </mesh>

      <WallPanel position={[0, 2.03, -4.04]} size={[10, 3.94, 0.28]} material={plasterMaterial} />
      <WallPanel position={[0, 0.53, -3.86]} size={[9.96, 1.02, 0.12]} material={woodMaterial} />
      <WallPanel position={[0, 2.93, -3.86]} size={[9.96, 0.12, 0.14]} material={woodMaterial} />

      {[-5.02, 5.02].map((x) => (
        <group key={x}>
          <WallPanel position={[x, 2.03, 0]} size={[0.28, 3.94, 8]} material={plasterMaterial} />
          <WallPanel position={[x * 0.985, 0.53, 0]} size={[0.12, 1.02, 7.96]} material={woodMaterial} />
          <WallPanel position={[x * 0.985, 2.93, 0]} size={[0.14, 0.12, 7.96]} material={woodMaterial} />
        </group>
      ))}

      {[-4.3, 4.3].map((x) => (
        <group key={x}>
          <WallPanel position={[x, 1.95, 4.02]} size={[1.4, 3.8, 0.28]} material={stoneMaterial} />
          <WallPanel position={[x, 0.53, 3.84]} size={[1.38, 1.02, 0.12]} material={woodMaterial} />
        </group>
      ))}
      <WallPanel position={[0, 3.55, 4.02]} size={[7.3, 0.72, 0.28]} material={stoneMaterial} />
      <WallPanel position={[-3.57, 1.9, 3.85]} size={[0.16, 3.8, 0.16]} material={woodMaterial} />
      <WallPanel position={[3.57, 1.9, 3.85]} size={[0.16, 3.8, 0.16]} material={woodMaterial} />
      <WallPanel position={[0, 2.92, 3.85]} size={[7.25, 0.18, 0.18]} material={woodMaterial} />
      <WallPanel position={[0, 0.04, 3.8]} size={[2.45, 0.09, 0.45]} material={woodMaterial} />
      {[-1, 1].map((side) => (
        <EntryDoor key={side} side={side} woodMaterial={woodMaterial} />
      ))}

      {[-3.7, -1.3, 1.3, 3.7].map((x) => (
        <group key={`back-pilaster-${x}`} position={[x, 0, -3.82]}>
          <WallPanel position={[0, 1.9, 0]} size={[0.16, 3.8, 0.2]} material={woodMaterial} />
          <WallPanel position={[0, 0.12, 0]} size={[0.34, 0.24, 0.28]} material={woodMaterial} />
          <WallPanel position={[0, 3.55, 0]} size={[0.34, 0.2, 0.28]} material={woodMaterial} />
        </group>
      ))}

      {[-3.1, -0.2, 2.7].map((z) => (
        <ArchBeam key={z} z={z} material={woodMaterial} />
      ))}
      <WallSconce position={[-4.82, 2.12, -0.7]} rotation={[0, Math.PI / 2, 0]} />
      <WallSconce position={[4.82, 2.12, -0.7]} rotation={[0, -Math.PI / 2, 0]} />
      {furniture.map((item) => (
        <FurnitureModel key={item.name} item={item} textures={textures} />
      ))}
    </group>
  );
}

function MansionActors({
  movementKeys,
  roomIndex,
  entryId,
  hidingPosition,
  threat,
  isHiding,
  attackId,
  canAttack,
  interactions,
  onNearbyInteraction,
  onAttack,
  onDevilState,
  onFootstep,
}) {
  const playerPosition = useRef({ ...START_POSITION });
  const cameraDirection = useRef(new Vector3());
  const activeInteractionId = useRef(null);
  const previousHiding = useRef(isHiding);
  const previousEntryId = useRef(entryId);
  const layout = roomLayouts[roomIndex];
  const furniture = useMemo(() => scaleRoomFurniture(layout.furniture), [layout]);
  const patrolRoute = useMemo(
    () => layout.patrolRoute.map(scaleRoomPoint),
    [layout]
  );
  const devilPosition = useMemo(() => scaleRoomPoint(layout.devilSpawn), [layout]);

  useEffect(() => {
    if (previousEntryId.current !== entryId) {
      playerPosition.current = { ...START_POSITION };
      previousEntryId.current = entryId;
    }

    if (isHiding && !previousHiding.current && hidingPosition) {
      playerPosition.current = { ...hidingPosition };
    }

    previousHiding.current = isHiding;
  }, [entryId, roomIndex, isHiding, hidingPosition]);

  useFrame(({ camera }, delta) => {
    const position = playerPosition.current;
    const keys = movementKeys.current;
    camera.getWorldDirection(cameraDirection.current);
    const direction = cameraDirection.current;
    const horizontalLength = Math.hypot(direction.x, direction.z) || 1;
    const forwardX = direction.x / horizontalLength;
    const forwardZ = direction.z / horizontalLength;
    const forward = Number(keys.has("forward")) - Number(keys.has("backward"));
    const strafe = Number(keys.has("right")) - Number(keys.has("left"));
    let moveX = forwardX * forward - forwardZ * strafe;
    let moveZ = forwardZ * forward + forwardX * strafe;
    const length = Math.hypot(moveX, moveZ);

    if (!isHiding && length > 0) {
      moveX /= length;
      moveZ /= length;
      const step = 2.7 * delta;
      const nextX = position.x + moveX * step;
      const nextZ = position.z + moveZ * step;

      if (!isBlocked(nextX, position.z, furniture)) position.x = nextX;
      if (!isBlocked(position.x, nextZ, furniture)) position.z = nextZ;
    }

    camera.position.set(position.x, isHiding ? 0.9 : 1.62, position.z);

    let nearestInteraction = null;
    let nearestDistance = Infinity;
    interactions.forEach((interaction) => {
      const offsetX = interaction.x - position.x;
      const offsetZ = interaction.z - position.z;
      const distance = Math.hypot(offsetX, offsetZ);
      if (distance <= interaction.radius && distance < nearestDistance) {
        nearestInteraction = interaction;
        nearestDistance = distance;
      }
    });

    const nextInteractionId = nearestInteraction?.id || null;
    if (activeInteractionId.current !== nextInteractionId) {
      activeInteractionId.current = nextInteractionId;
      onNearbyInteraction(nextInteractionId);
    }
  });

  return (
    <>
      <DevilModel
        position={devilPosition}
        patrolRoute={patrolRoute}
        playerPosition={playerPosition}
        furniture={furniture}
        threat={threat}
        isHiding={isHiding}
        attackId={attackId}
        canAttack={canAttack}
        onAttack={onAttack}
        onDevilState={onDevilState}
        onFootstep={onFootstep}
      />
    </>
  );
}

function MansionScene({
  roomIndex,
  entryId,
  hidingPosition,
  movementKeys,
  interactions,
  onNearbyInteraction,
  threat,
  isHiding,
  attackId,
  canAttack,
  onAttack,
  onDevilState,
  onFootstep,
  onPointerLock,
  isTouchDevice,
  resetId,
}) {
  const textures = useMemo(() => createMansionTextures(), []);
  const cameraRef = useRef(null);
  const touchPointerId = useRef(null);
  const previousTouch = useRef({ x: 0, y: 0 });

  useEffect(() => () => Object.values(textures).forEach((texture) => texture.dispose()), [textures]);
  useEffect(() => {
    if (isHiding || canAttack === false) movementKeys.current.clear();
  }, [isHiding, canAttack, movementKeys]);

  const handleTouchStart = (event) => {
    if (!isTouchDevice || event.pointerType !== "touch") return;
    touchPointerId.current = event.pointerId;
    previousTouch.current = { x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const handleTouchMove = (event) => {
    if (event.pointerId !== touchPointerId.current) return;
    const deltaX = event.clientX - previousTouch.current.x;
    const deltaY = event.clientY - previousTouch.current.y;
    if (cameraRef.current) {
      cameraRef.current.rotation.order = "YXZ";
      cameraRef.current.rotation.y -= deltaX * 0.004;
      cameraRef.current.rotation.x = Math.max(
        -Math.PI / 2 + 0.12,
        Math.min(Math.PI / 2 - 0.12, cameraRef.current.rotation.x - deltaY * 0.004)
      );
    }
    previousTouch.current = { x: event.clientX, y: event.clientY };
  };
  const handleTouchEnd = (event) => {
    if (event.pointerId === touchPointerId.current) touchPointerId.current = null;
  };

  return (
    <div
      key={resetId}
      className="mansion-scene"
      aria-label="First-person mansion exploration scene"
      onPointerDown={handleTouchStart}
      onPointerMove={handleTouchMove}
      onPointerUp={handleTouchEnd}
      onPointerCancel={handleTouchEnd}
    >
      <Canvas
        shadows
        dpr={[1, 1.5]}
        camera={{ position: [0, 1.62, START_POSITION.z], fov: 74, near: 0.1, far: 60 }}
        gl={{ alpha: false, antialias: true }}
        onCreated={({ camera, gl }) => {
          cameraRef.current = camera;
          camera.rotation.order = "YXZ";
          camera.lookAt(0, 1.62, 0);
          gl.shadowMap.enabled = true;
          gl.shadowMap.type = PCFShadowMap;
        }}
      >
        <color attach="background" args={["#111014"]} />
        <fog attach="fog" args={["#171317", 18, 35]} />
        <ambientLight intensity={0.9} color="#abb3c6" />
        <hemisphereLight args={["#b6c1d5", "#392820", 1.05]} />
        <directionalLight
          position={[1, 7, 3]}
          intensity={2.7}
          color="#ffe1bd"
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
          shadow-camera-left={-12}
          shadow-camera-right={12}
          shadow-camera-top={12}
          shadow-camera-bottom={-12}
          shadow-bias={-0.00025}
        />
        <pointLight position={[-5, 2.6, -4]} intensity={5.5} distance={18} color="#ff9a4f" />
        <FlickeringLight />
        <PointerLockControls
          selector=".mansion-scene"
          enabled={!isTouchDevice}
          onLock={() => onPointerLock(true)}
          onUnlock={() => onPointerLock(false)}
        />
        <RoomEnvironment roomIndex={roomIndex} textures={textures} />
        <MansionActors
          key={entryId}
          movementKeys={movementKeys}
          roomIndex={roomIndex}
          entryId={entryId}
          hidingPosition={hidingPosition}
          interactions={interactions}
          onNearbyInteraction={onNearbyInteraction}
          threat={threat}
          isHiding={isHiding}
          attackId={attackId}
          canAttack={canAttack}
          onAttack={onAttack}
          onDevilState={onDevilState}
          onFootstep={onFootstep}
        />
      </Canvas>
    </div>
  );
}

export default MansionScene;
