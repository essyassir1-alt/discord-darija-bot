import winston from 'winston';

// Logger setup
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.colorize(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} [${level}]: ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

// Sleep helper
export const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Format time
export const formatTime = (date) => {
  return date.toLocaleTimeString('en-US', { hour12: false });
};

// Truncate text
export const truncate = (text, maxLength = 100) => {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
};
