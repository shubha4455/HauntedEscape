import { useFrame } from "@react-three/fiber";
import { CatmullRomCurve3, DoubleSide, Shape, ShapeGeometry, Vector3 } from "three";
import { useMemo, useRef } from "react";
import { ROOM_BOUNDS } from "./roomLayouts";

const IDLE_DURATION = 3.5;
const DETECTION_DISTANCE = 7.5;
const LOSE_DISTANCE = 10.5;
const ATTACK_RANGE = 1.1;
const ATTACK_COOLDOWN = 12;
const DEVIL_RADIUS = 0.42;
const PATH_GRID_STEP = 0.45;

const DEVIL_STATES = {
  IDLE: "IDLE",
  PATROL: "PATROL",
  INVESTIGATE: "INVESTIGATE",
  CHASE: "CHASE",
  ATTACK: "ATTACK",
  SEARCH: "SEARCH",
};

function isBlocked(x, z, furniture) {
  return (
    x < ROOM_BOUNDS.minX + DEVIL_RADIUS
    || x > ROOM_BOUNDS.maxX - DEVIL_RADIUS
    || z < ROOM_BOUNDS.minZ + DEVIL_RADIUS
    || z > ROOM_BOUNDS.maxZ - DEVIL_RADIUS
    || furniture.some((item) => (
      Math.abs(x - item.x) < item.width / 2 + DEVIL_RADIUS
      && Math.abs(z - item.z) < item.depth / 2 + DEVIL_RADIUS
    ))
  );
}

function findPath(start, destination, furniture) {
  const minX = ROOM_BOUNDS.minX + DEVIL_RADIUS;
  const minZ = ROOM_BOUNDS.minZ + DEVIL_RADIUS;
  const columns = Math.floor((ROOM_BOUNDS.maxX - DEVIL_RADIUS - minX) / PATH_GRID_STEP) + 1;
  const rows = Math.floor((ROOM_BOUNDS.maxZ - DEVIL_RADIUS - minZ) / PATH_GRID_STEP) + 1;
  const pointFor = (column, row) => ({
    x: minX + column * PATH_GRID_STEP,
    z: minZ + row * PATH_GRID_STEP,
  });
  const nearestOpenCell = (point) => {
    let bestCell = null;
    let bestDistance = Infinity;
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const candidate = pointFor(column, row);
        const distance = (candidate.x - point.x) ** 2 + (candidate.z - point.z) ** 2;
        if (distance < bestDistance && !isBlocked(candidate.x, candidate.z, furniture)) {
          bestCell = { column, row };
          bestDistance = distance;
        }
      }
    }
    return bestCell;
  };

  const startCell = nearestOpenCell(start);
  const goalCell = nearestOpenCell(destination);
  if (!startCell || !goalCell) return [];

  const cellIndex = (column, row) => row * columns + column;
  const startIndex = cellIndex(startCell.column, startCell.row);
  const goalIndex = cellIndex(goalCell.column, goalCell.row);
  if (startIndex === goalIndex) return [];

  const costs = new Float32Array(columns * rows).fill(Infinity);
  const parents = new Int32Array(columns * rows).fill(-1);
  const open = [startIndex];
  const openSet = new Set(open);
  costs[startIndex] = 0;

  while (open.length > 0) {
    let bestOpenIndex = 0;
    for (let index = 1; index < open.length; index += 1) {
      const candidate = open[index];
      const currentBest = open[bestOpenIndex];
      const candidateHeuristic = Math.hypot(
        goalCell.column - candidate % columns,
        goalCell.row - Math.floor(candidate / columns)
      );
      const bestHeuristic = Math.hypot(
        goalCell.column - currentBest % columns,
        goalCell.row - Math.floor(currentBest / columns)
      );
      if (costs[candidate] + candidateHeuristic < costs[currentBest] + bestHeuristic) {
        bestOpenIndex = index;
      }
    }
    const currentIndex = open.splice(bestOpenIndex, 1)[0];
    openSet.delete(currentIndex);
    if (currentIndex === goalIndex) break;

    const currentColumn = currentIndex % columns;
    const currentRow = Math.floor(currentIndex / columns);
    for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
      for (let columnOffset = -1; columnOffset <= 1; columnOffset += 1) {
        if (columnOffset === 0 && rowOffset === 0) continue;
        const column = currentColumn + columnOffset;
        const row = currentRow + rowOffset;
        if (column < 0 || column >= columns || row < 0 || row >= rows) continue;
        const point = pointFor(column, row);
        if (isBlocked(point.x, point.z, furniture)) continue;
        if (columnOffset !== 0 && rowOffset !== 0) {
          const sideA = pointFor(currentColumn + columnOffset, currentRow);
          const sideB = pointFor(currentColumn, currentRow + rowOffset);
          if (isBlocked(sideA.x, sideA.z, furniture) || isBlocked(sideB.x, sideB.z, furniture)) continue;
        }

        const nextIndex = cellIndex(column, row);
        const nextCost = costs[currentIndex] + (columnOffset && rowOffset ? 1.414 : 1);
        if (nextCost >= costs[nextIndex]) continue;
        costs[nextIndex] = nextCost;
        parents[nextIndex] = currentIndex;
        if (!openSet.has(nextIndex)) {
          open.push(nextIndex);
          openSet.add(nextIndex);
        }
      }
    }
  }

  if (parents[goalIndex] === -1) return [];
  const path = [];
  for (let index = goalIndex; index !== startIndex; index = parents[index]) {
    path.push(pointFor(index % columns, Math.floor(index / columns)));
  }
  path.reverse();
  return path;
}

