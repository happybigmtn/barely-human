'use client';

import React, { useState, useEffect } from 'react';

// AI Bot personalities for the minimal interface
const AI_BOTS = [
  { name: 'Alice', emoji: '🎯', trait: 'Aggressive', status: 'betting', confidence: 0.9, action: 'All-in on Pass Line' },
  { name: 'Bob', emoji: '🧮', trait: 'Analytical', status: 'thinking', confidence: 0.7, action: 'Calculating odds...' },
  { name: 'Charlie', emoji: '🍀', trait: 'Lucky', status: 'celebrating', confidence: 0.8, action: 'Following hot streak' },
  { name: 'Diana', emoji: '❄️', trait: 'Methodical', status: 'waiting', confidence: 0.6, action: 'Waiting for signal' },
  { name: 'Eddie', emoji: '🎭', trait: 'Theatrical', status: 'betting', confidence: 0.85, action: 'Making it rain!' },
] as const;

interface DiceDisplayProps {
  value: number;
  isRolling: boolean;
}

function DiceDisplay({ value, isRolling }: DiceDisplayProps) {
  return (
    <div className={`w-16 h-16 bg-white rounded-xl shadow-sm flex items-center justify-center text-2xl font-mono transition-transform duration-300 ${isRolling ? 'animate-bounce' : ''}`}>
      {isRolling ? '⋯' : value}
    </div>
  );
}

function BotCard({ bot, index }: { bot: typeof AI_BOTS[0]; index: number }) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'betting': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'thinking': return 'text-amber-600 bg-amber-50 border-amber-200';
      case 'celebrating': return 'text-green-600 bg-green-50 border-green-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  return (
    <div className={`p-4 rounded-xl border transition-all duration-300 hover:scale-105 ${getStatusColor(bot.status)}`}>
      <div className="text-center">
        <div className="text-2xl mb-2">{bot.emoji}</div>
        <div className="font-medium text-sm mb-1">{bot.name}</div>
        <div className="text-xs opacity-75 mb-2">{bot.trait}</div>
        <div className="text-xs font-mono">{bot.action}</div>
        <div className="mt-2 bg-white/50 rounded-full h-1">
          <div 
            className="bg-current h-full rounded-full transition-all duration-500" 
            style={{ width: `${bot.confidence * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}

export function LiveGameView() {
  const [isRolling, setIsRolling] = useState(false);
  const [dice, setDice] = useState({ die1: 4, die2: 3 });
  const [bots, setBots] = useState(AI_BOTS);
  const [gamePhase, setGamePhase] = useState<'idle' | 'playing'>('idle');
  
  // Simulate bot behavior updates
  useEffect(() => {
    const interval = setInterval(() => {
      setBots(prev => prev.map(bot => ({
        ...bot,
        confidence: Math.max(0.1, Math.min(1, bot.confidence + (Math.random() - 0.5) * 0.1)),
        status: Math.random() > 0.8 ? 
          (['thinking', 'betting', 'celebrating', 'waiting'] as const)[Math.floor(Math.random() * 4)] : 
          bot.status
      })));
    }, 3000);
    
    return () => clearInterval(interval);
  }, []);
  
  const rollDice = () => {
    setIsRolling(true);
    setGamePhase('playing');
    
    setTimeout(() => {
      const die1 = Math.floor(Math.random() * 6) + 1;
      const die2 = Math.floor(Math.random() * 6) + 1;
      setDice({ die1, die2 });
      setIsRolling(false);
    }, 1200);
  };
  
  const startGame = () => {
    setGamePhase('playing');
    rollDice();
  };
  
  const total = dice.die1 + dice.die2;

  return (
    <div className="card-minimal">
      {/* Clean Header */}
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-light text-gray-900">
          AI Personalities in Action
        </h2>
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
          <span className="text-sm text-gray-500">Live</span>
        </div>
      </div>

      {/* AI Bots - The Core Experience */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
        {bots.map((bot, index) => (
          <BotCard key={bot.name} bot={bot} index={index} />
        ))}
      </div>

      {/* Simple Game Display */}
      <div className="bg-gray-50 rounded-2xl p-8 text-center">
        {/* Minimal Dice */}
        <div className="flex justify-center space-x-4 mb-6">
          <DiceDisplay value={dice.die1} isRolling={isRolling} />
          <DiceDisplay value={dice.die2} isRolling={isRolling} />
        </div>

        {/* Game State */}
        <div className="mb-6">
          <div className="text-xl font-light text-gray-900 mb-1">
            {gamePhase === 'idle' ? 'Ready to Watch' : 'Bots Playing'}
          </div>
          {!isRolling && (
            <div className="text-gray-500">
              Total: {total}
            </div>
          )}
        </div>

        {/* Minimal Action Button */}
        {gamePhase === 'idle' ? (
          <button
            onClick={startGame}
            className="btn-minimal btn-primary"
          >
            Watch AI Bots Play
          </button>
        ) : (
          <button
            onClick={rollDice}
            disabled={isRolling}
            className="btn-minimal btn-secondary disabled:opacity-50"
          >
            {isRolling ? 'Rolling...' : 'Next Roll'}
          </button>
        )}
      </div>

      {/* What Makes Us Special */}
      <div className="mt-8 pt-8 border-t border-gray-200">
        <h3 className="text-lg font-light text-gray-900 mb-4">
          Each AI has a unique personality and betting strategy
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
          <div>
            <strong>Alice 🎯</strong> goes all-in on high-risk bets
          </div>
          <div>
            <strong>Bob 🧮</strong> calculates every probability
          </div>
          <div>
            <strong>Charlie 🍀</strong> follows superstitious patterns
          </div>
        </div>
      </div>
    </div>
  );
}