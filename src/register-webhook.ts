import { getHeaders, API, API_URL } from "./lib";
import axios from "axios";

export async function activateWebhook() {
  console.log(process.env.NODE_ENV);
  if (process.env.NODE_ENV === "development") {
    console.info("this is development mode");
  }

  console.info("LALAMOVE WEBHOOK ACTIVATION to", {
    url: process.env.WEBHOOK_URL,
  });

  const body = JSON.stringify({
    data: {
      url: process.env.WEBHOOK_URL,
    },
  });

  const headers = getHeaders({
    method: "PATCH",
    path: API.WEBHOOK,
    body,
    market: "MY",
  });

  try {
    const response = await axios(`${API_URL}${API.WEBHOOK}`, {
      method: "PATCH",
      data: body,
      headers: Object.fromEntries(headers),
    });

    const data = await response.data;

    if (data.errors) {
      console.error("LALAMOVE WEBHOOK ACTIVATION ERROR", {
        errors: data.errors,
      });
    }

    return data;
  } catch (error) {
    console.error(error);
  }
}

activateWebhook();
