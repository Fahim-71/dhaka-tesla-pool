// Entry point for Vercel's serverless Node runtime.
// An Express app is a (req, res) handler, so it can be exported as-is.
// vercel.json rewrites every path to this function; Express then routes it.
// (Locally and in Docker, src/server.js calls app.listen() instead.)
import { createApp } from '../src/app.js';

export default createApp();
