-- Keep clearly computer-specific work out of phone and tablet catalog filters.
UPDATE "repair_catalog_items"
SET "device_types" = ARRAY['COMPUTER', 'LAPTOP']::"RepairDeviceType"[]
WHERE "type" = 'SERVICE'
  AND "name" IN (
    'Замена материнской платы, включая установку драйверов',
    'Смазка вентилятора (на процессоре, БП)',
    'Установка дополнительных программ (офисных программ и мультимедийных приложений)',
    'Установка драйверов',
    'Чистка контактов (память, видео карта)'
  );
