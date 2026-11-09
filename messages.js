// messages.js

const welcomeMessages = [
    `**🎯 ASSALAMU ALAIKUM <@{id}>! Welcome to the elite battleground of **Hypershot Arena**!  
📜 Before locking in your loadout, review the arena rules → <#{rules}> to ensure fair play and discipline.  
ℹ️ Curious about our community and tournament info? Check → <#{about}>.  
👑 Hypershot Arena is where true champions rise, sharpen their aim, and dominate the leaderboard.  
🔥 Lock and load, warrior — step into the arena and prove your worth!**`,

    `**👑 Welcome to the Arena <@{id}>! The **Hypershot Arena Family** is hyped to have you here!  
📜 Every sharp shooter honors our code of conduct → <#{rules}>. Respect and fair play define our lobby.  
ℹ️ Learn more about our ranks and legacy here → <#{about}>.  
⚔️ Queue together, fight together, clutch together.  
🔥 You're now part of an unstoppable gaming brotherhood. Aim high and conquer!**`,

    `**✨ Assalamu Alaikum <@{id}>! Welcome to the heart of competitive gaming — **Hypershot Arena**!  
📜 Rule #1: Discipline and respect in every match → <#{rules}>.  
ℹ️ Discover our events, tourneys, and scrims → <#{about}>.  
🚀 We are a community of passionate gamers, competitive beasts, and loyal teammates.  
🔥 Enjoy your stay, hit your headshots, and dominate the battlezone!**`,

    `**🔥 Welcome champion <@{id}>! The gates of **Hypershot Arena** are wide open for you.  
📜 Read our arena guidelines → <#{rules}> before stepping into the field.  
ℹ️ Catch up on our community story and updates → <#{about}>.  
👑 Here, skill meets teamwork, and every match creates a legend.  
🔥 Ready your crosshair — today begins your journey to the top!**`,

    `**💎 Welcome aboard <@{id}>! Your entry into the **Hypershot Arena Family** is celebrated with hype.  
📜 Start strong by reading the arena guidelines → <#{rules}>.  
ℹ️ Then explore who we are and what we stand for → <#{about}>.  
⚔️ We are an unbreakable squad — every member adds strength to our firepower.  
🔥 You're not just a guest; you are an official arena warrior now!**`,

    `**🚀 Yo <@{id}>! Welcome to **Hypershot Arena**, where every clutch shot counts!  
📜 Always respect the server regulations → <#{rules}>.  
ℹ️ Learn about our scrims, rankings, and events → <#{about}>.  
👑 This isn't just another server; it’s an arena built on mutual respect and pure competitive passion.  
🔥 Step onto the podium and show the server what you're made of!**`,

    `**❤️ Assalamu Alaikum <@{id}>! The **Hypershot Arena Community** welcomes you with open arms.  
📜 Every great tournament starts with respect for the rules → <#{rules}>.  
ℹ️ Want to know the vision behind Hypershot? Visit → <#{about}>.  
⚡ Precision, brotherhood, and relentless dedication — that's our core.  
🔥 Welcome home, player. Let's conquer the battlefields together!**`,

    `**⚡ Hey <@{id}>! Welcome to the official grounds of **Hypershot Arena**!  
📜 The rulebook is our sacred code → <#{rules}>.  
ℹ️ Curious about our events, staff, and lore? Check → <#{about}>.  
👑 We stand as a beacon of high-octane PvP action and top-tier community vibes.  
🔥 You belong here among the finest aimers and strategists. Let's dominate!**`,

    `**🎉 Salam <@{id}>! Welcome to the **Hypershot Arena**, where champions are forged in battle.  
📜 Discipline in the lobby begins with our rules → <#{rules}>.  
ℹ️ Gear up with server knowledge → <#{about}>.  
👑 Our community thrives on hype moments, fair play, and brotherhood.  
🔥 Grab your gear, call your teammates, and let the games begin!**`,

    `**🤩 Big Welcome <@{id}>! You’ve just joined the ranks of the **Hypershot Arena Family**!  
📜 Take a quick second to inspect → <#{rules}> to keep the gameplay clean and friendly.  
ℹ️ Discover our full backstory and roadmap → <#{about}>.  
⚔️ Hypershot Arena is built for the fierce, the dedicated, and the legendary.  
🔥 Buckle up — your ultimate PvP journey starts right now!**`,

    `**🌟 Assalamu Alaikum <@{id}>! A warm, royal welcome to **Hypershot Arena**.  
📜 Every true contender respects the server code → <#{rules}>.  
ℹ️ To explore our community culture and scrim updates, read → <#{about}>.  
👑 We don't just play games; we build an unstoppable legacy of champions.  
🔥 Ignite your fire and leave your mark on the leaderboard!**`,

    `**🔥 Welcome warrior <@{id}>! You have officially entered the **Hypershot Arena**.  
📜 Respect our ground rules → <#{rules}>. Discipline is the mark of a true pro.  
ℹ️ Read our story, connect with staff, and find teams at → <#{about}>.  
⚔️ We squad up, we coordinate, and we celebrate every clutch play together.  
🔥 Stand proud and let your skill speak for itself!**`,

    `**💎 Salaam <@{id}>! Your arrival makes the **Hypershot Arena Family** shine brighter.  
📜 Please take a moment to understand → <#{rules}>.  
ℹ️ Learn more about our competitive platform and community → <#{about}>.  
👑 From intense firefights to late-night squad banter, you're in the right place.  
🔥 Welcome to the squad — let's make history together!**`,

    `**🚀 Hey <@{id}>! Welcome aboard the **Hypershot Arena Battleground**!  
📜 Squad command: inspect the rules → <#{rules}> before deploying.  
ℹ️ Get the inside scoop on our community → <#{about}>.  
👑 You're now linked with fellow gamers who share your hunger for victory.  
🔥 Step in, communicate, and unleash your full potential!**`,

    `**❤️ Assalamu Alaikum <@{id}>!  
👑 You just joined the **Hypershot Arena Family**, where every player is treated like a brother.  
📜 Brotherhood starts with mutual respect → <#{rules}>.  
ℹ️ Check our background and community ethos → <#{about}>.  
🔥 Together we train, compete, and climb to the highest peaks of gaming.**`,

    `**⚡ Welcome <@{id}>! This is **Hypershot Arena** — sharper than lightning, warmer than home.  
📜 Every arena fighter honors → <#{rules}>.  
ℹ️ Discover all community info → <#{about}>.  
👑 Stand proud, because you are never running solo in our lobby.  
🔥 Welcome to the family, Hypershot warrior!**`,

    `**🎉 Greetings <@{id}>! A new contender has entered the **Hypershot Arena**!  
📜 Fair play and sportsmanship begin with → <#{rules}>.  
ℹ️ Get familiar with our server dynamics → <#{about}>.  
👑 Our strength lies not just in high kills, but in loyalty and teamwork.  
🔥 Wear the Hypershot tag with honor and give it your all!**`,

    `**✨ Welcome <@{id}> to the **Hypershot Arena Hub**!  
📜 Duty #1: Read and follow the guidelines → <#{rules}>.  
ℹ️ Duty #2: Check out who we are and what we do → <#{about}>.  
⚔️ Together we strategize, together we practice, and together we win.  
🔥 You are now part of our vibrant arena squad!**`,

    `**👑 Assalamu Alaikum <@{id}>! Welcome to the grand stage of **Hypershot Arena**.  
📜 The server rulebook is right here → <#{rules}>.  
ℹ️ Server lore, stats, and guides → <#{about}>.  
⚡ Champions never give up, never cheat, and always respect their rivals.  
🔥 With you in our squad, our arena is stronger than ever!**`,

    `**🤩 Salam <@{id}>! Welcome to the **Hypershot Arena Family**, where passion meets precision.  
📜 Check out our house rules → <#{rules}>.  
ℹ️ Dive into our community lore → <#{about}>.  
👑 Brotherhood, teamwork, and top-tier aim — that is the Hypershot way.  
🔥 Walk tall and aim sharp!**`,

    `**🔥 Yo <@{id}>! The **Hypershot Arena Community** welcomes you with massive hype!  
📜 First step: check out the server rules → <#{rules}>.  
ℹ️ Second step: explore everything about us → <#{about}>.  
⚔️ With every new player, our competitive circle grows stronger.  
🔥 Welcome to the arena — game on!**`,

    `**🌍 Welcome <@{id}> to **Hypershot Arena**, the ultimate hub for competitive gamers!  
📜 All contenders follow the code → <#{rules}>.  
ℹ️ All contenders know our mission → <#{about}>.  
👑 More than just a server, this is a home for gamers who strive for greatness.  
🔥 Let's write the next chapter of glorious victories together!**`,

    `**🎊 Big welcome <@{id}>! You’ve joined **Hypershot Arena**, the premier destination for high-skill action.  
📜 The rules → <#{rules}> are your crosshair guide.  
ℹ️ Our community overview → <#{about}> will get you fully oriented.  
⚡ Stronger together, faster together, and prouder together.  
🔥 Make yourself at home — you belong in this arena!**`,

    `**💫 Welcome <@{id}>! You are now locked into the **Hypershot Arena Universe**.  
📜 Keep the matches fair and clean → <#{rules}>.  
ℹ️ Discover our ongoing tournaments and community → <#{about}>.  
👑 Every player in this server is a star waiting for their clutch moment.  
🔥 Show us your best plays and light up the scoreboard!**`,

    `**🏆 Assalamu Alaikum <@{id}>! Having you in **Hypershot Arena** is an absolute pleasure.  
📜 The bedrock of our community is → <#{rules}>.  
ℹ️ Discover our mission and vision → <#{about}>.  
👑 You're not just a newcomer; you're a valuable member of our arena.  
🔥 Stand proud, aim true, and enjoy every moment at Hypershot Arena!**`
];

