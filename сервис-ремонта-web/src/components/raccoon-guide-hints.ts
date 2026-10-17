export type RaccoonGuideHint = {
  title: string;
  message: string;
  action?: { label: string; href: string };
};

export const getRaccoonGuideHint = (active: string, role: string): RaccoonGuideHint => {
  if (active === "/") {
    return {
      title: "Я рядом",
      message:
        role === "ADMIN"
          ? "Здесь можно быстро перейти к заказам и управлению сервисом."
          : "Нужен ремонт? Начните с раздела «Заявки» — я подскажу по ходу оформления.",
      action: { label: "Открыть заявки", href: "/orders" },
    };
  }

  if (active === "/orders" || active.startsWith("/admin/orders")) {
    return {
      title: "Подсказка по заявкам",
      message:
        role === "ADMIN"
          ? "Откройте карточку заказа, чтобы изменить статус, мастера или срок ремонта."
          : "Нажмите «Создать заявку», опишите неисправность и прикрепите фото, если это поможет мастеру.",
    };
  }

  if (active === "/devices") {
    return {
      title: "Ваша техника",
      message:
        "Сохраните компьютер или ноутбук один раз — повторную заявку потом оформить быстрее.",
      action: { label: "Открыть мои заявки", href: "/orders" },
    };
  }

  if (active === "/support" || active.startsWith("/support/")) {
    return {
      title: "Нужна помощь?",
      message: "В чате поддержки можно задать вопрос сервису и вернуться к нему позже.",
    };
  }

  if (active === "/game" || active.startsWith("/game/")) {
    return {
      title: "Подсказка игры",
      message:
        "Подсказка следующего хода не расходует ход — используйте её, если поле застопорилось.",
    };
  }

  if (active === "/loyalty") {
    return {
      title: "Бонусные баллы",
      message:
        "Здесь виден баланс и правила его использования — баллы дают скидку, но не являются деньгами.",
    };
  }

  if (active === "/news") {
    return {
      title: "Новости сервиса",
      message: "Следите за объявлениями, акциями и полезными материалами от сервиса.",
    };
  }

  if (active === "/account") {
    return {
      title: "Личный кабинет",
      message: "В профиле можно обновить контактные данные и настройки аккаунта.",
    };
  }

  return {
    title: "Я помогу сориентироваться",
    message:
      "Используйте меню слева или сверху, чтобы открыть нужный раздел. Подсказки можно выключить здесь.",
  };
};
