'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import { useNotifications, useGameStore } from '@/store/gameStore';
import { cn } from '@/lib/utils';

const iconMap = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
  warning: AlertTriangle,
};

const colorMap = {
  success: 'text-neon-green border-neon-green/30 bg-neon-green/10',
  error: 'text-neon-red border-neon-red/30 bg-neon-red/10',
  info: 'text-neon-blue border-neon-blue/30 bg-neon-blue/10',
  warning: 'text-neon-yellow border-neon-yellow/30 bg-neon-yellow/10',
};

export function NotificationContainer() {
  const notifications = useNotifications();
  const { removeNotification } = useGameStore();

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
      <AnimatePresence>
        {notifications.map((notification) => {
          const Icon = iconMap[notification.type];
          
          return (
            <motion.div
              key={notification.id}
              initial={{ opacity: 0, x: 100, scale: 0.8 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 100, scale: 0.8 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className={cn(
                'glass-card rounded-lg p-4 shadow-lg border backdrop-blur-md',
                colorMap[notification.type]
              )}
            >
              <div className="flex items-start space-x-3">
                <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" />
                
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white break-words">
                    {notification.message}
                  </p>
                </div>
                
                <button
                  onClick={() => removeNotification(notification.id)}
                  className="flex-shrink-0 text-gray-400 hover:text-white transition-colors p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}