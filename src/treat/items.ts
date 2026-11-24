// The Treatrio catalogue: 24 treats, each with its own shape and colours, so any three on a shelf read at a glance.
// The 3D models live in ui/models.ts (built from simple shapes, one draw call each).
export interface ItemInfo { id: number; name: string; color: string }
export const ITEMS: ItemInfo[] = [
  { id: 1, name: "Pink donut", color: "#ff7ab6" },
  { id: 2, name: "Choco donut", color: "#7a4a2a" },
  { id: 3, name: "Cupcake", color: "#ff9fd0" },
  { id: 4, name: "Mint macaron", color: "#7fe0b5" },
  { id: 5, name: "Berry macaron", color: "#c77dff" },
  { id: 6, name: "Ice cream cone", color: "#fff0c0" },
  { id: 7, name: "Swirl lollipop", color: "#ff4f9a" },
  { id: 8, name: "Wrapped candy", color: "#ffd23f" },
  { id: 9, name: "Choc-chip cookie", color: "#d9a066" },
  { id: 10, name: "Croissant", color: "#e8a24a" },
  { id: 11, name: "Strawberry", color: "#ff3b4f" },
  { id: 12, name: "Cherries", color: "#c8102e" },
  { id: 13, name: "Jelly", color: "#3fd3a0" },
  { id: 14, name: "Popsicle", color: "#ff8a3d" },
  { id: 15, name: "Milk bottle", color: "#f4f8ff" },
  { id: 16, name: "Fizzy can", color: "#3fa2f5" },
  { id: 17, name: "Juice box", color: "#9be04a" },
  { id: 18, name: "Teacup", color: "#ffffff" },
  { id: 19, name: "Pudding", color: "#ffd27a" },
  { id: 20, name: "Cake slice", color: "#ffe0f0" },
  { id: 21, name: "Gumball", color: "#8a6bff" },
  { id: 22, name: "Chocolate bar", color: "#5a321c" },
  { id: 23, name: "Apple", color: "#58c43a" },
  { id: 24, name: "Honey jar", color: "#ffb52e" },
];
export const ITEM_COUNT = ITEMS.length;
