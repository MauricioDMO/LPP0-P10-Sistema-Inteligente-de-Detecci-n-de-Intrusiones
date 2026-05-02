import { createClient } from "redis";

const client = createClient({
  url: "redis://localhost:6379",
});

client.on("error", (err) => {
  console.error("Redis error:", err);
});

async function start() {
  await client.connect();

  console.log("Conectado a Redis, escuchando canal...");

  await client.subscribe("suricata", (message) => {
    try {
      const data = JSON.parse(message);
      console.log("📡 Evento recibido:", data);
    } catch {
      console.log("📡 Evento recibido (raw):", message);
    }
  });
}

start();