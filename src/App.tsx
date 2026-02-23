/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Trophy, 
  RotateCcw, 
  Play, 
  Shield, 
  Target, 
  Info,
  Languages,
  Zap
} from 'lucide-react';
import useMeasure from 'react-use-measure';
import { 
  GameStatus, 
  GameState, 
  Rocket, 
  Interceptor, 
  Explosion, 
  Point 
} from './types';
import { 
  CANVAS_WIDTH, 
  CANVAS_HEIGHT, 
  TOWER_MISSILES, 
  WIN_SCORE, 
  ROCKET_SCORE,
  EXPLOSION_MAX_RADIUS,
  EXPLOSION_GROWTH_SPEED,
  EXPLOSION_FADE_SPEED,
  INTERCEPTOR_SPEED,
  ROCKET_SPEED_MIN,
  ROCKET_SPEED_MAX,
  COLORS
} from './constants';
import { cn, getDistance } from './utils/gameUtils';

const TRANSLATIONS = {
  en: {
    title: "Jack Nova Defense",
    start: "Start Game",
    restart: "Play Again",
    gameOver: "Game Over",
    victory: "Victory!",
    score: "Score",
    missiles: "Missiles",
    round: "Round",
    instructions: "Click to intercept rockets. Protect your cities!",
    winCondition: "Reach 1000 points to win.",
    allTowersDestroyed: "All towers destroyed!",
    left: "L",
    middle: "M",
    right: "R"
  },
  cn: {
    title: "Jack新星防御",
    start: "开始游戏",
    restart: "再玩一次",
    gameOver: "游戏结束",
    victory: "获得胜利！",
    score: "得分",
    missiles: "导弹",
    round: "关卡",
    instructions: "点击屏幕发射拦截导弹。保护你的城市！",
    winCondition: "达到1000分即可获胜。",
    allTowersDestroyed: "所有炮台已被摧毁！",
    left: "左",
    middle: "中",
    right: "右"
  }
};

