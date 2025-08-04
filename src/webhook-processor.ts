import { getHeaders, API, API_URL, sendGChatMessage } from "./lib";
import { executeQuery } from "./db";
import type { SQSEvent } from "aws-lambda";
import axios from "axios";

type lalamoveWebhookEvents = "ORDER_STATUS_CHANGED";
type lalamoveOrderStatus = "COMPLETED" | "CANCELLED";

type LalamoveWebhookOrderDetail = {
  orderId: string;
  status: lalamoveOrderStatus;
  market: string;
  driverId: string;
  previousStatus: string;
};

interface LalamoveWebhookPayload {
  apiKey: string;
  timestamp: number;
  signature: string;
  eventType: lalamoveWebhookEvents;
  data: {
    updatedAt: string;
    order: LalamoveWebhookOrderDetail;
  };
}

interface LalamoveOrderDetails {
  data: {
    orderId: string;
    quotationId: string;
    priceBreakdown: {
      base: string;
      specialRequests: string;
      priorityFee?: string;
      multiStopSurcharge: string;
      totalExcludePriorityFee: string;
      total: string;
      currency: string;
    };
    driverId: string;
    shareLink: string;
    status: string;
    distance: {
      value: string;
      unit: string;
    };
    stops: Array<{
      coordinates: {
        lat: string;
        lng: string;
      };
      address: string;
      name: string;
      phone: string;
      POD?: {
        status: string;
        image?: string;
        deliveredAt?: string;
      };
      delivery_code: {
        value: string;
        status: string;
      };
    }>;
    metadata: {
      group_id: string;
    };
  };
}

interface QueueMessage {
  payload: {
    webhookData: LalamoveWebhookPayload;
  };
}

export async function fetchOrderDetails(
  orderId: string,
  market: string
): Promise<LalamoveOrderDetails | null> {
  try {
    const path = API.ORDER_DETAILS.replace(":orderId", orderId);
    const headers = getHeaders({
      method: "GET",
      path,
      body: "",
      market,
    });

    console.debug(`LALAMOVE: Fetching order details for ${orderId}`);

    const response = await axios(`${API_URL}${path}`, {
      method: "GET",
      headers: Object.fromEntries(headers),
      timeout: 15000,
    });

    if (response.status !== 200) {
      console.error(
        `LALAMOVE: Failed to fetch order details for ${orderId}:`,
        response.status
      );
      return null;
    }

    return response.data;
  } catch (error) {
    console.error(
      `LALAMOVE: Error fetching order details for ${orderId}:`,
      error
    );
    return null;
  }
}

async function updateOrderInDatabase(orderDetails: LalamoveOrderDetails) {
  try {
    const { data } = orderDetails;

    // Update main order record
    await executeQuery(
      `
      UPDATE LalamoveOrders 
      SET 
        Status = @status,
        DriverId = @driverId,
        ShareLink = @shareLink,
        TotalAmount = @totalAmount,
        Currency = @currency,
        Distance = @distance,
        UpdatedAt = GETDATE()
      WHERE OrderId = @orderId
    `,
      {
        orderId: data.orderId,
        status: data.status,
        driverId: data.driverId,
        shareLink: data.shareLink,
        totalAmount: parseFloat(data.priceBreakdown.total),
        currency: data.priceBreakdown.currency,
        distance: parseInt(data.distance.value),
      }
    );

    // Update delivery stops
    for (let i = 0; i < data.stops.length; i++) {
      const stop = data.stops[i];

      if (stop) {
        await executeQuery(
          `
          UPDATE LalamoveStops 
          SET 
            DeliveryStatus = @deliveryStatus,
            DeliveredAt = @deliveredAt,
            PODImage = @podImage,
            UpdatedAt = GETDATE()
          WHERE OrderId = @orderId AND StopSequence = @stopSequence
        `,
          {
            orderId: data.orderId,
            stopSequence: i,
            deliveryStatus: stop.POD?.status || "PENDING",
            deliveredAt: stop.POD?.deliveredAt
              ? new Date(stop.POD.deliveredAt)
              : null,
            podImage: stop.POD?.image || null,
          }
        );
      }
    }

    console.log(`Successfully updated order ${data.orderId} in database`);
  } catch (error) {
    console.error("Error updating order in database:", error);
    throw error;
  }
}

async function processWebhookMessage(message: QueueMessage): Promise<void> {
  const { payload } = message;
  console.log("LALAMOVE: Processing webhook message:", {
    eventType: payload.webhookData.eventType,
    orderId: payload.webhookData.data.order.orderId,
    status: payload.webhookData.data.order.status,
  });

  if (payload.webhookData.eventType === "ORDER_STATUS_CHANGED") {
    const { orderId, status, market } = payload.webhookData.data.order;

    console.log(`LALAMOVE: Order ${orderId} status changed to: ${status}`);

    // If order is completed, fetch detailed order information and update database
    if (status === "COMPLETED") {
      try {
        const orderDetails = await fetchOrderDetails(orderId, market);

        if (orderDetails) {
          console.log(
            `LALAMOVE: Fetched order details for completed order ${orderId}`
          );

          // Update database with order details
          // await updateOrderInDatabase(orderDetails);

          // Send notification
          await sendGChatMessage({
            message: `Order ${orderId} completed successfully and database updated`,
          });

          console.log(
            `LALAMOVE: Successfully processed completed order ${orderId}`
          );
        } else {
          console.error(
            `LALAMOVE: Failed to fetch order details for completed order ${orderId}`
          );

          // Send notification about the failure
          await sendGChatMessage({
            message: `Failed to fetch order details for completed order ${orderId}`,
          });

          throw new Error(`Failed to fetch order details for order ${orderId}`);
        }
      } catch (error) {
        console.error(
          `LALAMOVE: Error processing completed order ${orderId}:`,
          error
        );

        // Send notification about the error
        await sendGChatMessage({
          message: `Error processing completed order ${orderId}: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        });

        throw error; // Re-throw to trigger DLQ
      }
    } else {
      console.log(
        `LALAMOVE: Order ${orderId} status updated to ${status} (no further processing required)`
      );
    }
  } else {
    console.log(
      `LALAMOVE: Unsupported event type: ${payload.webhookData.eventType}`
    );
  }
}

export const handler = async (event: SQSEvent): Promise<void> => {
  console.log(`LALAMOVE: Processing ${event.Records.length} SQS messages`);

  for (const record of event.Records) {
    try {
      console.log("LALAMOVE: Processing SQS record:", {
        messageId: record.messageId,
        receiptHandle: record.receiptHandle.substring(0, 20) + "...",
        body: record,
      });

      // Process the webhook message
      await processWebhookMessage({
        payload: JSON.parse(record.body),
      });

      console.log(
        "LALAMOVE: Successfully processed SQS record:",
        record.messageId
      );
    } catch (error) {
      console.error("LALAMOVE: Error processing SQS record:", {
        messageId: record.messageId,
        error: error instanceof Error ? error.message : "Unknown error",
      });

      // Re-throw the error to trigger SQS retry/DLQ behavior
      throw error;
    }
  }

  console.log("LALAMOVE: Finished processing all SQS messages");
};
