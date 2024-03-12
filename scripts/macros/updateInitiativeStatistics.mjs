import { anyTokens } from "../helpers/tokenHelpers.mjs";
import { MHLDialog } from "../classes/MHLDialog.mjs";
import { MODULE_ID, fu } from "../constants.mjs";
import { MHLError, requireSystem } from "../helpers/errorHelpers.mjs";
import { localize } from "../helpers/stringHelpers.mjs";

export async function updateInitiativeStatistics() {
  const PREFIX = "MHL.Macro.UpdateInitiativeStatistics";
  const func = "updateInitiativeStatistics";
  requireSystem("pf2e", `MHL | ${func}`);
  const tokens = anyTokens().filter(
    (t) => ["character", "npc"].includes(t.actor.type) && !t.actor.traits.intersects(new Set(["minion", "eidolon"]))
  );
  if (!tokens.length) throw MHLError(`${PREFIX}.Error.NoValidTokens`, { func });

  const renderCallback = (html) => {
    const allSelect = html.querySelector("select[name=all]");
    const actorSelects = Array.from(html.querySelectorAll("select:not([name=all])"));
    allSelect.addEventListener("change", (ev) => {
      let disabled = false;
      if (ev.target.value) disabled = true;
      for (const select of actorSelects) {
        select.disabled = disabled;
        select.dataset.tooltip = disabled ? localize(`${PREFIX}.DisabledTooltip`) : "";
      }
    });
  };

  const universalSkills = fu.deepClone(CONFIG.PF2E.skillList);
  delete universalSkills.lore; //remove the generic Lore entry
  const lores = {};

  const actorsData = tokens.reduce((actoracc, t) => {
    // handle the rare case of more than one linked token of the same actor
    if (actoracc.find((a) => a.uiid === t.actor.uuid)) return actoracc;
    actoracc.push({
      name: t.name,
      uuid: t.actor.uuid,
      skills: [["perception", { label: "PF2E.PerceptionLabel" }]]
        .concat(Object.entries(t.actor.skills).sort(([aslug, _], [bslug, __]) => aslug.localeCompare(bslug))) //do the sorting here so perception stays on top
        .map(([slug, statistic]) => [slug, statistic.label])
        .reduce((acc, [slug, label]) => {
          if (!(slug in universalSkills)) {
            lores[slug] ??= {
              label,
              count: 0,
            };
            lores[slug].count++;
          }
          acc[slug] = label;
          return acc;
        }, {}),
      current: t.actor.initiative.statistic.label,
    });
    return actoracc;
  }, []);

  const sharedLores = Object.entries(lores).reduce((acc, [slug, data]) => {
    if (data.count === tokens.length) {
      acc.push([slug, data.label]);
    }
    return acc;
  }, []);

  const allSharedSkills = Object.fromEntries(
    [["perception", "PF2E.PerceptionLabel"]].concat(
      Object.entries(universalSkills)
        .concat(sharedLores)
        .sort(([aslug, _], [bslug, __]) => aslug.localeCompare(bslug))
    )
  );

  const contentData = {
    allSharedSkills,
    actorsData,
  };
  const dialogData = {
    contentData,
    title: `Set Initiative Statistics`,
    content: `modules/${MODULE_ID}/templates/updateInitiativeStatistics.hbs`,
    buttons: {
      yes: {
        icon: "<i class='fas fa-check'></i>",
        label: `Apply Changes`,
        callback: MHLDialog.getFormData,
      },
      no: {
        icon: "<i class='fas fa-times'></i>",
        label: `Cancel Changes`,
        callback: () => false,
      },
    },
    close: () => null,
    default: "yes",
    render: renderCallback,
  };
  const dialogOptions = {
    classes: ["update-initiative-statistics"],
    width: "auto",
  };
  const response = await MHLDialog.wait(dialogData, dialogOptions);
  if (!response) return;
  const { all, ...data } = response;
  const actorUpdates = [];
  const synthUpdates = [];
  for (const actorData of actorsData) {
    const actor = fromUuidSync(actorData.uuid);
    const newStat = all || data[actorData.uuid];
    if (!newStat) continue;
    if (actorData.uuid.startsWith("Scene")) {
      synthUpdates.push(actor.update({ "system.initiative.statistic": newStat }));
    } else {
      actorUpdates.push({ _id: actor._id, "system.initiative.statistic": newStat });
    }
  }
  await Actor.updateDocuments(actorUpdates);
  await Promise.all(synthUpdates);
}
