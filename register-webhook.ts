import "dotenv/config";
import { getHeaders, API, API_URL } from "./lib";

export async function activateWebhook() {
  console.log(process.env.NODE_ENV);
  if (process.env.NODE_ENV === "development") {
    console.info("this is development mode");
  }

  console.info("WEBHOOK ACTIVATION to", { url: process.env.WEBHOOK_URL });

  const body = JSON.stringify({
    data: {
      url: process.env.WEBHOOK_URL,
    },
  });

  const headers = getHeaders({
    method: "PATCH",
    path: API.WEBHOOK,
    body,
  });

  try {
    const response = await fetch(`${API_URL}${API.WEBHOOK}`, {
      method: "PATCH",
      body,
      headers,
    });

    const data = await response.json();

    if (data.errors) {
      console.error("WEBHOOK ACTIVATION ERROR", { errors: data.errors });
    }

    return data;
  } catch (error) {
    console.error(error);
  }
}

// activateWebhook();
