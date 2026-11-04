import { TECHS } from '../game/content.js';
import { computeEffects } from '../game/effects.js';
import { hasResources, takeResources } from '../game/engine.js';
import { GameError } from '../utils/errors.js';
import { createVillager, mutateVillage } from './villageService.js';

export function unlockTech(user, techKey) {
  const tech = TECHS[techKey];
  if (!tech) return Promise.reject(new GameError('Unbekannte Forschung', 'NOT_FOUND', 404));

  return mutateVillage(
    user.village.id,
    async (snap, { tx }) => {
      if (snap.techKeys.includes(techKey)) throw new GameError(`${tech.name} ist bereits erforscht`);
      for (const req of tech.requires) {
        if (!snap.techKeys.includes(req)) {
          throw new GameError(`Benötigt zuerst: ${TECHS[req].name}`);
        }
      }
      if (!hasResources(snap.inventory, tech.cost)) {
        throw new GameError('Dafür hast du nicht genug Rohstoffe');
      }

      takeResources(snap.inventory, tech.cost);
      try {
        await tx.researchUnlock.create({
          data: tech.scope === 'valley'
            ? { techKey, valleyId: user.valleyId }
            : { techKey, userId: user.id },
        });
      } catch (err) {
        if (err?.code === 'P2002') throw new GameError(`${tech.name} wurde gerade schon erforscht`);
        throw err;
      }
      snap.techKeys.push(techKey);

      // Neue Hütte → neuer Dorfbewohner
      const { villagerSlots } = computeEffects(snap.techKeys);
      const newcomers = [];
      while (snap.villagers.length < villagerSlots) {
        newcomers.push((await createVillager(tx, snap)).name);
      }
      return { techKey, name: tech.name, icon: tech.icon, scope: tech.scope, newcomers };
    },
    { serializable: tech.scope === 'valley' },
  );
}
