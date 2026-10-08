CREATE TABLE "order_chat_admin_reads" (
  "chat_id" UUID NOT NULL,
  "admin_id" UUID NOT NULL,
  "last_read_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "order_chat_admin_reads_pkey" PRIMARY KEY ("chat_id", "admin_id"),
  CONSTRAINT "order_chat_admin_reads_chat_id_fkey"
    FOREIGN KEY ("chat_id") REFERENCES "order_chats"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "order_chat_admin_reads_admin_id_fkey"
    FOREIGN KEY ("admin_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "order_chat_admin_reads_admin_id_last_read_at_idx"
  ON "order_chat_admin_reads"("admin_id", "last_read_at");
