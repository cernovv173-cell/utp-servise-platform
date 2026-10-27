-- Permanently retire game progress and cosmetic state.
-- Historical GAME_REWARD ledger entries remain in loyalty_transactions.
BEGIN;

DROP TABLE IF EXISTS public.game_answer_options;
DROP TABLE IF EXISTS public.game_episode_completions;
DROP TABLE IF EXISTS public.game_questions;
DROP TABLE IF EXISTS public.game_episodes;

DROP TABLE IF EXISTS public.match3_game_sessions;
DROP TABLE IF EXISTS public.match3_level_completions;
DROP TABLE IF EXISTS public.match3_level_rewards;
DROP TABLE IF EXISTS public.raccoon_match3_sessions;
DROP TABLE IF EXISTS public.match3_inventory;
DROP TABLE IF EXISTS public.match3_levels;

ALTER TABLE public.users DROP COLUMN IF EXISTS match3_cosmetic_id;

COMMIT;