const leaveMessages = [
    `**😔 A bittersweet farewell… <@{id}> has left the **Hypershot Arena Family**.  
💔 You shared the battlegrounds with us, and your presence will be missed.  
🙏 We wish you pure success, peace, and victory in whatever game or path you take next.  
🔥 The arena gates are always open should you ever want to squad up again!**`,

    `**👋 Farewell <@{id}>!  
💎 Once an arena warrior, always remembered in our squad.  
⚡ Thank you for the memories, the matches, and the good times shared in Hypershot Arena.  
🙏 Take care out there, champion — you're always welcome to return.**`,

    `**💔 Goodbye <@{id}>.  
😢 Players may rotate out of the lobby, but the good memories never fade.  
🙏 Wishing you high ranks and great success in all your future endeavors.  
🔥 Hypershot Arena will always keep a spot in the squad open for you.**`,

    `**😥 <@{id}> has departed from **Hypershot Arena**.  
💔 Every teammate who leaves takes a piece of the squad with them.  
🙏 Best of luck with everything life throws your way.  
🔥 GG, warrior — hope to see you on the battlefield again someday!**`,

    `**🚪 <@{id}> left the arena today…  
😢 Gamer bonds don't vanish with a departure; they stay in the highlights.  
🙏 Stay sharp, stay positive, and keep leveling up.  
🔥 Safe travels, fellow shooter — respect always!**`,

    `**👑 Another champion steps away — <@{id}> has left Hypershot Arena.  
💔 Your voice in the chat and presence in the arena will be missed.  
🙏 May your future matches and life journeys be filled with victories.  
🔥 You will always be respected in the Hypershot community.**`,

    `**⚡ Farewell <@{id}>!  
😔 Squads may disperse, but mutual respect remains forever.  
🙏 Go out there and shine brightly wherever you play.  
🔥 Hypershot Arena salutes you for your time with us!**`,

    `**🎭 Goodbye <@{id}>.  
💔 A valued player logs off, but the legacy of your time here stays.  
🙏 Wishing you endless peace, happiness, and health.  
🔥 Hypershot Arena holds your name in high regard.**`,

    `**😔 <@{id}> is no longer in our arena lobby…  
💎 Thank you for being an awesome part of our gaming community.  
🙏 May destiny lead you to even greater heights.  
🔥 Our doors never close — feel free to drop back in anytime, warrior!**`,

    `**🕊️ Farewell <@{id}>.  
😢 It's always tough to see a valued squadmate depart.  
🙏 Wishing you smooth roads, good ping, and great triumphs ahead.  
🔥 Hypershot Arena bids you a respectful farewell!**`,

    `**😔 Farewell <@{id}>! Another warrior has stepped out of the **Hypershot Arena**…  
💔 Your clutch plays, laughter, and conversations will always be remembered.  
👑 Gamers may take different routes, but true respect never expires.  
🔥 Wherever your journey takes you, take care, pro!**`,

    `**👋 Goodbye <@{id}>! You may have left **Hypershot Arena**, but your contributions will not be forgotten.  
💎 You were an integral part of our community highlights.  
🙏 May great opportunities and triumphs follow you everywhere.  
🔥 Until our crosshairs meet again in another match — GG!**`,

    `**😢 Sad departure: <@{id}> has left the **Hypershot Arena** family.  
💔 Your presence created great moments in our server.  
👑 We never forget those who helped build the spirit of our arena.  
🔥 May your upcoming adventures bring you joy and endless success!**`,

    `**🌪️ The lobby feels quieter as <@{id}> steps away from **Hypershot Arena**.  
💔 Squad ties may pause, but the respect remains unbroken.  
👑 Every victory and match we experienced together remains in our history.  
🔥 Farewell, teammate — the doors of Hypershot are always unlocked for you.**`,

    `**⚡ Farewell <@{id}>! You might be off the roster, but you are not forgotten in **Hypershot Arena**.  
💎 True sportsmanship and camaraderie live on.  
👑 We honor the time you spent growing with us.  
🔥 May you find strength, triumph, and happiness in every game you play.**`,

    `**🌹 Goodbye <@{id}>!  
💔 **Hypershot Arena** loses a valuable member today.  
👑 Genuine friendship and respect transcend server boundaries.  
🔥 Thank you for being a part of our story. Keep your aim steady, warrior!**`,

    `**😞 Farewell friend <@{id}>! Stepping out of **Hypershot Arena** doesn’t erase the bond we forged.  
💎 You were a teammate, and you'll always have our respect.  
👑 May your road ahead be clear and full of wins.  
🔥 Until our paths cross again — farewell with honor!**`,

    `**💔 A heavy goodbye as <@{id}> logs off from the **Hypershot Arena Family**.  
⚔️ You fought beside us, laughed with us, and shared great moments.  
👑 Legends leave footprints wherever they go.  
🔥 Farewell, fighter — Hypershot Arena salutes you!**`,

    `**👋 Goodbye comrade <@{id}>!  
📜 Every tournament bracket has its final match, and today your chapter closes here.  
💎 Every ending marks the start of a fresh, exciting challenge.  
🔥 May your next adventure be thrilling and successful. GG and salute!**`,

    `**😔 Warm farewell to <@{id}>!  
👑 The **Hypershot Arena Community** bows with respect as you take your leave.  
💔 Distance may grow, but good memories always stay near.  
🔥 Stay true to your passion and keep hitting those goals!**`,

    `**🌌 Farewell <@{id}>! You added your own unique light to the **Hypershot Arena**.  
💎 Even though you are leaving, the good times we shared remain intact.  
👑 Our community will miss your presence and energy.  
🔥 Keep shining and winning, wherever you land!**`,

    `**👑 Goodbye <@{id}>! A loyal player parts ways with **Hypershot Arena** today.  
💔 An empty slot in the squad is always felt deeply.  
⚡ But true sportsmanship lives on past any server.  
🔥 Farewell, until we meet again in the battle arena!**`,

    `**💔 Farewell <@{id}>! Your journey in **Hypershot Arena** may conclude, but your impact remains.  
⚔️ You were more than just a gamer tag; you were part of the crew.  
👑 Take our positive vibes and best wishes with you.  
🔥 Keep conquering the leaderboards of life!**`,

    `**😢 Another squadmate says goodbye… <@{id}> has left the **Hypershot Arena**.  
💎 Your presence contributed to what makes our community special.  
👑 Once part of our lobby, your spot is always respected.  
🔥 We wish you health, happiness, and unforgettable clutch victories!**`,

    `**👋 Goodbye <@{id}>!  
💔 With heavy hearts, the **Hypershot Arena Family** watches you move forward.  
⚡ Distance cannot wipe away good matches and friendly conversations.  
🔥 Farewell, teammate — the Hypershot lobby is always ready to welcome you back!**`
];

module.exports = { welcomeMessages, leaveMessages };
