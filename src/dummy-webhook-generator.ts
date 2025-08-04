import { createHmac } from "crypto";

(async () => {
  const secret = process.env.SECRET;
  const apiKey = process.env.API_KEY;

  if (!secret || !apiKey) {
    throw new Error(
      "Missing required environment variables: SECRET and API_KEY"
    );
  }
  const time = Date.now().toString();
  const rawSignature = `${time}\r\n${"POST"}\r\n${"/Prod/bt-lalamove-webhook-v2"}\r\n\r\n${JSON.stringify(
    {
      order: {
        orderId: "186102479770",
        scheduleAt: "2025-08-03T16:00.00Z",
        shareLink:
          "https://share.lalamove.com/?MY100250803154824238410030060235211&lang=en_MY&sign=78776f66bdd8b42a28b9c99916820442&source=api_wrapper",
        market: "MY_JHB",
        createdAt: "2025-08-03T15:48.00Z",
        driverId: "2809512",
        previousStatus: "PICKED_UP",
        status: "COMPLETED",
      },
      updatedAt: "2025-08-03T16:43.00Z",
    }
  )}`;

  const SIGNATURE = createHmac("sha256", secret)
    .update(rawSignature)
    .digest("hex");
  const token = `${apiKey}:${time}:${SIGNATURE}`;

  await fetch(
    "https://2neyhlbgk4.execute-api.ap-southeast-1.amazonaws.com/Prod/bt-lalamove-webhook-v2",
    {
      method: "POST",
      body: JSON.stringify({
        apiKey: apiKey,
        timestamp: time,
        signature: SIGNATURE,
        eventId: "76F529D2-851A-4A52-A62F-2CC41D73780C",
        eventType: "ORDER_STATUS_CHANGED",
        eventVersion: "v3",
        data: {
          order: {
            orderId: "186102479770",
            scheduleAt: "2025-08-03T16:00.00Z",
            shareLink:
              "https://share.lalamove.com/?MY100250803154824238410030060235211&lang=en_MY&sign=78776f66bdd8b42a28b9c99916820442&source=api_wrapper",
            market: "MY_JHB",
            createdAt: "2025-08-03T15:48.00Z",
            driverId: "2809512",
            previousStatus: "PICKED_UP",
            status: "COMPLETED",
          },
          updatedAt: "2025-08-03T16:43.00Z",
        },
      }),
    }
  ).then((res) => {
    const res1 = res.json();
    console.log(res1);
  });
})();
