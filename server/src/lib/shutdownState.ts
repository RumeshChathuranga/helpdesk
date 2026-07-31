let shuttingDown = false;

/** Flips as soon as SIGTERM/SIGINT is received — /api/health/ready checks this
 *  so a load balancer sees 503 before the listener actually closes. */
export function isShuttingDown(): boolean {
  return shuttingDown;
}

export function setShuttingDown(value: boolean): void {
  shuttingDown = value;
}
