import type { DatabaseClient } from "../../lib/database/database.js";

export const BIRTHDAY_BONUS_POINTS = 250;
export const BIRTHDAY_BONUS_REASON = "Подарок ко дню рождения";

export const awardBirthdayBonusPoints = (
  database: DatabaseClient,
  birthdayYear: number,
  monthDay: string,
): Promise<number> =>
  database.$executeRaw`
    WITH eligible AS (
      SELECT customer.id AS user_id
      FROM users AS customer
      WHERE customer.role = 'CUSTOMER'
        AND customer.active = TRUE
        AND customer.birth_date IS NOT NULL
        AND to_char(customer.birth_date, 'MM-DD') = ${monthDay}
    ), new_awards AS (
      INSERT INTO birthday_bonus_awards (id, user_id, birthday_year)
      SELECT gen_random_uuid(), eligible.user_id, ${birthdayYear}
      FROM eligible
      ON CONFLICT (user_id, birthday_year) DO NOTHING
      RETURNING user_id
    )
    INSERT INTO loyalty_transactions (id, customer_id, type, points, reason)
    SELECT
      gen_random_uuid(),
      customer.id,
      'EARN'::"BonusTransactionType",
      ${BIRTHDAY_BONUS_POINTS},
      ${BIRTHDAY_BONUS_REASON}
    FROM new_awards
    JOIN users AS customer ON customer.id = new_awards.user_id
  `;
