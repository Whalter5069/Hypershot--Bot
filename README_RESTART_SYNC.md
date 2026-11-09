# 🔄 Hypershot Arena Bot - Permanent Restart Schedule

## 🌟 Notun Feature: Permanent & Auto-Repeating Schedule
Aage restart time set korle sheti shudhu sei diner jonno chilo ebong restart shesh hole ba bot reboot hole abar **"nothing scheduled"** hoye jeto.

**Ekhon eta permanently save thakbe!** Apni ekbar schedule set kore dile:
- Protidin nirdishto shomoye countdown auto-repeat hobe (Day after day).
- Bot ba PC restart holeo schedule muche jabe na (`restart_schedule.json` e save thake).
- Jotodin na apni manually change korben ba `!setrestart clear` korben, totodin schedule active thakbe!

---

## 🛠️ Commands & Usage

### 1. Protidin Nirdishto Shomoye (Daily Fixed Time) - *Recommended*
Apni jodi chan protidin ekta fixed shomoye server restart hobe:
> **`!setrestart 18:00`** *(Protidin shondha 6:00 PM)*  
> **`!setrestart 06:00`** *(Protidin shokal 6:00 AM)*

*Eta protidin auto-repeat hobe! Ajker 18:00 par hoye gale auto kalker 18:00 er countdown shuru hoye jabe.*

### 2. Eker Odhik Shomoy (Multiple Daily Restarts)
Jodi server dine ekadhik bar restart hoy (jemon shokal 6:00 ebong shondha 6:00):
> **`!setrestart 06:00, 18:00`**  
> **`!setrestart 00:00, 06:00, 12:00, 18:00`**

### 3. Nirdishto Ghonta Por Por (Interval Schedule)
Jodi protte 6 ghonta ba 8 ghonta por por restart hoy:
> **`!setrestart every 6h`** *(Ba `!setrestart every 8 hours`)*

### 4. Custom Text (Fixed Text Display)
Jodi countdown chara fixed kono message ba schedule text embed e likhe rakhte chan:
> **`!setrestart text Daily at 06:00 AM & 06:00 PM`**

### 5. Instant Countdown (One-time)
Emergency ba temporary 15 minute-er restart schedule korte:
> **`!setrestart 15`** *(15 minute por restart)*

### 6. Clear (Nothing Scheduled)
Schedule shompurno muche feler jonno:
> **`!setrestart clear`**  
*(Eta korle embed e abar "nothing scheduled" show korbe)*

### 7. Info / Help
Current active schedule dekhar jonno:
> **`!setrestart help`** (ba shudhu **`!setrestart`**)

---

## 🔐 Permission
Ei command shudhu nicher user-ra use korte parben:
1. Bot Owner (`config.json` er `ownerId`).
2. Discord Server Administrator.
3. Staff role (`config.json` er `tickets.staffRoleId`).

