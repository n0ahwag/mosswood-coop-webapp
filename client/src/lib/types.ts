export type Inventory = Record<string, number>;

export interface ResourceDef {
  name: string;
  icon: string;
  tier: 'raw' | 'refined' | 'food';
}

export interface BuildingDef {
  name: string;
  icon: string;
  category: 'gathering' | 'refining' | 'food';
  description: string;
  inputs: Inventory;
  outputs: Inventory;
  durationSec: number;
  slots: number;
  stockCap: number;
}

export interface TechDef {
  key: string;
  name: string;
  icon: string;
  description: string;
  scope: 'player' | 'valley';
  cost: Inventory;
  requires: string[];
}

export interface VillagerRules {
  hungryBelow: number;
  tiredBelow: number;
  baseVillagers: number;
  maxVillagers: number;
}

export type FeatureKey = 'research' | 'valley' | 'ship' | 'valleyResearch';

export interface QuestDef {
  key: string;
  icon: string;
  title: string;
  text: string;
  goal: { type: 'assign' | 'collect' | 'research' | 'contribute' | 'shipLoad'; amount: number; resource?: string; building?: string };
  reward: { buildings?: string[]; features?: FeatureKey[]; resources?: Inventory };
}

export interface GameContent {
  resources: Record<string, ResourceDef>;
  buildings: Record<string, BuildingDef>;
  techs: Record<string, TechDef>;
  villagerRules: VillagerRules;
  quests: QuestDef[];
  features: Record<FeatureKey, { name: string; icon: string }>;
}

export interface Progression {
  step: number;
  total: number;
  quest: (QuestDef & { progress: number }) | null;
  features: FeatureKey[];
  unlockedBuildings: string[];
  locked: { type: string; questIndex: number; questTitle: string }[];
}

export type VillagerState = 'IDLE' | 'WORKING' | 'HUNGRY' | 'EATING' | 'TIRED' | 'RESTING';

export interface Villager {
  id: string;
  name: string;
  state: VillagerState;
  energy: number;
  satiety: number;
  stateTimer: number;
  buildingId: string | null;
}

export type BuildingStatus = 'idle' | 'working' | 'missingInputs' | 'full';

export interface Building {
  id: string;
  type: string;
  level: number;
  progress: number;
  loaded: boolean;
  stock: Inventory;
  status: BuildingStatus;
  workerIds: string[];
}

export interface VillageState {
  id: string;
  name: string;
  inventory: Inventory;
  storageCap: number;
  villagerSlots: number;
  techKeys: string[];
  progression: Progression;
  buildings: Building[];
  villagers: Villager[];
  serverTime: number;
}

export interface ValleyMember {
  id: string;
  displayName: string;
  prestige: number;
  seals: number;
  online: boolean;
}

export interface ValleyProject {
  id: string;
  key: string;
  name: string;
  icon: string;
  description: string;
  requirements: Inventory;
  progress: Inventory;
  status: 'ACTIVE' | 'COMPLETED';
  completedAt: string | null;
  reward: { prestige: number; seals: number };
  contributors: { userId: string; displayName: string; amount: number }[];
}

export interface TradeShip {
  id: string;
  status: 'INCOMING' | 'DOCKED' | 'COMPLETED' | 'DEPARTED';
  demands: { resource: string; amount: number }[];
  progress: Inventory;
  arrivesAt: string;
  departsAt: string;
  reward: { prestige: number; seals: number };
}

export interface ValleyState {
  id: string;
  name: string;
  inviteCode: string;
  maxMembers: number;
  members: ValleyMember[];
  projects: ValleyProject[];
  ship: TradeShip | null;
  techKeys: string[];
  serverTime: number;
}

export interface ValleyEvent {
  id: string;
  icon: string;
  text: string;
  at: string;
}

export interface Me {
  id: string;
  displayName: string;
  seals: number;
  prestige: number;
  valleyId: string | null;
  villageId: string | null;
}

export type Ack<T> = { ok: true; data: T } | { ok: false; error: string };
