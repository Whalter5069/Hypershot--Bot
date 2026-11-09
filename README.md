# 🤖 Hypershot Arena Ticket & Utility Bot
**Version:** 2.0 | **Framework:** Discord.js v14

Eita hocche apnar server er main Discord Bot, jeta die apni **Server Status**, **Ticket System**, **Whitelist System**, **Announcements**, ar **Update Logs** shob manage korte parben!

---

## 📌 1. Server Status Commands
Bot automatically FiveM server theke data (Players, Uptime) niye ashe ar live update kore.

- **`!status`**
  - Ekta live embed toiri korbe jekhane Player count, Server IP, Uptime ar Next Restart time dekhabe. (Prottek 30 second e auto-update hoy).
  
- **`!setrestart <time/options>`** *(Only Staff/Admin)*
  - Server restart schedule permanent vabe set korar jonno (Bot reboot holeo delete hoy na, protidin auto-repeat hoy).
  - Usage: `!setrestart 18:00` (Protidin 18:00 e), `!setrestart 06:00, 18:00` (Dine 2 bar), `!setrestart every 6h` (Proti 6 ghontay), `!setrestart text <text>` (Custom text), `!setrestart clear` (Schedule muche fela).

---

## 🛡️ 2. Whitelist System
Ekti auto/manual whitelist system jekhane ekbar ekta Steam profile use korle keu 2nd bar use korte parbe na.

- **`!whitelist`**
  - Ekta embed pathabe jekhane `Verify` button thakbe. Player-ra button click kore tader Name, Gang, Steam link diye apply korbe.
  - Application staff channel e jabe jekhane apni `Approve` ba `Reject` korte parben. Approve korle auto role peye jabe ar log e save hobe.
  
- **`!resetstrem`** *(Only Staff/Admin)*
  - Ekta button panel dibe. Button e click kore player er Discord ID dile tar saved Steam link database theke remove hoye jabe. (Jodi keu vul steam link dey, tader reset korar jonno).

---

## 📩 3. Ticket System
Advance ticket system dropdown menu shoho.

- **`!setup-ticket`**
  - Ticket toiri korar dropdown panel dibe. 
  - Player-ra **Support**, **Whitelist**, ba **Ask for POV** select korte parbe.
  - Select korar por form (Modal) ashbe, jeta puron korle ekta private ticket channel khulbe.
  
- **Ticket Management (Inside Ticket):**
  - **🔒 Close:** Ticket close kore player theke hide kore dibe.
  - **📄 Transcript:** Pura kothabarta ekta HTML file e save kore log channel e pathiye dibe.
  - **⛔ Delete:** Ticket channel ta permanently delete kore dibe.

---

## 📢 4. Announcements & Updates
Beautiful embed ba normal text e announcement korar system.

- **`!announce`**
  - Apnake channel select korte bolbe. Tarpor jiggesh korbe apni Embed naki Normal text e dite chan.
  - Embed e dile auto `@everyone` mention hobe. Apni Title, Description ar Image URL diye sundor post korte parben.
  
- **`!updatelog`**
  - Same as announce, but eta Update Log hishebe green text (`diff`) format e asbe.

---

## 🚀 5. Teleport System (`/tp` & `!tp`)
Staff/Admin-ra je kono online player-ke direct Discord theke Arena spawn location e teleport korte parbe!

- **`/tp <id>`** (Discord Slash Command)
  - Player er in-game Server ID (e.g. `1`, `2`, `5`) dile she jekhanei thakuk na keno take shathe shathe `vec4(4396.77, 2784.68, 551.38, 288.17)` e teleport kore dibe!
  - Ped/Vehicle smooth collision loading & in-game notification shoho transfer hobe.
- **`!tp <id>`** (Staff Channel Prefix Command)
  - Same teleportation feature via text channel command.

---

## 👑 6. Owner Commands
Ei command gulo shudhu bot er malik (jar ID config.json e `ownerId` te ache) use korte parbe.

- **`!serverlist`**
  - Bot koto gulo server e add ache tar list dekhabe.
- **`!leaveserver <ServerID>`**
  - Bot ke kono server theke force remove korar jonno.

---

## ⚙️ Configuration (`config.json`)
Shob setting `config.json` e kora ache:
- `ownerId`: Apnar nijer Discord ID.
- `serverStatus.serverIP` & `serverPort`: FiveM server er IP.
- `tickets.staffRoleId`: Jader ei role gulo thakbe tara ticket manage korte parbe, restart set korte parbe, ar transcript nite parbe.
- `tickets.logChannelId`, `userResultChannelId`, etc: Bibhinno log kothay jabe tar channel ID.

*(Ei file ta apnar `d:\BOT\my-ticket-bot\README.md` hishebe save kora hoyeche)*
