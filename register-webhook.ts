import { getHeaders, API, API_URL, fetchWithTimeout } from "./lib";

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
    const response = await fetchWithTimeout(
      `${API_URL}${API.WEBHOOK}`,
      {
        method: "PATCH",
        body,
        headers,
      },
      15000
    ); // 15 second timeout for webhook registration

    const data = await response.json();

    if (data.errors) {
      console.error("WEBHOOK ACTIVATION ERROR", { errors: data.errors });
    }

    return data;
  } catch (error) {
    console.error(error);
  }
}

activateWebhook();
