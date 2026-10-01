CREATE TABLE "support_conversations" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "support_conversations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "support_chat_messages" (
    "id" UUID NOT NULL,
    "chat_id" UUID NOT NULL,
    "sender_id" UUID,
    "content" VARCHAR(2000) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_chat_messages_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "support_conversations_customer_id_key"
    ON "support_conversations"("customer_id");
CREATE INDEX "support_conversations_updated_at_idx"
    ON "support_conversations"("updated_at");
CREATE INDEX "support_chat_messages_chat_id_created_at_idx"
    ON "support_chat_messages"("chat_id", "created_at");

ALTER TABLE "support_conversations"
    ADD CONSTRAINT "support_conversations_customer_id_fkey"
    FOREIGN KEY ("customer_id") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "support_chat_messages"
    ADD CONSTRAINT "support_chat_messages_chat_id_fkey"
    FOREIGN KEY ("chat_id") REFERENCES "support_conversations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "support_chat_messages"
    ADD CONSTRAINT "support_chat_messages_sender_id_fkey"
    FOREIGN KEY ("sender_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
