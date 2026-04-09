/**
 * Passenger Entry Point for cPanel Node.js Deployment
 *
 * This file is required by Phusion Passenger (used by cPanel's Node.js Selector)
 * It imports and exports the Express app from your main server file.
 *
 * IMPORTANT:
 * - This file MUST be in the root of your application directory
 * - It MUST be specified in cPanel's "Application startup file" setting
 * - Do NOT call server.listen() here - Passenger handles port binding
 */

import { app } from './src/server.js';

// Export the app for Passenger to handle HTTP requests
export default app;
