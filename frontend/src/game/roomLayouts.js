export const ROOM_SCALE = 1.8;
export const ROOM_BOUNDS = {
  minX: -4.55 * ROOM_SCALE,
  maxX: 4.55 * ROOM_SCALE,
  minZ: -3.55 * ROOM_SCALE,
  maxZ: 3.55 * ROOM_SCALE,
};

export const scaleRoomPoint = ({ x, z }) => ({
  x: x * ROOM_SCALE,
  z: z * ROOM_SCALE,
});

export const scaleRoomFurniture = (furniture) => furniture.map((item) => ({
  ...item,
  ...scaleRoomPoint(item),
  width: item.width * ROOM_SCALE,
  depth: item.depth * ROOM_SCALE,
}));

export const roomLayouts = [
  {
    hidingSpots: [
      { id: "wardrobe", label: "inside the wardrobe", position: { x: -3.4, z: -0.72 } },
      { id: "console", label: "behind the gallery console", position: { x: 1.5, z: -2.6 } },
    ],
    devilSpawn: { x: 3.1, z: -2 },
    patrolRoute: [
      { x: 3.1, z: -2 },
      { x: 3.5, z: 2.45 },
      { x: 1.8, z: 2.45 },
      { x: -1.8, z: 2.45 },
      { x: -1.8, z: 0.4 },
      { x: -2.2, z: -1 },
      { x: 2.2, z: -1 },
    ],
    furniture: [
      { name: "wardrobe", type: "wardrobe", x: -3.4, z: -1.8, width: 1.05, height: 2.1, depth: 1.1, color: "#392522" },
      { name: "portrait-left", type: "portrait", x: -3.15, z: -3.84, width: 0.9, height: 1.3, depth: 0.14 },
      { name: "portrait-center-left", type: "portrait", x: -1.15, z: -3.84, width: 1.05, height: 1.5, depth: 0.14 },
      { name: "portrait-center-right", type: "portrait", x: 1.25, z: -3.84, width: 0.95, height: 1.35, depth: 0.14 },
      { name: "portrait-right", type: "portrait", x: 3.2, z: -3.84, width: 0.85, height: 1.25, depth: 0.14 },
      { name: "console", type: "table", x: 0.15, z: -2.6, width: 1.9, height: 0.82, depth: 0.62, color: "#4b3022" },
      { name: "fallen-coat", type: "coat", x: 0.7, z: 1.25, width: 0.78, height: 0.38, depth: 0.78, color: "#241c1d" },
      { name: "vase-stand", type: "pedestal", x: 3.45, z: 0.25, width: 0.7, height: 0.9, depth: 0.7, color: "#45352d" },
    ],
  },
  {
    hidingSpots: [
      { id: "desk", label: "beneath the writing desk", position: { x: -3.15, z: -0.7 } },
      { id: "bookcase", label: "behind the right bookcase", position: { x: 2.5, z: 0.35 } },
    ],
    devilSpawn: { x: 2.1, z: -2.3 },
    patrolRoute: [
      { x: 2.1, z: -2.3 },
      { x: 2.1, z: 2.45 },
      { x: 0.6, z: 2.45 },
      { x: -2.1, z: 2.45 },
      { x: -2.1, z: 0.4 },
      { x: -2.1, z: -1 },
      { x: 1.7, z: -1 },
    ],
    furniture: [
      { name: "desk", type: "desk", x: -3.15, z: -1.8, width: 1.8, height: 0.9, depth: 1.1, color: "#403020" },
      { name: "bookcase-left", type: "bookshelf", x: 3.9, z: -2.25, width: 0.88, height: 2.55, depth: 1.25, color: "#30251f" },
      { name: "bookcase-right", type: "bookshelf", x: 3.9, z: 0.35, width: 0.88, height: 2.55, depth: 1.25, color: "#30251f" },
      { name: "reading-table", type: "table", x: 0.45, z: -1.8, width: 1.45, height: 0.82, depth: 0.85, color: "#493223" },
      { name: "chair", type: "chair", x: 0.45, z: -0.8, width: 0.68, height: 1.15, depth: 0.68, color: "#34251f" },
      { name: "loose-pages", type: "papers", x: 1.8, z: 1.3, width: 0.82, height: 0.12, depth: 0.68, color: "#b1a184" },
      { name: "fallen-book", type: "book", x: 1.2, z: 1.9, width: 0.58, height: 0.16, depth: 0.42, color: "#642a2a" },
    ],
  },
  {
    hidingSpots: [
      { id: "right-pew", label: "behind the right chapel pews", position: { x: 2.85, z: 0.25 } },
      { id: "left-pew", label: "behind the left chapel pews", position: { x: -3.1, z: 0.25 } },
    ],
    devilSpawn: { x: 2.8, z: -1.2 },
    patrolRoute: [
      { x: 2.8, z: -1.2 },
      { x: 2.8, z: 2.35 },
      { x: 0, z: 2.35 },
      { x: -3, z: 2.35 },
      { x: -3, z: 1.2 },
      { x: 0, z: 1.2 },
      { x: 0, z: -2 },
      { x: 0, z: 1.2 },
      { x: -3, z: 1.2 },
      { x: -3, z: 2.35 },
      { x: 2.8, z: 2.35 },
    ],
    furniture: [
      { name: "altar", type: "altar", x: 0, z: -3.05, width: 2.1, height: 1.1, depth: 0.9, color: "#48404a" },
      { name: "left-pew", type: "pew", x: -1.9, z: -0.45, width: 1.25, height: 0.62, depth: 2.15, color: "#3a2a27" },
      { name: "right-pew", type: "pew", x: 1.65, z: -0.45, width: 1.25, height: 0.62, depth: 2.15, color: "#3a2a27" },
      { name: "gothic-window", type: "stained-window", x: 0, z: -3.86, width: 1.65, height: 2.15, depth: 0.12 },
      { name: "candelabrum-left", type: "candelabrum", x: -3.3, z: -2.2, width: 0.62, height: 1.55, depth: 0.62, color: "#51443d" },
      { name: "candelabrum-right", type: "candelabrum", x: 3.3, z: -2.2, width: 0.62, height: 1.55, depth: 0.62, color: "#51443d" },
    ],
  },
];
