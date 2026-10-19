import { Prisma } from "../../generated/prisma/client.js";
import type { DatabaseClient } from "../../lib/database/database.js";
import { HttpError } from "../../lib/http/http-error.js";
import type { MediaStorage } from "../media/media-storage.js";

type CustomerMediaReader = Pick<
  Prisma.TransactionClient,
  "user" | "repairOrder" | "review" | "craftOrder" | "$queryRaw"
>;

const MAX_MEDIA_CLEANUP_PASSES = 5;

const findCustomerMediaObjectIds = async (
  database: CustomerMediaReader,
  customerId: string,
): Promise<string[]> => {
  const [customer, repairOrders, reviews, craftOrders] = await Promise.all([
    database.user.findFirst({
      where: { id: customerId, role: "CUSTOMER" },
      select: { avatarObjectId: true },
    }),
    database.repairOrder.findMany({
      where: { customerId },
      select: {
        photos: { select: { objectId: true } },
        intake: {
          select: {
            frontPhotoObjectId: true,
            backPhotoObjectId: true,
            leftPhotoObjectId: true,
            rightPhotoObjectId: true,
          },
        },
      },
    }),
    database.review.findMany({
      where: { customerId },
      select: { imageObjectId: true },
    }),
    database.craftOrder.findMany({
      where: { customerId },
      select: {
        chatMessages: { select: { imageObjectId: true } },
      },
    }),
  ]);

  const objectIds = [
    customer?.avatarObjectId,
    ...repairOrders.flatMap((order) => [
      ...order.photos.map((photo) => photo.objectId),
      order.intake?.frontPhotoObjectId,
      order.intake?.backPhotoObjectId,
      order.intake?.leftPhotoObjectId,
      order.intake?.rightPhotoObjectId,
    ]),
    ...reviews.map((review) => review.imageObjectId),
    ...craftOrders.flatMap((order) =>
      order.chatMessages.map((message) => message.imageObjectId),
    ),
  ];

  return [...new Set(objectIds.filter((id): id is string => Boolean(id)))];
};

const isMediaObjectReferencedElsewhere = async (
  database: Pick<Prisma.TransactionClient, "$queryRaw">,
  customerId: string,
  objectId: string,
): Promise<boolean> => {
  const rows = await database.$queryRaw<Array<{ referenced: boolean }>>`
    SELECT EXISTS (
      SELECT 1 FROM users
      WHERE id <> ${customerId}::uuid AND avatar_object_id = ${objectId}
      UNION ALL
      SELECT 1 FROM repair_order_photos photo
      JOIN repair_orders repair_order ON repair_order.id = photo.order_id
      WHERE repair_order.customer_id <> ${customerId}::uuid
        AND photo.object_id = ${objectId}
      UNION ALL
      SELECT 1 FROM repair_order_intakes intake
      JOIN repair_orders repair_order ON repair_order.id = intake.order_id
      WHERE repair_order.customer_id <> ${customerId}::uuid
        AND ${objectId} IN (
          intake.front_photo_object_id,
          intake.back_photo_object_id,
          intake.left_photo_object_id,
          intake.right_photo_object_id
        )
      UNION ALL
      SELECT 1 FROM reviews
      WHERE customer_id <> ${customerId}::uuid AND image_object_id = ${objectId}
      UNION ALL
      SELECT 1 FROM craft_order_chat_messages message
      JOIN craft_orders craft_order ON craft_order.id = message.craft_order_id
      WHERE craft_order.customer_id <> ${customerId}::uuid
        AND message.image_object_id = ${objectId}
      UNION ALL
      SELECT 1 FROM news_articles WHERE image_object_id = ${objectId}
      UNION ALL
      SELECT 1 FROM craft_items WHERE image_object_id = ${objectId}
      UNION ALL
      SELECT 1 FROM site_banners WHERE image_object_id = ${objectId}
    ) AS referenced
  `;

  return rows[0]?.referenced ?? false;
};

const deleteCustomerMedia = async (
  database: Pick<Prisma.TransactionClient, "$queryRaw">,
  storage: MediaStorage,
  customerId: string,
  objectIds: readonly string[],
  processedObjectIds: Set<string>,
): Promise<void> => {
  for (const objectId of objectIds) {
    if (processedObjectIds.has(objectId)) continue;

    const shared = await isMediaObjectReferencedElsewhere(
      database,
      customerId,
      objectId,
    );
    if (!shared) {
      try {
        await storage.delete(objectId);
      } catch {
        throw new HttpError(
          503,
          "CUSTOMER_MEDIA_CLEANUP_PENDING",
          "Удаление не завершено: учётная запись отключена, но фотографии пока не удалось очистить. Повторите попытку позже.",
        );
      }
    }

    processedObjectIds.add(objectId);
  }
};

