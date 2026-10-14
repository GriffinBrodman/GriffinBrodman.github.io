/* The Guide page (#/guide). */
(function () {
  const A = App;
  const { S, el } = A;
  const { panel } = Views;

  const GUIDE = [
    ["How it works", [
      ["Watching, not playing", "You make a hero with the quiz, then you watch. Every run of the league is one day. Heroes decide for themselves where to go, who to drink with and when to run."],
      ["Seasons", "A season lasts a few weeks of days. At the start, every hero wakes up in a random town (bigger towns are likelier). At the end come awards for heroes and parties, then a fresh start. Levels, gear, scars and grudges carry over."],
      ["Joining", "Heroes made mid-season join at the next season start. Until then they wait on the Roster under \"Joining next season\"."],
      ["Your hero", "Pick your hero on the Crier (or press \"This is mine\" on their page). They will be pinned to the top of the Crier whenever you check in. \"Switch hero\" changes it."],
    ]],
    ["Heroes", [
      ["Renown", "Fame. It comes from fights won, floors cleared, bosses slain, silver earned and stories told about you. It drives the standings and the awards."],
      ["A steady hand", "Renown for careful heroes. Cautious heroes skip the risky fights that pay out the most fame, so instead they earn a little renown for every clean fight they win and every job they finish properly: the more cautious the hero, the more. Bold heroes earn none of it."],
      ["Boldness", "How brave a hero is in a fight. Bold heroes hold the line longer before breaking and running."],
      ["Risk tolerance", "How big a gamble a hero will take when choosing what to do: deeper dungeons, longer odds, dice at the tavern."],
      ["Other traits", "Greed, sociability, honour, curiosity, temper and loyalty. They shape choices (skimming loot, picking fights, staying with a party). Big events can shift them, and the Crier will notice."],
      ["Titles", "A hero's class name is their title, from Warrior to Lich. Evolved classes are earned by how a hero actually fights. Faction members also carry a rank (Squire, Knight, Paladin...), shown under their name."],
      ["Stress", "Builds up from danger and bad days. A night at the tavern or a quiet rest brings it down. Stressed heroes argue more."],
      ["Classes", "Everyone starts as a Warrior, Ranger or Mage. At levels 9 and 18 a hero evolves into a new class shaped by what sets them apart (heal a lot and you lean holy, loot corpses and you lean dark). Crowded classes are harder to get into. The first few heroes to reach level 21 become Legends; once those places are taken, the age has its Legends."],
      ["Scars", "Bad fights leave marks: a lost eye, a hook for a hand, burn scars. They change stats and appearance for good."],
      ["Death", "Heroes can die. The fallen get a funeral (if anyone pays for it) and a spot on the History page. Their bodies may be sold to a necromancer first."],
    ]],
    ["Parties", [
      ["Forming up", "Lonely heroes go looking for company in taverns, around campfires and on the road. Most heroes find a party in the first week or so."],
      ["Morale", "A party's mood, 0 to 100. Wins, silver and good company raise it. Losses, poverty, arguments and skimmed loot lower it. Low morale means members leave or the party breaks up."],
      ["Disposition", "A party's attitude to other parties: honorable, friendly, wary, territorial or predatory (other parties look like walking purses). It decides whether meetings on the road end in a shared fire or a robbery."],
      ["Party awards", "Parties get their own season awards, a party of the week and power rankings, alongside the heroes'."],
      ["Party goal", "Every party, and every hero on their own, picks one goal a season: a boss to bring down, a purse to fill, places to see. The season's ceremony counts who got there; a goal that didn't happen just becomes part of the story."],
      ["Vow", "A promise sworn after a big moment: to repay a rescue, to get even for a robbery, never to pay a toll. Kept vows make the Crier. Broken ones too."],
    ]],
    ["Skills, gear and fights", [
      ["Skills", "Every level brings a skill, picked by what the hero has been doing: patch up friends and healing comes; sneak about and shadow tricks follow. Some skills are for fights, some are always on, and some are for the road (trading, singing, cooking, tracking)."],
      ["Schools", "Each skill belongs to a school. Heroes drift toward the schools they use, and their class changes follow. The schools: {schools}."],
      ["Signature", "The fighting skill a hero has used most. It sits on their page, gold, and it's what the taverns know them for."],
      ["Keystones ✦", "At levels 10 and 20 every hero earns a keystone: a big, one-of-a-kind gift. Only one living hero holds each one. Some change how a hero always fights or lives; others spring at a moment (a killing blow, a friend falling). They stay for good. Tap a ✦ badge to read what it does."],
      ["Front row and back row", "Blades, axes, maces and daggers stand in front and take the hits. Bows, crossbows, staffs and wands fight from the back, where foes have a harder time reaching. Spears hold the front for fighters and the back for everyone else."],
      ["Gear", "Weapon and armour come in tiers, from battered to masterwork. The Kit shows what each piece adds: more power on every blow, more armour against every hit. Hats, cloaks and off-hands add a little protection or a knack. Plain rings and necklaces are worn for show."],
      ["Horses and wagons", "Horses aren't pets: they're how heroes get about. Mounts and wagons make the road quicker, from about a tenth for a donkey cart to about 40% for the fastest horses (short hops still take a day, but the time saved adds up: ride in by midday and the afternoon in town is yours) and carry more; a warhorse charges in a fight (on the road, never underground). Crews can chip in for a wagon: a donkey cart, an ox wagon that carries a house, or a carriage with cushions that every bandit notices. If some ride and some walk, the crew goes at walking pace, and the riders say so. Luxury-lovers hate a bumpy cart; misers hate a carriage. Every town has stables on the Map. Very rarely, someone finds a unicorn, a giant eagle or a skeleton horse."],
      ["Magic items", "Rare finds from deep floors, bosses and odd deals, each with its own name, look and story. They can be lost, sold, stolen or handed down. The History page lists every one found this age."],
      ["How a fight ends", "Each side has resolve: its nerve, the bar over each team in a replay. Hits, fallen friends and fear wear it down. When it breaks, that side runs; some are cut down as they go, and strong friends carry the fallen out. Between heroes, the losers may surrender instead. If one side is all down, it's a wipe. If nobody breaks for many rounds, both sides back off."],
    ]],
    ["The world", [
      ["Delve", "An expedition into a dungeon that can last days. Each day the crew dives deeper, maps side passages, sweeps for loot, rests in a cleared chamber, takes on the boss or climbs out. Bold crews dive; careful ones map first, and a mapped lair makes the boss fight fairer."],
      ["Explored", "How much of a dungeon has been opened up, from untouched to picked clean. A worked-over dungeon is safer but pays less. Something always moves back in: it slowly fills up again, and a lot faster when a new boss arrives."],
      ["Maps", "Heroes map what they explore and can sell copies to a town's mapmaker. Other crews buy them before setting out."],
      ["Hunt", "A trip into the wilderness for pelts, herbs and bounties. Lower risk, lower reward."],
      ["Monsters", "Dungeons can be teeming, normal, recovering or thinned out. Clearing a dungeon thins it out for a while, and slain bosses are eventually replaced."],
      ["The economy", "Every town pays different prices. Heroes remember prices and swap tips, so some carry loot across the map to sell it better. The undertaker in Ashfen pays well for remains, no questions asked."],
      ["Watch the fight", "Notable fights are kept as replays. Look for \"watch\" next to a story."],
    ]],
  ];
  A.route(/^\/guide$/, (v) => {
    v.appendChild(el("h1", null, "The Guide"));
    v.appendChild(el("p", { class: "muted" }, "Everything you need to follow the league, in one page."));
    const g = el("div", { class: "grid2 even" });
    for (const [title, items] of GUIDE) {
      const dl = el("dl", { class: "kv guide" });
      for (const [k, txt] of items) dl.append(el("dt", null, k), el("dd", null, txt.replace("{schools}", Object.values(S.schools || {}).flat().join(", "))));
      g.appendChild(panel(title, dl));
    }
    v.appendChild(g);
  });
})();
