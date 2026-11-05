-- Hofbuch: Fortschritt pro Dorf
ALTER TABLE "Village" ADD COLUMN "questStep" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Village" ADD COLUMN "stats" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "Village" ADD COLUMN "questBase" JSONB NOT NULL DEFAULT '{}';

-- Bestehende Höfe hatten schon alle Gebäude: Hofbuch für sie als abgeschlossen markieren.
-- (12 = Anzahl der Aufgaben in server/src/game/content.js)
UPDATE "Village" SET "questStep" = 12;