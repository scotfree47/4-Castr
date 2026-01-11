export function rateLimit(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}