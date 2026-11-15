ALTER TYPE "CustomerOfferType" ADD VALUE 'QUIZ';

ALTER TABLE "customer_offers"
ADD COLUMN "quiz_question" VARCHAR(1000),
ADD COLUMN "quiz_options" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "quiz_correct_option" SMALLINT;

ALTER TABLE "customer_offer_participations"
ADD COLUMN "answer_index" SMALLINT,
ADD COLUMN "answer_correct" BOOLEAN;
