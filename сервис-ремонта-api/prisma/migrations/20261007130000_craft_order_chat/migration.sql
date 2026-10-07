CREATE TABLE "craft_order_chat_messages" (
  "id" UUID NOT NULL,
  "craft_order_id" UUID NOT NULL,
  "sender_id" UUID,
  "content" VARCHAR(2000) NOT NULL DEFAULT '',
  "image_object_id" VARCHAR(255),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "craft_order_chat_messages_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "craft_order_chat_messages_has_content_or_image"
    CHECK (length(btrim("content")) > 0 OR "image_object_id" IS NOT NULL),
  CONSTRAINT "craft_order_chat_messages_craft_order_id_fkey"
    FOREIGN KEY ("craft_order_id") REFERENCES "craft_orders"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "craft_order_chat_messages_sender_id_fkey"
    FOREIGN KEY ("sender_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "craft_order_chat_messages_craft_order_id_created_at_idx"
  ON "craft_order_chat_messages"("craft_order_id", "created_at");
CREATE INDEX "craft_order_chat_messages_image_object_id_idx"
  ON "craft_order_chat_messages"("image_object_id");
