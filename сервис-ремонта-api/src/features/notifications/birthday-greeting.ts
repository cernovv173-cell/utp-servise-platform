export const formatBirthdayGreeting = (
  name: string,
  gender: "MALE" | "FEMALE" | null,
): string => {
  const salutation =
    gender === "FEMALE"
      ? `Уважаемая ${name.trim()}`
      : gender === "MALE"
        ? `Уважаемый ${name.trim()}`
        : `Здравствуйте, ${name.trim()}`;
  return `${salutation},
От всей души поздравляю Вас с днём рождения!
Желаю Вам крепкого здоровья, неиссякаемой энергии и новых свершений! Пусть каждый день приносит радость, благополучие и гармонию, а все намеченные цели и планы успешно реализуются.
С наилучшими пожеланиями и глубоким уважением, ваш ЕНОТ.`;
};