function hasClearPath(start, destination, furniture) {
  const distance = Math.hypot(destination.x - start.x, destination.z - start.z);
  const steps = Math.ceil(distance / (PATH_GRID_STEP * 0.5));
  for (let step = 1; step <= steps; step += 1) {
    const progress = step / steps;
    const x = start.x + (destination.x - start.x) * progress;
    const z = start.z + (destination.z - start.z) * progress;
    if (isBlocked(x, z, furniture)) return false;
  }
  return true;
}

function createWingGeometry() {
  const shape = new Shape();
  shape.moveTo(0, 0);
  shape.quadraticCurveTo(-0.15, 0.75, -0.75, 1.05);
  shape.lineTo(-0.62, 0.48);
  shape.lineTo(-1.05, 0.82);
  shape.quadraticCurveTo(-0.95, 0.25, -0.44, -0.12);
  shape.lineTo(0, -0.18);
  return new ShapeGeometry(shape, 12);
}

const tailCurve = new CatmullRomCurve3([
  new Vector3(0, 0, 0),
  new Vector3(0.35, -0.18, 0.05),
  new Vector3(0.72, 0.02, 0.1),
  new Vector3(0.87, 0.4, 0.15),
]);

function DevilModel({
  position,
  patrolRoute,
  playerPosition,
  furniture,
  threat,
  isHiding,
  attackId,
  canAttack,
  onAttack,
  onDevilState,
  onFootstep,
}) {
  const devil = useRef(null);
  const body = useRef(null);
  const wing = useMemo(() => createWingGeometry(), []);
  const lastAttackId = useRef(attackId);
  const attackStarted = useRef(null);
  const state = useRef(DEVIL_STATES.IDLE);
  const stateStartedAt = useRef(null);
  const patrolTargetIndex = useRef(0);
  const lastKnownPosition = useRef({ x: position.x, z: position.z });
  const attackCooldown = useRef(0);
  const path = useRef([]);
  const nextPathAt = useRef(0);
  const lastFootstepAt = useRef(0);
  const searchTargetIndex = useRef(0);

  useFrame(({ clock }, delta) => {
    if (!devil.current) return;
    const time = clock.getElapsedTime();
    if (stateStartedAt.current === null) stateStartedAt.current = time;
    const target = playerPosition.current;
    const dx = target.x - devil.current.position.x;
    const dz = target.z - devil.current.position.z;
    const distance = Math.hypot(dx, dz);
    const canSeePlayer = !isHiding && distance <= DETECTION_DISTANCE;
    if (canSeePlayer) lastKnownPosition.current = { x: target.x, z: target.z };

    const changeState = (nextState) => {
      if (state.current === nextState) return;
      state.current = nextState;
      stateStartedAt.current = time;
      path.current = [];
      nextPathAt.current = time;
      onDevilState(nextState);
    };

    if (state.current === DEVIL_STATES.IDLE && time - stateStartedAt.current >= IDLE_DURATION) {
      changeState(DEVIL_STATES.PATROL);
    }
    if (
      canSeePlayer
      && state.current !== DEVIL_STATES.IDLE
      && state.current !== DEVIL_STATES.CHASE
      && state.current !== DEVIL_STATES.ATTACK
    ) {
      changeState(DEVIL_STATES.CHASE);
    } else if (
      (isHiding || distance > LOSE_DISTANCE)
      && (state.current === DEVIL_STATES.CHASE || state.current === DEVIL_STATES.ATTACK)
    ) {
      changeState(DEVIL_STATES.INVESTIGATE);
    }

    if (
      state.current === DEVIL_STATES.ATTACK
      && time - stateStartedAt.current >= 0.75
    ) {
      changeState(DEVIL_STATES.CHASE);
    }
    if (state.current === DEVIL_STATES.INVESTIGATE) {
      const lastKnownDistance = Math.hypot(
        lastKnownPosition.current.x - devil.current.position.x,
        lastKnownPosition.current.z - devil.current.position.z
      );
      if (lastKnownDistance <= 0.65 || time - stateStartedAt.current >= 4) {
        changeState(DEVIL_STATES.SEARCH);
      }
    }
    if (state.current === DEVIL_STATES.SEARCH && time - stateStartedAt.current >= 5) {
      let nearestWaypoint = 0;
      let nearestDistance = Infinity;
      patrolRoute.forEach((waypoint, index) => {
        const waypointDistance = Math.hypot(
          waypoint.x - devil.current.position.x,
          waypoint.z - devil.current.position.z
        );
        if (waypointDistance < nearestDistance) {
          nearestWaypoint = index;
          nearestDistance = waypointDistance;
        }
      });
      patrolTargetIndex.current = nearestWaypoint;
      changeState(DEVIL_STATES.PATROL);
    }

    let destination = null;
    let speed = 0;
    if (state.current === DEVIL_STATES.PATROL) {
      if (patrolRoute.length > 0) {
        destination = patrolRoute[patrolTargetIndex.current % patrolRoute.length];
        if (Math.hypot(
          destination.x - devil.current.position.x,
          destination.z - devil.current.position.z
        ) < 0.45) {
          patrolTargetIndex.current = (patrolTargetIndex.current + 1) % patrolRoute.length;
          destination = patrolRoute[patrolTargetIndex.current];
        }
        speed = 0.85;
      }
    } else if (state.current === DEVIL_STATES.CHASE) {
      if (distance <= ATTACK_RANGE && canAttack && time >= attackCooldown.current) {
        attackCooldown.current = time + ATTACK_COOLDOWN;
        attackStarted.current = time;
        changeState(DEVIL_STATES.ATTACK);
        onAttack();
      } else {
        if (distance <= ATTACK_RANGE + 0.35 && time < attackCooldown.current) {
          const awayX = distance > 0.001 ? -dx / distance : 1;
          const awayZ = distance > 0.001 ? -dz / distance : 0;
          destination = { x: target.x + awayX * 1.5, z: target.z + awayZ * 1.5 };
        } else {
          destination = target;
        }
        speed = 1.5 + Math.min(threat, 4) * 0.3;
      }
    } else if (state.current === DEVIL_STATES.INVESTIGATE) {
      destination = lastKnownPosition.current;
      speed = 1;
    } else if (state.current === DEVIL_STATES.SEARCH) {
      const offsets = [
        { x: 1.25, z: 0 },
        { x: 0, z: 1.25 },
        { x: -1.25, z: 0 },
        { x: 0, z: -1.25 },
      ];
      const offset = offsets[searchTargetIndex.current % offsets.length];
      destination = {
        x: Math.max(ROOM_BOUNDS.minX + DEVIL_RADIUS, Math.min(ROOM_BOUNDS.maxX - DEVIL_RADIUS, lastKnownPosition.current.x + offset.x)),
        z: Math.max(ROOM_BOUNDS.minZ + DEVIL_RADIUS, Math.min(ROOM_BOUNDS.maxZ - DEVIL_RADIUS, lastKnownPosition.current.z + offset.z)),
      };
      if (Math.hypot(
        destination.x - devil.current.position.x,
        destination.z - devil.current.position.z
      ) < 0.35) {
        searchTargetIndex.current = (searchTargetIndex.current + 1) % offsets.length;
      }
      speed = 0.72;
    }

    if (
      state.current === DEVIL_STATES.ATTACK
      || state.current === DEVIL_STATES.IDLE
      || !destination
    ) {
      path.current = [];
    }

    let facingX = 0;
    let facingZ = 0;
    let isMoving = false;
    if (destination) {
      if (time >= nextPathAt.current) {
        path.current = hasClearPath(devil.current.position, destination, furniture)
          ? []
          : findPath(devil.current.position, destination, furniture);
        nextPathAt.current = time + 0.45;
      }
      while (
        path.current.length > 0
        && Math.hypot(
          path.current[0].x - devil.current.position.x,
          path.current[0].z - devil.current.position.z
        ) < PATH_GRID_STEP * 0.7
      ) {
        path.current.shift();
      }
      const movementTarget = path.current[0] || destination;
      const moveX = movementTarget.x - devil.current.position.x;
      const moveZ = movementTarget.z - devil.current.position.z;
      const moveDistance = Math.hypot(moveX, moveZ);
      if (moveDistance > 0.001) {
        const step = Math.min(speed * Math.min(delta, 0.1), moveDistance);
        const nextX = devil.current.position.x + (moveX / moveDistance) * step;
        const nextZ = devil.current.position.z + (moveZ / moveDistance) * step;
        if (!isBlocked(nextX, nextZ, furniture)) {
          devil.current.position.x = nextX;
          devil.current.position.z = nextZ;
          isMoving = true;
        } else if (!isBlocked(nextX, devil.current.position.z, furniture)) {
          devil.current.position.x = nextX;
          isMoving = true;
        } else if (!isBlocked(devil.current.position.x, nextZ, furniture)) {
          devil.current.position.z = nextZ;
          isMoving = true;
        } else {
          nextPathAt.current = time + 0.1;
        }
        if (isMoving) {
          facingX = moveX;
          facingZ = moveZ;
          if (time - lastFootstepAt.current >= 0.48) {
            lastFootstepAt.current = time;
            onFootstep();
          }
        } else if (state.current === DEVIL_STATES.PATROL && patrolRoute.length > 0) {
          patrolTargetIndex.current = (patrolTargetIndex.current + 1) % patrolRoute.length;
        }
      }
    }

    if (lastAttackId.current !== attackId) {
      lastAttackId.current = attackId;
      attackStarted.current = time;
    }

    const attackProgress = attackStarted.current === null
      ? 0
      : Math.min((time - attackStarted.current) / 0.8, 1);
    const lunge = Math.sin(Math.PI * attackProgress);
    const breathing = Math.sin(time * 1.7) * 0.035;
    devil.current.position.y = -0.15 + Math.sin(time * 1.3) * 0.035 + lunge * 0.14;
    if (body.current) body.current.scale.y = 1 + breathing;
    const gait = isMoving ? Math.sin(time * 10) * 0.06 : 0;
    devil.current.position.y += gait;
    const facingLength = Math.hypot(facingX, facingZ);
    if (facingLength > 0.001) {
      const desiredRotation = Math.atan2(facingX, facingZ);
      const rotationDelta = Math.atan2(
        Math.sin(desiredRotation - devil.current.rotation.y),
        Math.cos(desiredRotation - devil.current.rotation.y)
      );
      devil.current.rotation.y += rotationDelta * (1 - Math.exp(-7 * delta));
    }
    devil.current.rotation.x = -lunge * 0.24;
    devil.current.scale.setScalar(1 + lunge * 0.38);
  });

  return (
    <group ref={devil} position={[position.x, -0.15, position.z]}>
      <group position={[0, 0, -0.12]}>
        <mesh geometry={wing} position={[-0.35, 1.53, 0]} rotation={[0, 0, -0.1]} castShadow>
          <meshStandardMaterial color="#321018" emissive="#160509" emissiveIntensity={0.6} side={DoubleSide} roughness={0.82} />
        </mesh>
        <mesh geometry={wing} position={[0.35, 1.53, 0]} rotation={[0, Math.PI, 0.1]} castShadow>
          <meshStandardMaterial color="#321018" emissive="#160509" emissiveIntensity={0.6} side={DoubleSide} roughness={0.82} />
        </mesh>
      </group>

      <mesh ref={body} position={[0, 1.2, 0]} castShadow>
        <capsuleGeometry args={[0.38, 0.92, 6, 12]} />
        <meshStandardMaterial color="#721c25" roughness={0.65} />
      </mesh>
      <mesh position={[0, 1.27, 0.34]} castShadow>
        <sphereGeometry args={[0.32, 16, 16]} />
        <meshStandardMaterial color="#8f2429" roughness={0.58} />
      </mesh>

      <mesh position={[0, 2.05, 0.02]} castShadow>
        <sphereGeometry args={[0.48, 20, 20]} />
        <meshStandardMaterial color="#8f2429" roughness={0.58} />
      </mesh>
      <mesh position={[-0.25, 2.43, 0]} rotation={[0, 0, 0.23]} castShadow>
        <coneGeometry args={[0.16, 0.62, 12]} />
        <meshStandardMaterial color="#391017" roughness={0.45} />
      </mesh>
      <mesh position={[0.25, 2.43, 0]} rotation={[0, 0, -0.23]} castShadow>
        <coneGeometry args={[0.16, 0.62, 12]} />
        <meshStandardMaterial color="#391017" roughness={0.45} />
      </mesh>

      <mesh position={[-0.2, 2.06, 0.43]}>
        <sphereGeometry args={[0.085, 12, 12]} />
        <meshStandardMaterial color="#ffca55" emissive="#ff6a13" emissiveIntensity={5} />
      </mesh>
      <mesh position={[0.2, 2.06, 0.43]}>
        <sphereGeometry args={[0.085, 12, 12]} />
        <meshStandardMaterial color="#ffca55" emissive="#ff6a13" emissiveIntensity={5} />
      </mesh>
      <pointLight position={[0, 2.08, 0.68]} color="#ff3d12" intensity={1.2} distance={3.5} />
      <mesh position={[0, 1.87, 0.46]} scale={[0.2, 0.055, 0.05]}>
        <sphereGeometry args={[1, 16, 12]} />
        <meshStandardMaterial color="#1a0709" />
      </mesh>
      <mesh position={[-0.1, 1.82, 0.48]} rotation={[0, 0, Math.PI]}>
        <coneGeometry args={[0.045, 0.13, 8]} />
        <meshStandardMaterial color="#eee0c7" />
      </mesh>
      <mesh position={[0.1, 1.82, 0.48]} rotation={[0, 0, Math.PI]}>
        <coneGeometry args={[0.045, 0.13, 8]} />
        <meshStandardMaterial color="#eee0c7" />
      </mesh>

      <mesh position={[-0.49, 1.17, 0]} rotation={[0, 0, -0.35]} castShadow>
        <capsuleGeometry args={[0.15, 0.72, 5, 10]} />
        <meshStandardMaterial color="#721c25" roughness={0.65} />
      </mesh>
      <mesh position={[0.49, 1.17, 0]} rotation={[0, 0, 0.35]} castShadow>
        <capsuleGeometry args={[0.15, 0.72, 5, 10]} />
        <meshStandardMaterial color="#721c25" roughness={0.65} />
      </mesh>
      <mesh position={[-0.61, 0.71, 0.02]} rotation={[0, 0, -0.22]}>
        <sphereGeometry args={[0.17, 12, 12]} />
        <meshStandardMaterial color="#8f2429" />
      </mesh>
      <mesh position={[0.61, 0.71, 0.02]} rotation={[0, 0, 0.22]}>
        <sphereGeometry args={[0.17, 12, 12]} />
        <meshStandardMaterial color="#8f2429" />
      </mesh>

      <mesh position={[-0.19, 0.35, 0]} castShadow>
        <capsuleGeometry args={[0.17, 0.55, 5, 10]} />
        <meshStandardMaterial color="#57141d" roughness={0.7} />
      </mesh>
      <mesh position={[0.19, 0.35, 0]} castShadow>
        <capsuleGeometry args={[0.17, 0.55, 5, 10]} />
        <meshStandardMaterial color="#57141d" roughness={0.7} />
      </mesh>
      <mesh position={[-0.2, 0.06, 0.1]} scale={[1, 0.55, 1.35]}>
        <sphereGeometry args={[0.2, 12, 12]} />
        <meshStandardMaterial color="#1d1011" roughness={0.5} />
      </mesh>
      <mesh position={[0.2, 0.06, 0.1]} scale={[1, 0.55, 1.35]}>
        <sphereGeometry args={[0.2, 12, 12]} />
        <meshStandardMaterial color="#1d1011" roughness={0.5} />
      </mesh>

      <mesh position={[0.3, 0.7, -0.15]}>
        <tubeGeometry args={[tailCurve, 20, 0.035, 8, false]} />
        <meshStandardMaterial color="#8f2429" />
      </mesh>
    </group>
  );
}

export default DevilModel;
