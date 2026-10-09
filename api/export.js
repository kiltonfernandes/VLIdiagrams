import { readWorkspace } from '../lib/workspace.js';
import { exportHandler } from '../lib/export-handler.js';
export const runtime='nodejs';
export const maxDuration=60;
export default exportHandler(readWorkspace);
