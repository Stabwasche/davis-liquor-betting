// Tezgahtar diyalogları. Her anahtar için birden fazla cümle var, rastgele biri seçilir.
// Yeni cümle eklemek için ilgili listeye bir satır eklemen yeterli.
// Değişkenler: {name} {horse} {n} {amount} {price} {owner} {secs} {race}
const CLERK = {
  greeting: [
    "Yeah, what's good? Window's open. Slide me your slip.",
    "Ayo, you in line or just lookin'? Gimme a code.",
    "Welcome to Davis Liquor. Beer's cold, odds ain't. What you got?",
    "Make it quick, my guy, I got a Bears game to catch. Code.",
    "Ope — another one. Alright, hand it over."
  ],
  askName: [
    "And who am I writin' this down for? Name.",
    "Name on the slip, chief. I ain't guessin'.",
    "Gotta log it. Who you supposed to be?"
  ],
  needName: [
    "Hold up. Ticket don't got no name on it. Tell me yours first.",
    "Name, bro. Can't run it blind."
  ],
  invalid: [
    "Nah, that code ain't in the system. Check it again, for real.",
    "Dat's a fake, bruh. Nothin' on my screen for that.",
    "You readin' it right? Cuz the computer ain't never heard of that.",
    "Code don't exist. Don't waste my time, I'm tryna eat.",
    "Yeah, no. That ain't one of mine."
  ],
  invalidAnnoyed: [
    "Come on now. Third time? You tweakin'. Read the slip.",
    "Man, I can do this all day. Can you? Get it right.",
    "Keep guessin' and I'm closin' the window, I swear on my mama."
  ],
  locked: [
    "That's it. Window's closed for {secs} seconds. Go cool off.",
    "Nah, you spammin'. Shutters down for {secs} seconds. Think about what you did."
  ],
  lockedStill: [
    "Window's shut. Come back in {secs} seconds.",
    "I said {secs} seconds. Don't tap on the glass."
  ],
  void: [
    "That ticket's been voided. Dead paper. Take it up with the boss.",
    "Management scratched that one off. It's trash now."
  ],
  ownerMismatch: [
    "Hold on — this ticket got {owner}'s name on it. You ain't {owner}. Who you tryna play?",
    "Nah nah nah. Slip says {owner}. You lookin' like somebody else. Denied.",
    "That's {owner}'s paper, not yours. Don't try me."
  ],
  scratchStart: [
    "Aight, scratch-off. Slid it on the desk. Use the penny, don't be usin' your nails.",
    "Scratch ticket, {price} a pop. Penny's on the counter. Do yo thing.",
    "Lucky number, huh? Rub it down, I ain't got all night."
  ],
  scratchResume: [
    "You already opened this one. It's still on the desk, finish it.",
    "Ope, you ain't scratched it yet? Go 'head."
  ],
  scratchWin: [
    "Ayo!! {amount}! Look at you! Boss'll cut you that cash.",
    "Damn, {amount}?! Alright alright, you eatin' tonight. Cash comin' up.",
    "Dat's {amount} on the board. First round on you, my guy."
  ],
  scratchBigWin: [
    "WHAT?! {amount}?! Hold on, lemme check the slip twice... yeah, it's real. Hot damn.",
    "Jackpot! {amount}! I ain't never seen that in all my years behind this glass!"
  ],
  scratchRefund: [
    "Amorti. You get your {amount} back. Not a win, not a loss. Chicago weather.",
    "Break even, bruh. {amount} back in your pocket. Could've been worse."
  ],
  scratchLose: [
    "Nothin'. Zip. Zero. That's the game, chief.",
    "Ahh, tough luck. Blank. Buy another one, house always got more.",
    "Dat's a loser. Sorry, not sorry. Next!",
    "Man, you scratched like your life depended on it and still nothin'. Brutal."
  ],
  pickHorse: [
    "Slip ain't got a horse on it. Pick one off the board — I ain't picking for you.",
    "Which pony you ridin' with? Tap one on the monitor, {price} on the line.",
    "Choose a horse. Don't pick Yellow Jack unless you hate money."
  ],
  horseRegistered: [
    "Alright, {n}. {horse}, {price} to win, pays {mult}x. You're on race #{race}. Watch the monitor.",
    "Locked in: {horse}. {price} down, race #{race}. Don't breathe on the screen.",
    "{horse}, huh? Bold. Race #{race}. Pull up a stool and pray."
  ],
  horseNextRace: [
    "Bets for this one are closed, so I put you down for race #{race}. Wait your turn.",
    "Gates already goin'. You're on race #{race}, chief. Be patient."
  ],
  horseResume: [
    "You already got {horse} in race #{race}. Sit tight and watch.",
    "I got you down on {horse}. Race #{race}. Quit askin'."
  ],
  raceCountdown: [
    "Next race in a minute, y'all. Last call for slips.",
    "Gates about to open. Get your bets in or get out."
  ],
  raceStart: [
    "And they're off! Come on, come on...",
    "Race is runnin'! Eyes on the screen!",
    "Here we go, here we go..."
  ],
  horseWin: [
    "BRUH! {horse} came through! {amount} for you! Don't spend it all at the same store.",
    "Ayyy! {horse} on top! {amount}, my guy. I'm lowkey proud.",
    "That's what I'm talkin' about! {amount}! Go see the boss for that cash."
  ],
  horseLose: [
    "{horse} choked. Damn shame. That's {price} to the house.",
    "Aww hell nah, {horse} was DRAGGIN'. Better luck next time, chief.",
    "Not your day. {price} gone. Run it back if you feelin' brave.",
    "Dat horse ran like it had a bad hamstring. Sorry, bro."
  ],
  alreadyPaid: [
    "You already collected on that one. Don't get greedy.",
    "Paid out already. Check your pockets, not my window."
  ],
  alreadyWon: [
    "That one hit already — {amount}. Boss has the cash, it's not paid yet. Be patient.",
    "Winner, winner. {amount}. Go see management before they forget about you."
  ],
  alreadyLost: [
    "That ticket's dead. It lost. Buy a new one.",
    "Already played this one, bro. Zero left on it."
  ],
  idle: [
    "...You gonna stand there or what?",
    "Meter's runnin', my guy. Code.",
    "Tick tock. The Cubs ain't gonna win by themselves.",
    "I got all night. Actually no I don't. Hurry up."
  ],
  menuOpen: [
    "Alright, window's open. What's your business?",
    "Step up. Beer, smokes, or a shot at gettin' rich?"
  ]
};

const lastPicked = {};
function say(key, vars = {}) {
  const pool = CLERK[key] || [''];
  let i;
  do { i = Math.floor(Math.random() * pool.length); } while (pool.length > 1 && i === lastPicked[key]);
  lastPicked[key] = i;
  return pool[i].replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? vars[k] : m));
}
