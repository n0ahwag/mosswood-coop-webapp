-- Gebäude werden jetzt mit Rohstoffen gebaut statt über das Hofbuch freigeschaltet.
-- Forschungsturm und Bahnhof sind eigene Gebäude (Wahrzeichen) und öffnen Forschung bzw. Tal.

-- Höfe, die Forschung oder Tal schon hatten, bekommen die passenden Wahrzeichen.
-- (Altes Hofbuch: Forschung ab Aufgabe 6, Tal ab Aufgabe 9.)
INSERT INTO "Building" ("id", "type", "villageId")
SELECT 'lab' || md5(random()::text || v."id"), 'researchLab', v."id"
FROM "Village" v
WHERE v."questStep" >= 6
ON CONFLICT ("villageId", "type") DO NOTHING;

INSERT INTO "Building" ("id", "type", "villageId")
SELECT 'stn' || md5(random()::text || v."id"), 'trainStation', v."id"
FROM "Village" v
WHERE v."questStep" >= 9
ON CONFLICT ("villageId", "type") DO NOTHING;

-- Alte Aufgabennummern (12 Aufgaben) auf das neue Hofbuch (15 Aufgaben) abbilden.
-- Bau-Aufgaben, deren Gebäude schon stehen, schließt der Server beim nächsten Laden selbst ab.
UPDATE "Village" SET "questStep" = CASE "questStep"
  WHEN 6 THEN 7
  WHEN 7 THEN 8
  WHEN 8 THEN 9
  WHEN 9 THEN 10
  WHEN 10 THEN 12
  WHEN 11 THEN 14
  WHEN 12 THEN 15
  ELSE "questStep"
END;