const findAndLockCustomer = async (
  transaction: Prisma.TransactionClient,
  customerId: string,
) => {
  await transaction.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM users WHERE id = ${customerId}::uuid FOR UPDATE
  `;

  const customer = await transaction.user.findFirst({
    where: { id: customerId, role: "CUSTOMER" },
    select: {
      id: true,
      email: true,
      displayName: true,
      active: true,
    },
  });

  if (!customer)
    throw new HttpError(404, "CUSTOMER_NOT_FOUND", "Клиент не найден.");

  return customer;
};

const deleteCustomerRecords = async (
  transaction: Prisma.TransactionClient,
  customerId: string,
): Promise<void> => {
  const [repairOrders, craftOrders] = await Promise.all([
    transaction.repairOrder.findMany({
      where: { customerId },
      select: { id: true },
    }),
    transaction.craftOrder.findMany({
      where: { customerId },
      select: { id: true },
    }),
  ]);
  const repairOrderIds = repairOrders.map(({ id }) => id);
  const craftOrderIds = craftOrders.map(({ id }) => id);

  if (repairOrderIds.length > 0) {
    await transaction.technicianSalaryEntry.deleteMany({
      where: { orderId: { in: repairOrderIds } },
    });
  }

  if (craftOrderIds.length > 0) {
    await transaction.craftOrderReceipt.deleteMany({
      where: { craftOrderId: { in: craftOrderIds } },
    });
    await transaction.craftOrderSalaryEntry.deleteMany({
      where: { craftOrderId: { in: craftOrderIds } },
    });
  }

  if (repairOrderIds.length > 0) {
    await transaction.repairOrder.deleteMany({
      where: { id: { in: repairOrderIds } },
    });
  }
  if (craftOrderIds.length > 0) {
    await transaction.craftOrder.deleteMany({
      where: { id: { in: craftOrderIds } },
    });
  }

  await transaction.review.deleteMany({ where: { customerId } });
  await transaction.supportConversation.deleteMany({ where: { customerId } });
  await transaction.loyaltyTransaction.deleteMany({ where: { customerId } });
  await transaction.customerReferral.deleteMany({
    where: { OR: [{ referrerId: customerId }, { inviteeId: customerId }] },
  });
  await transaction.customerOfferParticipation.deleteMany({
    where: { customerId },
  });
  await transaction.gameEpisodeCompletion.deleteMany({
    where: { customerId },
  });
  await transaction.match3GameSession.deleteMany({ where: { customerId } });
  await transaction.match3LevelCompletion.deleteMany({
    where: { customerId },
  });
  await transaction.match3LevelReward.deleteMany({ where: { customerId } });
  await transaction.match3Inventory.deleteMany({ where: { customerId } });

  await transaction.user.delete({ where: { id: customerId } });
};

export const deleteCustomerAndData = async (
  database: DatabaseClient,
  storage: MediaStorage,
  customerId: string,
): Promise<{ id: string; email: string; displayName: string }> => {
  await database.$transaction(async (transaction) => {
    await findAndLockCustomer(transaction, customerId);
    await transaction.session.deleteMany({ where: { userId: customerId } });
    await transaction.user.update({
      where: { id: customerId },
      data: { active: false },
    });
  });

  const processedObjectIds = new Set<string>();

  for (let attempt = 0; attempt < MAX_MEDIA_CLEANUP_PASSES; attempt += 1) {
    const objectIds = await findCustomerMediaObjectIds(database, customerId);
    await deleteCustomerMedia(
      database,
      storage,
      customerId,
      objectIds,
      processedObjectIds,
    );

    const result = await database.$transaction(async (transaction) => {
      const customer = await findAndLockCustomer(transaction, customerId);
      const currentObjectIds = await findCustomerMediaObjectIds(
        transaction,
        customerId,
      );
      const pendingObjectIds = currentObjectIds.filter(
        (objectId) => !processedObjectIds.has(objectId),
      );
      if (pendingObjectIds.length > 0) return { status: "pending" as const };

      await deleteCustomerRecords(transaction, customerId);
      return {
        status: "deleted" as const,
        customer: {
          id: customer.id,
          email: customer.email,
          displayName: customer.displayName,
        },
      };
    });

    if (result.status === "deleted") return result.customer;
  }

  throw new HttpError(
    503,
    "CUSTOMER_DELETE_RETRY_REQUIRED",
    "Удаление не завершено: учётная запись отключена. Повторите попытку, чтобы очистить оставшиеся фотографии и записи.",
  );
};
