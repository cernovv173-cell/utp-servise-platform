CREATE TABLE "order_chats" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "admin_requested_at" TIMESTAMPTZ(3),
    "admin_requested_by_id" UUID,
    "admin_joined_at" TIMESTAMPTZ(3),
    "admin_joined_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "order_chats_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "order_chats_order_id_key" ON "order_chats"("order_id");
CREATE INDEX "order_chats_admin_requested_at_admin_joined_at_updated_at_idx" ON "order_chats"("admin_requested_at", "admin_joined_at", "updated_at");

CREATE TABLE "order_chat_messages" (
    "id" UUID NOT NULL,
    "chat_id" UUID NOT NULL,
    "sender_id" UUID,
    "content" VARCHAR(2000) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "order_chat_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "order_chat_messages_chat_id_created_at_idx" ON "order_chat_messages"("chat_id", "created_at");

ALTER TABLE "order_chats" ADD CONSTRAINT "order_chats_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "repair_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "order_chats" ADD CONSTRAINT "order_chats_admin_requested_by_id_fkey" FOREIGN KEY ("admin_requested_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "order_chats" ADD CONSTRAINT "order_chats_admin_joined_by_id_fkey" FOREIGN KEY ("admin_joined_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "order_chat_messages" ADD CONSTRAINT "order_chat_messages_chat_id_fkey" FOREIGN KEY ("chat_id") REFERENCES "order_chats"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "order_chat_messages" ADD CONSTRAINT "order_chat_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
