import PocketBase from "pocketbase";

const BASE = process.env.REACT_APP_PB_URL || "/pb"; // adjust for your dev/prod proxy
export const pb = new PocketBase(BASE);

// Disable auto-cancellation while debugging client errors so we can see raw responses.
// The SDK auto-aborts previous requests by default which can wrap the original error.
// Set back to `true` after debugging if you want auto-cancellation behavior.
pb.autoCancellation(true);
