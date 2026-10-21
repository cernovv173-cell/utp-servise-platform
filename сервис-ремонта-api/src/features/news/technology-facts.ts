export const technologyFactRotationIntervalMilliseconds = 2 * 60 * 60 * 1_000;

type TechnologyFactEntry = {
  id: string;
  title: string;
  content: string;
  sourceName: string;
  sourceUrl: string;
};

export type TechnologyFact = TechnologyFactEntry & {
  updatedAt: string;
  nextUpdateAt: string;
};

const technologyFacts: TechnologyFactEntry[] = [
  {
    id: "first-website",
    title: "Первый сайт рассказывал о самом интернете",
    content:
      "Первый сайт, созданный в CERN, был посвящён проекту World Wide Web и работал на компьютере NeXT. В 1993 году CERN открыл программное обеспечение веба для общего доступа.",
    sourceName: "CERN",
    sourceUrl: "https://home.cern/science/computing/the-birth-of-the-web",
  },
  {
    id: "wooden-mouse",
    title: "Первая компьютерная мышь была деревянной",
    content:
      "В 1964 году инженер Билл Инглиш сделал для проекта Дугласа Энгельбарта прототип мыши из красного дерева.",
    sourceName: "Computer History Museum",
    sourceUrl: "https://computerhistory.org/sri-mouse-mn052024/",
  },
  {
    id: "qr-code-origin",
    title: "QR-код появился на производстве",
    content:
      "DENSO WAVE разработала QR Code в 1994 году, чтобы эффективнее обрабатывать информацию на производстве. Благодаря расположенным по углам меткам код можно быстро считывать с разных направлений.",
    sourceName: "DENSO WAVE",
    sourceUrl:
      "https://www.denso-wave.com/en/system/qr/fundamental/qrcode/qrc/",
  },
  {
    id: "cambridge-coffee-webcam",
    title: "Одна из первых веб-камер следила за кофе",
    content:
      "В 1991 году сотрудники компьютерной лаборатории Кембриджа подключили камеру к кофейнику, чтобы проверять, есть ли кофе, не выходя из кабинета. Изображение обновлялось примерно три раза в минуту.",
    sourceName: "University of Cambridge",
    sourceUrl: "https://www.cl.cam.ac.uk/coffee/qsf.old/coffee.html",
  },
  {
    id: "arpanet-lo",
    title: "Первое сообщение ARPANET оборвалось на полуслове",
    content:
      "29 октября 1969 года команда UCLA пыталась передать по ARPANET слово LOGIN. Система остановилась после первых двух букв — так первым сообщением стало «LO».",
    sourceName: "UCLA — Leonard Kleinrock",
    sourceUrl: "https://www.lk.cs.ucla.edu/internet_first_words.html",
  },
  {
    id: "tcp-ip-flag-day",
    title: "Переход ARPANET на TCP/IP назвали «днём флага»",
    content:
      "1 января 1983 года ARPANET согласованно перешла с NCP на TCP/IP. Чтобы компьютеры продолжили общаться, подключённым узлам пришлось перейти на новые протоколы в один день.",
    sourceName: "Internet Society",
    sourceUrl:
      "https://www.internetsociety.org/internet/history-internet/brief-history-internet/",
  },
  {
    id: "bluetooth-name",
    title: "Bluetooth — не аббревиатура",
    content:
      "Название радиотехнологии взяли у датского короля Харальда Синезубого. Оно было временным кодовым именем: король символизировал объединение, а разработчики хотели объединить компьютерную и мобильную индустрии.",
    sourceName: "Bluetooth SIG",
    sourceUrl: "https://www.bluetooth.com/about-us/bluetooth-origin/",
  },
  {
    id: "intel-4004-calculator",
    title: "Первый коммерческий микропроцессор начался с калькулятора",
    content:
      "Intel 4004 дебютировал в 1971 году как первый коммерчески доступный микропроцессор. Его разработка началась с заказа японской компании Busicom на микросхемы для калькулятора.",
    sourceName: "Intel",
    sourceUrl:
      "https://www.intel.com/content/www/us/en/newsroom/opinion/chip-that-changed-world.html",
  },
  {
    id: "ramac-five-megabytes",
    title: "Первый дисковый накопитель хранил всего 5 МБ",
    content:
      "Компьютер IBM RAMAC 1956 года стал первым компьютером с дисковым накопителем произвольного доступа. Он хранил около 5 МБ данных, а оборудование занимало значительную часть комнаты.",
    sourceName: "IBM",
    sourceUrl: "https://www.ibm.com/history/ramac",
  },
  {
    id: "ethernet-memo",
    title: "Ethernet начался с записки инженера",
    content:
      "22 мая 1973 года исследователь Xerox PARC Роберт Меткалф написал записку с предложением Ethernet — способа соединять компьютеры в локальную сеть.",
    sourceName: "Computer History Museum",
    sourceUrl: "https://www.computerhistory.org/tdih/may/22/",
  },
  {
    id: "mark-ii-moth",
    title: "В журнал компьютера Mark II действительно вклеили мотылька",
    content:
      "В 1947 году инженеры нашли мотылька в одном из компонентов Mark II и вклеили его в журнал работ. Слово «bug» для неполадок использовали задолго до компьютеров, но этот случай помог сделать историю знаменитой.",
    sourceName: "Smithsonian National Museum of American History",
    sourceUrl:
      "https://www.americanhistory.si.edu/ne/collections/object/nmah_334663",
  },
  {
    id: "line-mode-browser",
    title: "Ранний браузер показывал только текст",
    content:
      "Line Mode Browser, разработанный в CERN в 1991 году, не отображал изображения и помещал текст в окно размером 80 на 24 символа.",
    sourceName: "CERN",
    sourceUrl: "https://home.cern/why-bring-back-line-mode-browser/",
  },
];

export const getCurrentTechnologyFact = (
  now: Date = new Date(),
): TechnologyFact => {
  const currentSlot = Math.floor(
    now.getTime() / technologyFactRotationIntervalMilliseconds,
  );
  const factIndex =
    ((currentSlot % technologyFacts.length) + technologyFacts.length) %
    technologyFacts.length;
  const updatedAt = currentSlot * technologyFactRotationIntervalMilliseconds;

  return {
    ...technologyFacts[factIndex]!,
    updatedAt: new Date(updatedAt).toISOString(),
    nextUpdateAt: new Date(
      updatedAt + technologyFactRotationIntervalMilliseconds,
    ).toISOString(),
  };
};
