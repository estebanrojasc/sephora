const STORAGE_KEY = "qwen-visor-device-id";

export function getOrCreateDeviceId(): string {
  if (typeof window === "undefined") return "server-device";

  let id = localStorage.getItem(STORAGE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, id);
  }
  return id;
}
