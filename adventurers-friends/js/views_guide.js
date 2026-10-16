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
      ["Titles", "A hero's class name is their title, from Warrior to Archmage. Evolved classes are earned by the skills a hero learns and the life they lead. Faction members also carry a rank (Squire, Knight, Paladin...), shown under their name."],
      ["Stress", "Builds up from danger and bad days. A night at the tavern or a quiet rest brings it down. Stressed heroes argue more."],
      ["Classes", "Everyone starts as a Warrior, Ranger or Mage. At level 9 a hero becomes the class their story points to: the skills they've learned count most, then what they do in fights, the work they take and what happens to them. At 18 they branch again, by who they've become since 9. The sign-up quiz shapes the first few skills and then fades. A class can be as popular as it likes; nobody is turned away. The first few heroes to reach level 21 become Legends; once those places are taken, the age has its Legends."],
      ["Mastery and hobbies", "A hero who already knows plenty sometimes spends a level getting better at a skill they use: it reads as honed, then mastered. Now and then they pick up a hobby instead, like cooking, card tricks or whittling. Hobbies are just for fun and never push them toward a class."],
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
      ["Skills", "Every level brings a skill. At first the sign-up answers steer it; soon what the hero already knows pulls toward its neighbours, and what they've been doing nudges it: patch up friends and healing comes; sneak about and shadow tricks follow. Some skills are for fights, some are always on, and some are for the road (trading, singing, cooking, tracking)."],
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
    ["Money", [
      ["Copper, silver and gold", "10 copper make a silver, and 10 silver make a gold piece. A hero's purse is counted in silver, with a few copper in the pocket for pies, baths and tips; shopkeepers always give exact change."],
      ["Gold pieces", "Big sums that change hands read in gold: a fat bounty, a dragon's hoard, a night's winnings or losses at the tables. \"12 gold pieces and 4 silver\" is 124 silver, and it goes straight into the purse as silver."],
      ["Earned, not won", "The fortune dream (2,000 silver earned) and purse goals count silver earned by work, loot and rewards. Table winnings don't count toward them, and table losses don't take anything off."],
    ]],
    ["The tables", [
      ["A game in every town", "Every town has its own game of chance and its own dealer, named in the town's Around town box. Heroes who like risk, or who carry a heavy purse, drift to the table in the afternoon or after supper. Heroes whose players said no to gambling never sit down."],
      ["The house", "Every game is played for real: the dice, pigs, shells, lots and candles decide each round, and some games pay more than even money. Over time the house always keeps a share of what's staked, from about 2 in every 100 on the toll bridge to about 20 in Ashfen. A sharp mind, a read on people or a gambler's knack narrows it, but never past even."],
      ["Stop-loss", "Heroes bring a bankroll, not the purse: the money for beds and food stays put, and careful heroes hold back what they're saving for a horse or a house. Reckless ones may chase a bad night once."],
      ["Cheats", "Rogues and the dishonest sometimes cheat. A cheat who gets away with it wins double; a caught one forfeits double, is banned from that table for a week or two, and now and then spends a night in the cells. Dealers remember, and nickname their regulars."],
      ["Watch", "Every sitting is kept as a replay for a fortnight. \"Lost 30 silver at Pig Racing ▸ watch\" in a hero's day opens it, with every round listed underneath."],
      ["Lady Luck's Ledger", "A weekly column on the Digest page about the town tables: the week's biggest win or loss, the longest run of losses at one table, any cheat caught (or an honest week), and a crew that sat down together. A sleepy week at the tables gets one line."],
      ["The fine dice", "Four fine dice sets (Gilt, Garnet, Ivory and Rime) are never sold. Each is won or given as a favour, once per league, during an hour at its own town's table; heroes who love dice are likelier to be the one."],
      ["Monsters who'd rather play", "Now and then a talking monster on the road offers a game instead of a fight, if the crew carries loot worth playing for. The crew's best player sits down: a loss hands over some of the carried loot (never silver, gear or sets), a win earns a curio the monster made."],
      ["Table keystones", "Poker Face, Gambler's Nerve, Read the Table and Gambit change how a hero plays at the tables (watched less and quicker to quit, never chasing, a touch sharper, a bold first bet), never the house's share. Each also does something in a fight."],
    ]],
    ["By the fire", [
      ["Game sets", "Cards, dice, checkers, chess and tarot decks are real kit: bought at markets (cheapest in the town that makes them), found in dungeons, won and lost. Sets wear out and lose pieces; a pebble stands in for the missing rook. A hero carries three at most."],
      ["Night games", "Cooking comes first at camp: on a night someone cooks, the crew eats and that's the evening. Otherwise, if anyone carries a set, about half the time it comes out, and the game is whatever most of the people present like playing. The rest of the nights go to songs, talk and stories."],
      ["Stakes", "Crewmates never play each other for silver. The loser takes first watch, cooks tomorrow, washes up or carries the pack, and once in a while a set or a keepsake changes hands."],
      ["Head to head", "Every pair keeps a running record for each game. Winning streaks earn camp nicknames, sore losers demand rematches, and a hot-tempered loser may flip the board. The record shows on each hero's page under At the fire."],
    ]],
    ["Food", [
      ["Parts", "Monsters drop parts for the pot: rat haunches, walking-caps, troll haunches, serpent fillets. A crew with someone who likes to cook keeps a few; everyone else sells them."],
      ["Who cooks", "The crew's best cook takes the fire: whoever has a cooking skill, or else whoever is sharpest and kindest with a pan. Plenty of heroes never cook at all, and that's fine."],
      ["Camp suppers", "About one camp night in four, when the crew carries parts, someone cooks a proper supper. It eases stress, heals a little and lifts the crew's mood, more so when it's a hero's favourite. About one in six goes wrong (rarer for a skilled cook), and everyone is a little unwell by morning."],
      ["Going hungry", "Heroes pack rations for the whole trip before they leave town, and top up at any market they pass with money in their purse. A hero who still runs out goes to bed hungry, and it costs stress and a little health. A crew carrying meat eats it before anyone goes hungry: a proper supper, or a haunch roasted on a stick."],
      ["Nights out", "Heroes grumble about the ground after a long stretch on the road. After about a week without a bed, a hero picks up a little stress, shown as \"too long away from a bed\". It's mild, and it clears the first night they sleep under a roof."],
      ["Legendary meals", "Every boss drops something special: Gruk's smoked ham, a kraken tentacle, a dragon's tail. Cooked, it makes a legendary meal, which never goes wrong and which the crew talks about for years."],
      ["Favourites", "Every hero has a favourite kind of food, from their quiz: what they order at the tavern, and who they are. It never changes. It shows on their page under At the table, with what they've eaten."],
      ["Eating out", "Every town has four dishes of its own, at the tavern, the bakery or the food stall, and the tavern's weekly special is cooked from whatever the nearest dungeons drop (it's on the Map). Crews in town sometimes feast together. Street food costs a few copper; a tavern dish or the special can run to a silver or more. Nobody eats into the money for their bed."],
      ["Watch", "Every meal is kept as a replay. \"▶ watch\" next to a meal in the Crier or a hero's day opens it."],
    ]],
    ["Music", [
      ["Music nights", "Some camp nights end in a song instead of a game, more often with a Bard or someone who really plays. One hero leads, and the rest sing, clap, bang a pot, play along or sing over the top. Some nights soar; some are a mess."],
      ["Singers and players", "A hero's music comes from their heart, their class and practice. Heroes who love music buy instruments at the markets and practise alone. The Music card on a hero's page shows how well they sing, what they play and the songs they know by heart."],
      ["Songs", "Every hero knows a handful of songs, old folk tunes and tavern favourites, and learns more by hearing them. After a big week, a hero may write a song of their own about it. Written songs are on the Songs page."],
      ["Anthems", "A song a crew keeps coming back to becomes its anthem. When it happens under the stars to a crew that's close right through, everyone at the fire joins in, and it makes the paper."],
      ["In town", "Taverns have a stage, and a hero may play a set for the room and whatever lands in the hat. Busking in the town hours pays much better for the league's best players."],
      ["Town music", "In a free hour a hero may sing with the town choir, take on the town's busker for the crowd's coppers, enter a tavern's song night for a small prize, or learn a song from a travelling minstrel for a copper in the hat. Sing one song in the street too often and the watch may ban it, which only makes the rooms ask for it more."],
      ["Listen", "Music nights are kept as replays, with the tune. \"♪ listen\" next to one in the Crier or a hero's day plays it."],
    ]],
    ["Chess and the Yeti Society", [
      ["Chess", "Chess nights are real games of chess, played move by move. A hero's strength comes from their mind and how much they've played, and a bad temper or a stressful week costs them. Strong players play sharp games; two bad players are a comedy."],
      ["How a game ends", "Mate, resignation or a draw (stalemate, the same position three times, fifty quiet moves, or too little left to mate with). A game still going at move eighty is called: a side a piece or more ahead is given it, otherwise it's a draw."],
      ["Legends", "Now and then a game follows, move for move, one of the old famous games, told here as a local legend. The real game is named in small print under the replay."],
      ["The Yeti Society", "In Frosthold the Yeti Society plays a game by post against an opponent nobody has ever seen: one move a day, the reply left overnight under a white footprint. A hero in town may offer to play the Society's side, and beating the footprint earns the Yeti badge. The board is on the Frosthold page, with a small copy in the corner of the Crier."],
      ["Watch", "Every chess game is kept as a replay: the key moments first, the full game a button away."],
    ]],
    ["The cards", [
      ["Readings", "Every town has a fortune-teller, named in its Around town box, who reads three cards for a small fee. Heroes who carry a tarot deck read for their crewmates at camp, or for themselves, and on the last night before a delve they may read one spread for the whole crew. A curious or worried hero, or one with a dungeon ahead, is likelier to sit down, and every hero is drawn to a reader's door early in their first season."],
      ["Seers on the road", "A travelling seer sets up in some town most weeks, with a deck of their own. Once a season a town holds an omen fair (two days of readings at half price), and a rival fortune-teller may pitch a tent across the square from the town's own reader to see who keeps the custom. Now and then a reading goes wrong: a gust, a cat, a candle. A card lands the other way up, the reader says it counts, and the fee comes back."],
      ["Omens", "Each card, upright or upside down, brings an omen for three to seven days: a steadier hand, luck at the tables, a good bargain, easy sleep, a few silver found, or (mostly from cards upside down) a bad feeling before a fight, restless nights, a lighter purse. They are small but real, and they show on a hero's page. A new reading replaces the last one's omens. A one-off omen (a find, a loss, sharp words) may simply never happen."],
      ["Did it come true?", "When an omen ends, the league checks what actually happened, and the paper only ever credits the omen with what the omen itself did. The best ones make the paper, and each town's reader earns a name: a true seer, or a fraud."],
      ["The decks", "The hedge-witch deck is the common one, in five restyled local editions (Bog-Warped from Ashfen, the Pressed-Leaf sun print from Hollowood, wood-burned in Veldrock, gilt and ink in Carrbridge, the Oilcloth Sea linocut from Saltmarrow). The Academy's stained-glass deck is rare. Several readers keep a second deck (the Good Dog fair deck, a goblin deck taken in trade, the Yeti Society's frost deck) and the travelling seers bring their own."],
      ["The Diviner", "A Bard or an Enchanter who keeps reading the cards may become a Diviner: rare (about one a league), never more than two at once. In a fight a Diviner turns one of the great cards every round, and its meaning helps the crew (or, upside down, not much)."],
      ["The Drowned Card", "Once a league, Old Salt's storm auction sells a seventy-ninth card that belongs to no deck. When it turns up in a reading, in any place and sometimes upside down, its omen is one of the sea's own, strong and kept secret until it ends."],
      ["Watch", "Every reading is kept as a replay for a fortnight, or for good when an omen comes true. \"Had the cards read ▸ watch\" in a hero's day opens it."],
    ]],
  ];
  // each town's game, from the league's own data: rules, dealer and the house's share
  function tableGames() {
    return Object.values(S.towns || {}).filter((t) => t.game && t.game.rules).map((t) => [`${t.game.name} (${t.name})`,
      `${t.game.rules} Dealt by ${t.game.dealer}.${t.game.edge ? ` The house keeps about ${Math.max(1, Math.round((2 * t.game.edge - 1) * 100))} in every 100 staked.` : ""}`]);
  }
  A.route(/^\/guide$/, (v) => {
    v.appendChild(el("h1", null, "The Guide"));
    v.appendChild(el("p", { class: "muted" }, "Everything you need to follow the league, in one page."));
    const g = el("div", { class: "grid2 even" });
    for (const [title, base] of GUIDE) {
      const dl = el("dl", { class: "kv guide" });
      const items = title === "The tables" ? base.slice(0, 2).concat(tableGames(), base.slice(2)) : base;
      for (const [k, txt] of items) dl.append(el("dt", null, k), el("dd", null, txt.replace("{schools}", Object.values(S.schools || {}).flat().join(", "))));
      g.appendChild(panel(title, dl));
    }
    v.appendChild(g);
  });
})();
