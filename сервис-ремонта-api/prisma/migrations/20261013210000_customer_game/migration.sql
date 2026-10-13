ALTER TYPE "BonusTransactionType" ADD VALUE 'GAME_REWARD';

CREATE TABLE "game_episodes" (
    "id" UUID NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "introduction" VARCHAR(1000) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "game_episodes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "game_questions" (
    "id" UUID NOT NULL,
    "episode_id" UUID NOT NULL,
    "position" SMALLINT NOT NULL,
    "prompt" VARCHAR(500) NOT NULL,
    "correct_feedback" VARCHAR(500) NOT NULL,
    "incorrect_feedback" VARCHAR(500) NOT NULL,
    CONSTRAINT "game_questions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "game_answer_options" (
    "id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "text" VARCHAR(300) NOT NULL,
    "is_correct" BOOLEAN NOT NULL DEFAULT false,
    "position" SMALLINT NOT NULL,
    CONSTRAINT "game_answer_options_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "game_episode_completions" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "episode_id" UUID NOT NULL,
    "points_awarded" SMALLINT NOT NULL DEFAULT 0,
    "completed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "game_episode_completions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "game_questions_episode_id_position_key" ON "game_questions"("episode_id", "position");
CREATE INDEX "game_questions_episode_id_idx" ON "game_questions"("episode_id");
CREATE UNIQUE INDEX "game_answer_options_question_id_position_key" ON "game_answer_options"("question_id", "position");
CREATE INDEX "game_answer_options_question_id_idx" ON "game_answer_options"("question_id");
CREATE INDEX "game_episodes_is_active_created_at_idx" ON "game_episodes"("is_active", "created_at");
CREATE UNIQUE INDEX "game_episode_completions_customer_id_episode_id_key" ON "game_episode_completions"("customer_id", "episode_id");
CREATE INDEX "game_episode_completions_customer_id_completed_at_idx" ON "game_episode_completions"("customer_id", "completed_at");

ALTER TABLE "game_episodes"
    ADD CONSTRAINT "game_episodes_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "game_questions"
    ADD CONSTRAINT "game_questions_episode_id_fkey"
    FOREIGN KEY ("episode_id") REFERENCES "game_episodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "game_answer_options"
    ADD CONSTRAINT "game_answer_options_question_id_fkey"
    FOREIGN KEY ("question_id") REFERENCES "game_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "game_episode_completions"
    ADD CONSTRAINT "game_episode_completions_customer_id_fkey"
    FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "game_episode_completions_episode_id_fkey"
    FOREIGN KEY ("episode_id") REFERENCES "game_episodes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "game_episodes" ("id", "title", "introduction", "is_active", "updated_at")
VALUES (
    'd4b60b1a-61ae-4c6e-a223-7ded6e2c2001',
    'Заявка с секретом: шумный компьютер',
    'Компьютер шумит и выключается во время игры. Помогите еноту-мастеру безопасно уточнить проблему и подготовить хорошую заявку.',
    true,
    CURRENT_TIMESTAMP
);

INSERT INTO "game_questions" ("id", "episode_id", "position", "prompt", "correct_feedback", "incorrect_feedback")
VALUES
    ('d4b60b1a-61ae-4c6e-a223-7ded6e2c2101', 'd4b60b1a-61ae-4c6e-a223-7ded6e2c2001', 0,
     'Что важно уточнить у клиента в первую очередь?',
     'Верно: важно узнать, при какой нагрузке появляется шум и когда компьютер выключается.',
     'Не совсем. Для первичной заявки важно уточнить симптомы и обстоятельства, а не запрашивать секретные данные или предлагать разборку.'),
    ('d4b60b1a-61ae-4c6e-a223-7ded6e2c2102', 'd4b60b1a-61ae-4c6e-a223-7ded6e2c2001', 1,
     'Дыма и запаха гари нет. Какой следующий шаг безопаснее?',
     'Отлично: остановить нагрузку, выключить компьютер, дать ему остыть и передать диагностику специалисту.',
     'Нет, продолжать нагрузку или вскрывать блок питания небезопасно. Не разбирайте компьютер; прекратите использование и обратитесь к специалисту.'),
    ('d4b60b1a-61ae-4c6e-a223-7ded6e2c2103', 'd4b60b1a-61ae-4c6e-a223-7ded6e2c2001', 2,
     'Что поможет мастеру быстрее понять заявку?',
     'Верно: модель устройства, наблюдаемые симптомы и условия, при которых они проявляются.',
     'Нет. Пароли и платёжные данные не нужны. Опишите устройство, симптомы и обстоятельства появления проблемы.');

INSERT INTO "game_answer_options" ("id", "question_id", "text", "is_correct", "position")
VALUES
    ('d4b60b1a-61ae-4c6e-a223-7ded6e2c2201', 'd4b60b1a-61ae-4c6e-a223-7ded6e2c2101', 'Когда начались шум и отключения и возникают ли они только во время игры?', true, 0),
    ('d4b60b1a-61ae-4c6e-a223-7ded6e2c2202', 'd4b60b1a-61ae-4c6e-a223-7ded6e2c2101', 'Какой пароль от учётной записи можно записать в заявку?', false, 1),
    ('d4b60b1a-61ae-4c6e-a223-7ded6e2c2203', 'd4b60b1a-61ae-4c6e-a223-7ded6e2c2101', 'Можно сразу открыть блок питания и проверить его внутри?', false, 2),
    ('d4b60b1a-61ae-4c6e-a223-7ded6e2c2211', 'd4b60b1a-61ae-4c6e-a223-7ded6e2c2102', 'Прекратить игру, выключить компьютер, дать остыть и не вскрывать его самостоятельно.', true, 0),
    ('d4b60b1a-61ae-4c6e-a223-7ded6e2c2212', 'd4b60b1a-61ae-4c6e-a223-7ded6e2c2102', 'Оставить игру работать, чтобы проверить, когда он выключится.', false, 1),
    ('d4b60b1a-61ae-4c6e-a223-7ded6e2c2213', 'd4b60b1a-61ae-4c6e-a223-7ded6e2c2102', 'Снять крышку блока питания и осмотреть детали.', false, 2),
    ('d4b60b1a-61ae-4c6e-a223-7ded6e2c2221', 'd4b60b1a-61ae-4c6e-a223-7ded6e2c2103', 'Модель компьютера, описание шума и отключений, а также когда это происходит.', true, 0),
    ('d4b60b1a-61ae-4c6e-a223-7ded6e2c2222', 'd4b60b1a-61ae-4c6e-a223-7ded6e2c2103', 'Пароль от компьютера и реквизиты банковской карты.', false, 1),
    ('d4b60b1a-61ae-4c6e-a223-7ded6e2c2223', 'd4b60b1a-61ae-4c6e-a223-7ded6e2c2103', 'Только слово «сломался», без других подробностей.', false, 2);
