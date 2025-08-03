import {
  validateWebhook,
  getHeaders,
  API,
  API_URL,
  sendGChatMessage,
  fetchWithTimeout,
} from "./lib";
import { executeQuery } from "./db";
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";

type lalamoveWebhookEvents = "ORDER_STATUS_CHANGED";
type lalamoveOrderStatus = "COMPLETED" | "CANCELLED";
type lalamoveStopStatus = "PENDING" | "DELIVERED" | "FAILED";

interface LalamoveWebhookPayload {
  apiKey: string;
  timestamp: number;
  signature: string;
  eventType: lalamoveWebhookEvents;
  data: {
    updatedAt: string;
    order: {
      orderId: string;
      status: lalamoveOrderStatus;
    };
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

async function fetchOrderDetails(
  orderId: string
): Promise<LalamoveOrderDetails | null> {
  try {
    const path = API.ORDER_DETAILS.replace(":orderId", orderId);
    const headers = getHeaders({
      method: "GET",
      path,
      body: "",
    });

    const response = await fetchWithTimeout(
      `${API_URL}${path}`,
      {
        method: "GET",
        headers,
      },
      15000
    ); // 15 second timeout for Lalamove API

    if (!response.ok) {
      console.error(
        `Failed to fetch order details for ${orderId}:`,
        response.status
      );
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error(`Error fetching order details for ${orderId}:`, error);
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

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  let body: LalamoveWebhookPayload;

  try {
    const rawBody = event.body;
    if (rawBody) {
      body = JSON.parse(rawBody);
      const valid = validateWebhook(body);

      if (!valid) {
        await sendGChatMessage({
          message: `Invalid webhook signature: ${body.signature}`,
        });

        return {
          statusCode: 400,
          body: JSON.stringify({ error: "Invalid Webhook" }),
        };
      }

      await sendGChatMessage({
        message: `Webhook received: ${JSON.stringify(body)}`,
      });

      console.debug("LALAMOVE WEBHOOK BODY", { body });
    } else {
      console.debug("LALAMOVE WEBHOOK: Empty body received");
      await sendGChatMessage({
        message: "LALAMOVE WEBHOOK: Empty body received",
      });
      return {
        statusCode: 200,
        body: JSON.stringify({ message: "Post webhook activation data" }),
      };
    }
  } catch (error) {
    console.error("Error parsing request body", { error });
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Invalid JSON in request body" }),
    };
  }

  if (body && body.eventType === "ORDER_STATUS_CHANGED") {
    const { orderId, status } = body.data.order;

    console.log(`Order ${orderId} status changed to: ${status}`);

    // If order is completed, fetch detailed order information
    if (status === "COMPLETED") {
      try {
        const orderDetails = await fetchOrderDetails(orderId);

        if (orderDetails) {
          console.log(`Fetched order details for completed order ${orderId}`);
          await sendGChatMessage({
            message: `Order ${orderId} status changed to: ${status}`,
          });
          // await updateOrderInDatabase(orderDetails);

          return {
            statusCode: 200,
            body: JSON.stringify({
              message: "Webhook received, order details fetched and updated",
              orderId: orderId,
              status: status,
            }),
          };
        } else {
          console.error(
            `Failed to fetch order details for completed order ${orderId}`
          );
          return {
            statusCode: 200,
            body: JSON.stringify({
              message: "Webhook received but failed to fetch order details",
              orderId: orderId,
              status: status,
            }),
          };
        }
      } catch (error) {
        console.error(`Error processing completed order ${orderId}:`, error);

        // Handle timeout errors specifically
        const errorMessage =
          error instanceof Error && error.message.includes("timeout")
            ? "Request timeout while processing order"
            : "Error processing completed order";

        return {
          statusCode: 500,
          body: JSON.stringify({
            error: errorMessage,
            orderId: orderId,
          }),
        };
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Webhook received and status updated",
        orderId: orderId,
        status: status,
      }),
    };
  } else {
    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Webhook received" }),
    };
  }
};
