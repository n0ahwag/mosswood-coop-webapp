// Legt ein Demo-Tal mit vier Bewohnern an, damit man die Koop-Funktionen sofort ausprobieren kann.
// Aufruf: npm run db:seed -w server
import { prisma } from '../src/db.js';
import { createPlayer } from '../src/services/authService.js';

const NEIGHBOURS = ['Bo', 'Mika', 'Lene'];

async function main() {
  // Die Demo-Nachbarn haben das Hofbuch schon hinter sich.
  const first = await createPlayer({ displayName: 'Ida', skipTutorial: true });
  const code = first.valley.inviteCode;
  for (const displayName of NEIGHBOURS) {
    await createPlayer({ displayName, inviteCode: code, skipTutorial: true });
  }

  // Den Demo-Nachbarn etwas Vorrat geben, damit Projekte schon Fortschritt zeigen können.
  await prisma.village.updateMany({
    where: { owner: { valleyId: first.valley.id } },
    data: { inventory: { wood: 60, stone: 40, clay: 40, berries: 40, wheat: 30, planks: 30, bricks: 20, cloth: 8, meals: 12 } },
  });

  console.log(`🌱 Demo-Tal „${first.valley.name}“ angelegt.`);
  console.log(`   Einladungscode: ${code}`);
  console.log('   Melde dich im Client mit diesem Code an, um dem Tal beizutreten.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