export default function App() {
  const [lang, setLang] = useState<'en' | 'cn'>('cn');
  const t = TRANSLATIONS[lang];
  
  const [containerRef, bounds] = useMeasure();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [gameState, setGameState] = useState<GameState>({
    score: 0,
    status: GameStatus.START,
    round: 1,
    rocketsToSpawn: 0,
    towers: [],
    cities: [],
    rockets: [],
    interceptors: [],
    explosions: [],
    targetMarkers: []
  });

  const stateRef = useRef<GameState>(gameState);
  useEffect(() => {
    stateRef.current = gameState;
  }, [gameState]);

  const initGame = useCallback(() => {
    const towers = [
      { x: 50, y: CANVAS_HEIGHT - 40, missiles: TOWER_MISSILES[0], maxMissiles: TOWER_MISSILES[0], destroyed: false },
      { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT - 40, missiles: TOWER_MISSILES[1], maxMissiles: TOWER_MISSILES[1], destroyed: false },
      { x: CANVAS_WIDTH - 50, y: CANVAS_HEIGHT - 40, missiles: TOWER_MISSILES[2], maxMissiles: TOWER_MISSILES[2], destroyed: false },
    ];

    const citySpacing = (CANVAS_WIDTH - 200) / 7;
    const cities = Array.from({ length: 6 }).map((_, i) => {
      const x = 100 + (i < 3 ? i * citySpacing : (i + 1) * citySpacing);
      return { x, y: CANVAS_HEIGHT - 20, destroyed: false };
    });

    setGameState(prev => ({
      ...prev,
      score: 0,
      status: GameStatus.PLAYING,
      round: 1,
      rocketsToSpawn: 10,
      towers,
      cities,
      rockets: [],
      interceptors: [],
      explosions: [],
      targetMarkers: []
    }));
  }, []);

  const startNextRound = useCallback(() => {
    setGameState(prev => {
      const bonus = prev.towers.reduce((acc, t) => acc + (t.destroyed ? 0 : t.missiles * 5), 0);
      return {
        ...prev,
        score: prev.score + bonus,
        round: prev.round + 1,
        status: GameStatus.PLAYING,
        rocketsToSpawn: 10 + prev.round * 2,
        towers: prev.towers.map((t, i) => ({ ...t, missiles: TOWER_MISSILES[i], destroyed: false })),
        rockets: [],
        interceptors: [],
        explosions: [],
        targetMarkers: []
      };
    });
  }, []);

  const spawnRocket = useCallback(() => {
    const startX = Math.random() * CANVAS_WIDTH;
    const targets = [
      ...stateRef.current.cities.filter(c => !c.destroyed),
      ...stateRef.current.towers.filter(t => !t.destroyed)
    ];
    
    if (targets.length === 0) return;
    
    const target = targets[Math.floor(Math.random() * targets.length)];
    const id = Math.random().toString(36).substr(2, 9);
    
    const speed = ROCKET_SPEED_MIN + Math.random() * (ROCKET_SPEED_MAX - ROCKET_SPEED_MIN) + (stateRef.current.round * 0.1);

    const newRocket: Rocket = {
      id,
      start: { x: startX, y: 0 },
      end: { x: target.x, y: target.y },
      current: { x: startX, y: 0 },
      speed,
      color: COLORS.ROCKET
    };

    setGameState(prev => ({
      ...prev,
      rockets: [...prev.rockets, newRocket]
    }));
  }, []);

  const handleCanvasClick = (e: React.MouseEvent | React.TouchEvent) => {
    if (stateRef.current.status !== GameStatus.PLAYING) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_WIDTH / rect.width;
    const scaleY = CANVAS_HEIGHT / rect.height;
    
    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }

    const targetX = (clientX - rect.left) * scaleX;
    const targetY = (clientY - rect.top) * scaleY;

    // Find closest available tower
    const availableTowers = stateRef.current.towers
      .map((t, i) => ({ ...t, index: i }))
      .filter(t => !t.destroyed && t.missiles > 0)
      .sort((a, b) => getDistance({ x: targetX, y: targetY }, a) - getDistance({ x: targetX, y: targetY }, b));

    if (availableTowers.length === 0) return;

    const tower = availableTowers[0];
    const id = Math.random().toString(36).substr(2, 9);

    const newInterceptor: Interceptor = {
      id,
      start: { x: tower.x, y: tower.y },
      target: { x: targetX, y: targetY },
      current: { x: tower.x, y: tower.y },
      speed: INTERCEPTOR_SPEED,
      towerIndex: tower.index
    };

    setGameState(prev => {
      const newTowers = [...prev.towers];
      newTowers[tower.index].missiles -= 1;
      return {
        ...prev,
        interceptors: [...prev.interceptors, newInterceptor],
        targetMarkers: [...prev.targetMarkers, { x: targetX, y: targetY }],
        towers: newTowers
      };
    });
  };

  // Game Loop
  useEffect(() => {
    let animationFrameId: number;
    let lastSpawnTime = 0;

    const update = () => {
      if (stateRef.current.status !== GameStatus.PLAYING) return;

      const now = Date.now();
      const spawnInterval = Math.max(500, 2000 - (stateRef.current.round * 100));
      
      if (now - lastSpawnTime > spawnInterval && stateRef.current.rocketsToSpawn > 0) {
        spawnRocket();
        lastSpawnTime = now;
        setGameState(prev => ({ ...prev, rocketsToSpawn: prev.rocketsToSpawn - 1 }));
      }

      setGameState(prev => {
        const nextState = { ...prev };

        // Update Rockets
        nextState.rockets = prev.rockets.map(r => {
          const dist = getDistance(r.start, r.end);
          const currentDist = getDistance(r.start, r.current);
          const ratio = (currentDist + r.speed) / dist;
          
          if (ratio >= 1) {
            // Hit target
            const hitCity = nextState.cities.find(c => !c.destroyed && getDistance(c, r.end) < 5);
            if (hitCity) hitCity.destroyed = true;
            
            const hitTower = nextState.towers.find(t => !t.destroyed && getDistance(t, r.end) < 5);
            if (hitTower) hitTower.destroyed = true;

            // Create explosion at impact
            nextState.explosions.push({
              id: Math.random().toString(36).substr(2, 9),
              x: r.end.x,
              y: r.end.y,
              radius: 2,
              maxRadius: EXPLOSION_MAX_RADIUS,
              growing: true,
              alpha: 1
            });

            return null;
          }

          return {
            ...r,
            current: {
              x: r.start.x + (r.end.x - r.start.x) * ratio,
              y: r.start.y + (r.end.y - r.start.y) * ratio
            }
          };
        }).filter(Boolean) as Rocket[];

        // Update Interceptors
        nextState.interceptors = prev.interceptors.map(i => {
          const dist = getDistance(i.start, i.target);
          const currentDist = getDistance(i.start, i.current);
          const ratio = (currentDist + i.speed) / dist;

          if (ratio >= 1) {
            // Create explosion
            nextState.explosions.push({
              id: Math.random().toString(36).substr(2, 9),
              x: i.target.x,
              y: i.target.y,
              radius: 2,
              maxRadius: EXPLOSION_MAX_RADIUS,
              growing: true,
              alpha: 1
            });
            
            // Remove target marker
            nextState.targetMarkers = nextState.targetMarkers.filter(m => m.x !== i.target.x || m.y !== i.target.y);
            
            return null;
          }

          return {
            ...i,
            current: {
              x: i.start.x + (i.target.x - i.start.x) * ratio,
              y: i.start.y + (i.target.y - i.start.y) * ratio
            }
          };
        }).filter(Boolean) as Interceptor[];

        // Update Explosions
        nextState.explosions = prev.explosions.map(e => {
          let { radius, growing, alpha } = e;
          if (growing) {
            radius += EXPLOSION_GROWTH_SPEED;
            if (radius >= e.maxRadius) growing = false;
          } else {
            alpha -= EXPLOSION_FADE_SPEED;
          }

          if (alpha <= 0) return null;

          // Check collision with rockets
          nextState.rockets = nextState.rockets.filter(r => {
            if (getDistance(r.current, e) < radius) {
              nextState.score += ROCKET_SCORE;
              return false;
            }
            return true;
          });

          return { ...e, radius, growing, alpha };
        }).filter(Boolean) as Explosion[];

        // Check Win/Loss/Round End
        if (nextState.score >= WIN_SCORE) {
          nextState.status = GameStatus.VICTORY;
        } else if (nextState.towers.every(t => t.destroyed) || nextState.cities.every(c => c.destroyed)) {
          nextState.status = GameStatus.GAME_OVER;
        } else if (
          nextState.rocketsToSpawn === 0 && 
          nextState.rockets.length === 0 && 
          nextState.interceptors.length === 0 && 
          nextState.explosions.length === 0
        ) {
          nextState.status = GameStatus.ROUND_END;
        }

        return nextState;
      });

      animationFrameId = requestAnimationFrame(update);
    };

    animationFrameId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(animationFrameId);
  }, [spawnRocket]);

  // Rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let renderFrameId: number;
    const render = () => {
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      
      // Background
      ctx.fillStyle = COLORS.BACKGROUND;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      const state = stateRef.current;

      // Draw Cities
      state.cities.forEach(city => {
        if (city.destroyed) return;
        ctx.fillStyle = COLORS.CITY;
        ctx.fillRect(city.x - 15, city.y - 10, 30, 10);
        ctx.fillRect(city.x - 10, city.y - 20, 20, 10);
      });

      // Draw Towers
      state.towers.forEach(tower => {
        if (tower.destroyed) return;
        ctx.fillStyle = COLORS.TOWER;
        ctx.beginPath();
        ctx.moveTo(tower.x - 20, tower.y + 20);
        ctx.lineTo(tower.x + 20, tower.y + 20);
        ctx.lineTo(tower.x, tower.y - 20);
        ctx.closePath();
        ctx.fill();
        
        // Missile count text
        ctx.fillStyle = COLORS.TEXT;
        ctx.font = '12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(tower.missiles.toString(), tower.x, tower.y + 35);
      });

      // Draw Target Markers
      state.targetMarkers.forEach(m => {
        ctx.strokeStyle = COLORS.INTERCEPTOR;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(m.x - 6, m.y - 6);
        ctx.lineTo(m.x + 6, m.y + 6);
        ctx.moveTo(m.x + 6, m.y - 6);
        ctx.lineTo(m.x - 6, m.y + 6);
        ctx.stroke();
      });

      // Draw Rockets
      state.rockets.forEach(r => {
        // Trail
        const gradient = ctx.createLinearGradient(r.start.x, r.start.y, r.current.x, r.current.y);
        gradient.addColorStop(0, 'transparent');
        gradient.addColorStop(1, r.color);
        
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(r.start.x, r.start.y);
        ctx.lineTo(r.current.x, r.current.y);
        ctx.stroke();
        
        // Rocket head glow
        ctx.shadowBlur = 10;
        ctx.shadowColor = r.color;
        ctx.fillStyle = r.color;
        ctx.beginPath();
        ctx.arc(r.current.x, r.current.y, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      // Draw Interceptors
      state.interceptors.forEach(i => {
        ctx.strokeStyle = COLORS.INTERCEPTOR;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(i.start.x, i.start.y);
        ctx.lineTo(i.current.x, i.current.y);
        ctx.stroke();
        
        // Interceptor head
        ctx.fillStyle = COLORS.INTERCEPTOR;
        ctx.beginPath();
        ctx.arc(i.current.x, i.current.y, 2, 0, Math.PI * 2);
        ctx.fill();
      });

      // Draw Explosions
      state.explosions.forEach(e => {
        // Outer glow
        ctx.shadowBlur = 15;
        ctx.shadowColor = COLORS.INTERCEPTOR;
        
        ctx.fillStyle = `rgba(251, 191, 36, ${e.alpha * 0.4})`;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
        ctx.fill();
        
        // Middle layer
        ctx.fillStyle = `rgba(255, 150, 0, ${e.alpha * 0.6})`;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.radius * 0.8, 0, Math.PI * 2);
        ctx.fill();
        
        // Inner core
        ctx.shadowBlur = 0;
        ctx.fillStyle = `rgba(255, 255, 255, ${e.alpha * 0.9})`;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.radius * 0.4, 0, Math.PI * 2);
        ctx.fill();
      });

      renderFrameId = requestAnimationFrame(render);
    };

    renderFrameId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(renderFrameId);
  }, []);

  return (
    <div className="min-h-screen bg-[#050505] text-white font-mono selection:bg-emerald-500/30 flex flex-col items-center justify-center p-4 overflow-hidden">
      {/* Header UI */}
      <div className="w-full max-w-4xl flex items-center justify-between mb-4 px-4">
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-widest text-zinc-500">{t.score}</span>
            <span className="text-2xl font-bold text-emerald-400 leading-none">
              {gameState.score.toString().padStart(5, '0')}
            </span>
          </div>
          <div className="h-8 w-px bg-zinc-800" />
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-widest text-zinc-500">{t.round}</span>
            <span className="text-2xl font-bold text-blue-400 leading-none">
              {gameState.round}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={() => setLang(l => l === 'en' ? 'cn' : 'en')}
            className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 transition-colors"
          >
            <Languages size={18} className="text-zinc-400" />
          </button>
          <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5">
            <Shield size={14} className="text-blue-400" />
            <span className="text-xs font-bold uppercase tracking-wider">{t.title}</span>
          </div>
        </div>
      </div>

      {/* Game Container */}
      <div 
        ref={containerRef}
        className="relative w-full max-w-4xl aspect-[4/3] bg-black rounded-2xl border-4 border-zinc-800 shadow-2xl shadow-emerald-500/10 overflow-hidden cursor-crosshair"
      >
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          onClick={handleCanvasClick}
          onTouchStart={handleCanvasClick}
          className="w-full h-full block"
        />

        {/* Overlay Screens */}
        <AnimatePresence>
          {gameState.status === GameStatus.START && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm p-8 text-center"
            >
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                className="max-w-md"
              >
                <div className="mb-6 inline-flex p-4 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500">
                  <Target size={48} />
                </div>
                <h1 className="text-5xl font-black mb-4 tracking-tighter uppercase italic">
                  {t.title}
                </h1>
                <p className="text-zinc-400 mb-8 leading-relaxed">
                  {t.instructions}
                  <br />
                  <span className="text-emerald-500/80 text-sm mt-2 block italic">
                    {t.winCondition}
                  </span>
                </p>
                <button
                  onClick={initGame}
                  className="group relative px-8 py-4 bg-emerald-500 text-black font-black uppercase tracking-widest rounded-xl hover:bg-emerald-400 transition-all hover:scale-105 active:scale-95 flex items-center gap-2 mx-auto"
                >
                  <Play size={20} fill="currentColor" />
                  {t.start}
                </button>
              </motion.div>
            </motion.div>
          )}

          {(gameState.status === GameStatus.GAME_OVER || gameState.status === GameStatus.VICTORY || gameState.status === GameStatus.ROUND_END) && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/90 backdrop-blur-md p-8 text-center"
            >
              <motion.div
                initial={{ scale: 0.8, y: 30 }}
                animate={{ scale: 1, y: 0 }}
                className="max-w-md"
              >
                <div className={cn(
                  "mb-6 inline-flex p-6 rounded-3xl border-2",
                  gameState.status === GameStatus.VICTORY 
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500" 
                    : gameState.status === GameStatus.ROUND_END
                    ? "bg-blue-500/10 border-blue-500/30 text-blue-500"
                    : "bg-red-500/10 border-red-500/30 text-red-500"
                )}>
                  {gameState.status === GameStatus.VICTORY ? <Trophy size={64} /> : gameState.status === GameStatus.ROUND_END ? <Shield size={64} /> : <Zap size={64} />}
                </div>
                
                <h2 className={cn(
                  "text-6xl font-black mb-2 tracking-tighter uppercase italic",
                  gameState.status === GameStatus.VICTORY ? "text-emerald-500" : gameState.status === GameStatus.ROUND_END ? "text-blue-500" : "text-red-500"
                )}>
                  {gameState.status === GameStatus.VICTORY ? t.victory : gameState.status === GameStatus.ROUND_END ? `${t.round} ${gameState.round}` : t.gameOver}
                </h2>
                
                <p className="text-zinc-500 mb-8 uppercase tracking-[0.2em] font-bold">
                  {gameState.status === GameStatus.GAME_OVER ? t.allTowersDestroyed : gameState.status === GameStatus.ROUND_END ? "Round Complete" : t.winCondition}
                </p>

                <div className="grid grid-cols-2 gap-4 mb-10">
                  <div className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800">
                    <span className="text-[10px] text-zinc-500 uppercase block mb-1">{t.score}</span>
                    <span className="text-2xl font-bold text-white">{gameState.score}</span>
                  </div>
                  <div className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800">
                    <span className="text-[10px] text-zinc-500 uppercase block mb-1">{t.round}</span>
                    <span className="text-2xl font-bold text-white">{gameState.round}</span>
                  </div>
                </div>

                <button
                  onClick={gameState.status === GameStatus.ROUND_END ? startNextRound : initGame}
                  className="group relative w-full px-8 py-4 bg-white text-black font-black uppercase tracking-widest rounded-xl hover:bg-zinc-200 transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
                >
                  {gameState.status === GameStatus.ROUND_END ? <Play size={20} fill="currentColor" /> : <RotateCcw size={20} />}
                  {gameState.status === GameStatus.ROUND_END ? "Next Round" : t.restart}
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer Stats */}
      <div className="w-full max-w-4xl grid grid-cols-3 gap-4 mt-6">
        {gameState.towers.map((tower, i) => (
          <div 
            key={i}
            className={cn(
              "p-4 rounded-2xl border transition-all duration-500",
              tower.destroyed 
                ? "bg-red-500/5 border-red-500/20 grayscale" 
                : "bg-zinc-900 border-zinc-800"
            )}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                {i === 0 ? t.left : i === 1 ? t.middle : t.right}
              </span>
              <div className={cn(
                "w-2 h-2 rounded-full",
                tower.destroyed ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]" : "bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"
              )} />
            </div>
            <div className="flex items-end justify-between">
              <span className={cn(
                "text-3xl font-black leading-none",
                tower.destroyed ? "text-zinc-700" : "text-white"
              )}>
                {tower.missiles}
              </span>
              <div className="flex gap-0.5 h-4 items-end">
                {Array.from({ length: 10 }).map((_, j) => (
                  <div 
                    key={j}
                    className={cn(
                      "w-1 rounded-full transition-all",
                      j < (tower.missiles / tower.maxMissiles) * 10 
                        ? "bg-blue-500 h-full" 
                        : "bg-zinc-800 h-1"
                    )}
                  />
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 flex items-center gap-2 text-zinc-600">
        <Info size={14} />
        <p className="text-[10px] uppercase tracking-[0.2em]">
          {t.instructions}
        </p>
      </div>
    </div>
  );
}
