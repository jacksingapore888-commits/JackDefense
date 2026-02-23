export enum GameStatus {
  START = 'START',
  PLAYING = 'PLAYING',
  ROUND_END = 'ROUND_END',
  GAME_OVER = 'GAME_OVER',
  VICTORY = 'VICTORY',
}

export interface Point {
  x: number;
  y: number;
}

export interface Rocket {
  id: string;
  start: Point;
  end: Point;
  current: Point;
  speed: number;
  color: string;
}

export interface Interceptor {
  id: string;
  start: Point;
  target: Point;
  current: Point;
  speed: number;
  towerIndex: number;
}

export interface Explosion {
  id: string;
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  growing: boolean;
  alpha: number;
}

export interface Tower {
  x: number;
  y: number;
  missiles: number;
  maxMissiles: number;
  destroyed: boolean;
}

export interface City {
  x: number;
  y: number;
  destroyed: boolean;
}

export interface GameState {
  score: number;
  status: GameStatus;
  round: number;
  rocketsToSpawn: number;
  towers: Tower[];
  cities: City[];
  rockets: Rocket[];
  interceptors: Interceptor[];
  explosions: Explosion[];
  targetMarkers: Point[];
}
