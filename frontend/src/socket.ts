import { io } from 'socket.io-client';

// Use relative path - Vite proxy forwards /socket.io to backend
export const socket = io({
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000
});
