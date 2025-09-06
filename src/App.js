import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";


const MEMORY_SYMBOLS = [
  "🍎","🍌","🍒","🍇","🍉","🍓","🥝","🍍",
  "🥑","🍆","🥕","🌽","🥔","🥦","🍅","🫑",
  "🍋","🍊","🍐","🥭","🍈","🍑","🥥","🥬",
  "🥜","🌰","🍠","🧄","🧅","🍄","🥒","🥯"
];

const SUITS = ["♠","♥","♦","♣"];
const RANKS = ["2","3","4","5","6","7","8","9","10","J","Q","K","A"];
const RANK_TO_VALUE = Object.fromEntries(RANKS.map((r,i)=>[r,i]));

/* Deck utils */
function buildDeck() {
  const d = [];
  for (const s of SUITS) for (const r of RANKS) d.push({rank:r, suit:s, code: r + s});
  return d;
}
function shuffleDeck(deck) {
  const arr = deck.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

//framer
const cardFlipVariants = {
  front: { rotateY: 180, transition: { duration: 0.45 } },
  back: { rotateY: 0, transition: { duration: 0.45 } }
};
const dealVariant = {
  hidden: { y: -40, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { type: "spring", stiffness: 300, damping: 20 } }
};

//check hand 
function evaluate7(cards) {
  const counts = {};
  const suitMap = {};
  for (const c of cards) {
    counts[c.rank] = (counts[c.rank] || 0) + 1;
    suitMap[c.suit] = suitMap[c.suit] || [];
    suitMap[c.suit].push(c);
  }
  const uniqueRanksDesc = [...new Set(cards.map(c => RANK_TO_VALUE[c.rank]))].sort((a,b)=>b-a);
  function findStraight(valuesDesc) {
    const set = new Set(valuesDesc);
    const vals = [...set].sort((a,b)=>b-a);
    if (set.has(RANK_TO_VALUE["A"])) vals.push(-1);
    for (let i=0;i<vals.length;i++) {
      const top = vals[i];
      let ok = true;
      const seq = [top];
      for (let k=1;k<5;k++){
        const need = top - k;
        if (!set.has(need) && !(need === -1 && set.has(RANK_TO_VALUE["A"]))) { ok = false; break; }
        seq.push(need === -1 ? RANK_TO_VALUE["A"] : need);
      }
      if (ok) return seq.map(v => (v===-1?RANK_TO_VALUE["A"]:v));
    }
    return null;
  }
  let flushSuit = null;
  for (const s of Object.keys(suitMap)) if (suitMap[s].length >= 5) { flushSuit = s; break; }
  if (flushSuit) {
    const flushValues = suitMap[flushSuit].map(c => RANK_TO_VALUE[c.rank]).sort((a,b)=>b-a);
    const sf = findStraight(flushValues);
    if (sf) return { category: 8, ranks: sf.slice(0,5) };
  }
  const rankEntries = Object.keys(counts).map(r=>({rank:r,cnt:counts[r],val:RANK_TO_VALUE[r]}));
  rankEntries.sort((a,b)=> b.cnt === a.cnt ? b.val - a.val : b.cnt - a.cnt);
  if (rankEntries[0] && rankEntries[0].cnt === 4) {
    const fourVal = rankEntries[0].val;
    const kicker = uniqueRanksDesc.find(v => v !== fourVal);
    return { category:7, ranks:[fourVal, kicker] };
  }
  if (rankEntries[0] && rankEntries[0].cnt === 3) {
    const threeVal = rankEntries[0].val;
    const pairEntry = rankEntries.slice(1).find(e=>e.cnt>=2);
    if (pairEntry) return { category:6, ranks:[threeVal, pairEntry.val] };
  }
  if (flushSuit) {
    const flushVals = suitMap[flushSuit].map(c => RANK_TO_VALUE[c.rank]).sort((a,b)=>b-a).slice(0,5);
    return { category:5, ranks:flushVals };
  }
  const straightVals = findStraight(uniqueRanksDesc);
  if (straightVals) return { category:4, ranks: straightVals.slice(0,5) };
  if (rankEntries[0] && rankEntries[0].cnt === 3) {
    const tripVal = rankEntries[0].val;
    const kickers = uniqueRanksDesc.filter(v=>v!==tripVal).slice(0,2);
    return { category:3, ranks:[tripVal, ...kickers] };
  }
  if (rankEntries[0] && rankEntries[0].cnt === 2 && rankEntries[1] && rankEntries[1].cnt === 2) {
    const highPair = rankEntries[0].val, lowPair = rankEntries[1].val;
    const kicker = uniqueRanksDesc.find(v=>v!==highPair && v!==lowPair);
    return { category:2, ranks:[highPair, lowPair, kicker] };
  }
  if (rankEntries[0] && rankEntries[0].cnt === 2) {
    const pairVal = rankEntries[0].val;
    const kickers = uniqueRanksDesc.filter(v=>v!==pairVal).slice(0,3);
    return { category:1, ranks:[pairVal, ...kickers] };
  }
  return { category:0, ranks: uniqueRanksDesc.slice(0,5) };
}
function compareEval(a,b) {
  if (a.category !== b.category) return b.category - a.category;
  for (let i=0;i<Math.max(a.ranks.length,b.ranks.length);i++){
    const av = a.ranks[i] ?? -1, bv = b.ranks[i] ?? -1;
    if (av !== bv) return bv - av;
  }
  return 0;
}
function estimateHandStrength(hole, community) {
  const evalRes = evaluate7([...hole, ...community]);
  const catWeights = [0.05,0.15,0.3,0.45,0.6,0.75,0.85,0.95,0.99];
  const base = catWeights[evalRes.category] ?? 0.1;
  const kickerFactor = (evalRes.ranks[0] ?? 0) / (RANKS.length - 1);
  return Math.min(0.999, base + kickerFactor * 0.1);
}

function PokerCard({ card, hidden=false, animateFlip=false }) {
  return (
    <motion.div
      className="w-16 h-22 perspective"
      initial="back"
      animate={animateFlip ? (hidden ? "back" : "front") : (hidden ? "back" : "front")}
      variants={cardFlipVariants}
      style={{ transformStyle: "preserve-3d" }}
    >
      <div className="absolute inset-0 backface-hidden rounded-lg overflow-hidden">
        <img src="/card-back.jpg" alt="back" className="w-full h-full object-cover rounded-lg shadow-inner"/>
      </div>
      <div className="absolute inset-0 backface-hidden rounded-lg overflow-hidden" style={{ transform: "rotateY(180deg)" }}>
        <div className="w-full h-full flex items-center justify-center bg-white text-black rounded-lg text-lg font-bold">{card ? `${card.rank}${card.suit}` : ""}</div>
      </div>
    </motion.div>
  );
}


export default function App() {
  const [mode, setMode] = useState("menu"); // menu, memory, poker
  const [bankroll, setBankroll] = useState(500);

  
  const [memDeck, setMemDeck] = useState([]);
  const [memFlipped, setMemFlipped] = useState([]);
  const [memMatched, setMemMatched] = useState([]);
  const [memBet, setMemBet] = useState(10);
  const [memAttempts, setMemAttempts] = useState(3);
  const [memGameOver, setMemGameOver] = useState(false);
  const [memWin, setMemWin] = useState(false);
  const [memStreak, setMemStreak] = useState(0);
  const [memNearMiss, setMemNearMiss] = useState(null);

  
  const [music] = useState(typeof Audio !== "undefined" ? new Audio("/casino-music.mp3") : null);
  const [coinSound] = useState(typeof Audio !== "undefined" ? new Audio("/coin.mp3") : null);
  const [jackpotSound] = useState(typeof Audio !== "undefined" ? new Audio("/jackpot.mp3") : null);
  const [shuffleSound] = useState(typeof Audio !== "undefined" ? new Audio("/shuffle.mp3") : null);
  const [dealSound] = useState(typeof Audio !== "undefined" ? new Audio("/deal.mp3") : null);

  useEffect(() => {
    if (mode === "memory") {
      initMemory();
      if (music) { music.loop = true; music.volume = 0.25; music.play().catch(()=>{}); }
    } else {
      if (music) { music.pause(); try{music.currentTime=0}catch{} }
    }
    
  }, [mode]);

  function initMemory() {
    const deck = [...MEMORY_SYMBOLS, ...MEMORY_SYMBOLS].slice(0, 64) // up to 64
      .sort(()=> Math.random() - 0.5)
      .map((v,i)=>({id:i, value:v, bonus: Math.random() < 0.08}));
    setMemDeck(deck);
    setMemFlipped([]);
    setMemMatched([]);
    setMemBet(10);
    setMemAttempts(3);
    setMemGameOver(false);
    setMemWin(false);
    setMemStreak(0);
    setMemNearMiss(null);
  }

  function onMemCardClick(card) {
    if (memGameOver || memWin) return;
    if (memFlipped.some(c=>c.id===card.id) || memMatched.some(c=>c.id===card.id)) return;
    if (memFlipped.length < 2) setMemFlipped(prev => [...prev, card]);
  }

  useEffect(() => {
    if (memFlipped.length !== 2) return;
    const [a,b] = memFlipped;
    if (a.value === b.value) {
      let multiplier = 1 + memStreak * 0.5;
      if (a.bonus || b.bonus) multiplier *= 2;
      if (memStreak >= 5) multiplier *= 1.5;
      const reward = Math.round(memBet * multiplier);
      setBankroll(prev => prev + reward);
      if (reward >= memBet * 4) { if (jackpotSound) try{ jackpotSound.play().catch(()=>{}) }catch{} }
      else { if (coinSound) try{ coinSound.play().catch(()=>{}) }catch{} }
      setMemMatched(prev => [...prev, a, b]);
      setMemStreak(s=>s+1);
      setMemFlipped([]);
      setMemNearMiss(null);
    } else {
      setBankroll(prev => Math.max(0, prev - memBet));
      setMemAttempts(prev => {
        const na = prev - 1;
        if (na <= 0) setMemGameOver(true);
        return na;
      });
      setMemStreak(0);
      const unmatchedBonus = memDeck.find(c => c.bonus && !memMatched.includes(c));
      setMemNearMiss(unmatchedBonus);
      setTimeout(()=> setMemFlipped([]), 900);
    }
   // eslint-disable-next-line
  }, [memFlipped]);

  useEffect(()=> {
    if (memMatched.length > 0 && memMatched.length === memDeck.length && memDeck.length>0) setMemWin(true);
  }, [memMatched]);


  const [pCount, setPCount] = useState(4); 
  const [pPlayers, setPPlayers] = useState([]); 
  const [pDeck, setPDeck] = useState([]);
  const [pCommunity, setPCommunity] = useState([]);
  const [pStage, setPStage] = useState("waiting"); 
  const [pPot, setPPot] = useState(0);
  const [pCurrentIndex, setPCurrentIndex] = useState(0);
  const [pCurrentBet, setPCurrentBet] = useState(0);
  const [pRoundActive, setPRoundActive] = useState(false);
  const [pWinner, setPWinner] = useState(null);
  const [pDealerIndex, setPDealerIndex] = useState(0);
  const [pSmallBlind, setPSmallBlind] = useState(10);
  const [pBigBlind, setPBigBlind] = useState(20);
  const [pMinRaise, setPMinRaise] = useState(20);
  const [isDealing, setIsDealing] = useState(false);

  function initPokerRound() {
    if (shuffleSound) try{ shuffleSound.play().catch(()=>{}) }catch{}
    const deck = shuffleDeck(buildDeck());
    const players = [];
    const total = pCount;
    for (let i=0;i<total;i++){
      const name = i===0 ? "You" : `Bot ${i}`;
      const hand = [deck.pop(), deck.pop()];
      const bank = i===0 ? bankroll : 200;
      players.push({ id:i, name, hand, bankroll: bank, betThisRound: 0, folded:false, active:true });
    }
    const sbIndex = (pDealerIndex + 1) % total;
    const bbIndex = (pDealerIndex + 2) % total;
    players[sbIndex].bankroll = Math.max(0, players[sbIndex].bankroll - pSmallBlind);
    players[sbIndex].betThisRound = (players[sbIndex].betThisRound || 0) + pSmallBlind;
    players[bbIndex].bankroll = Math.max(0, players[bbIndex].bankroll - pBigBlind);
    players[bbIndex].betThisRound = (players[bbIndex].betThisRound || 0) + pBigBlind;
    const initialBet = pBigBlind;
    setPPlayers(players);
    setPDeck(deck);
    setPCommunity([]);
    setPStage("preflop");
    setPPot(pSmallBlind + pBigBlind);
    setPCurrentBet(initialBet);
    setPCurrentIndex((bbIndex + 1) % total); // first to act after big blind
    setPRoundActive(true);
    setPWinner(null);
    setIsDealing(true);
    setTimeout(()=>setIsDealing(false), 600);
  }

  function advanceStage() {
    if (pStage === "preflop") {
      const deck = pDeck.slice();
      const flop = [deck.pop(), deck.pop(), deck.pop()];
      setPDeck(deck);
      setPCommunity(flop);
      setPPlayers(ps => ps.map(p=>({...p, betThisRound:0})));
      setPCurrentBet(0);
      setPCurrentIndex((pDealerIndex + 1) % psLength());
      setPRoundActive(true);
      setPStage("flop");
      if (dealSound) try{ dealSound.play().catch(()=>{}) }catch{}
    } else if (pStage === "flop") {
      const deck = pDeck.slice();
      const turn = deck.pop();
      setPDeck(deck);
      setPCommunity(prev=>[...prev, turn]);
      setPPlayers(ps => ps.map(p=>({...p, betThisRound:0})));
      setPCurrentBet(0);
      setPCurrentIndex((pDealerIndex + 1) % psLength());
      setPStage("turn");
      setPRoundActive(true);
      if (dealSound) try{ dealSound.play().catch(()=>{}) }catch{}
    } else if (pStage === "turn") {
      const deck = pDeck.slice();
      const river = deck.pop();
      setPDeck(deck);
      setPCommunity(prev=>[...prev, river]);
      setPPlayers(ps => ps.map(p=>({...p, betThisRound:0})));
      setPCurrentBet(0);
      setPCurrentIndex((pDealerIndex + 1) % psLength());
      setPStage("river");
      setPRoundActive(true);
      if (dealSound) try{ dealSound.play().catch(()=>{}) }catch{}
    } else if (pStage === "river") {
      setPPlayers(ps => ps.map(p=>({...p, betThisRound:0})));
      setPCurrentBet(0);
      setPCurrentIndex((pDealerIndex + 1) % psLength());
      setPStage("showdown");
      setPRoundActive(false);
      doShowdown();
    }
  }

  function psLength(){ return pPlayers.length || 0; }

  useEffect(() => {
    if (!pRoundActive) return;
    const activePlayers = pPlayers.filter(p=>!p.folded && p.active);
    if (activePlayers.length <= 1) {
      setPRoundActive(false);
      setPStage("showdown");
      doShowdown();
      return;
    }
    let idx = pCurrentIndex;
    let tries = 0;
    while (tries < psLength() && (pPlayers[idx]?.folded || !pPlayers[idx]?.active)) {
      idx = (idx + 1) % psLength();
      tries++;
    }
    setPCurrentIndex(idx);
    const player = pPlayers[idx];
    if (!player) return;
    if (player.id === 0) {
      return;
    } else {
      setTimeout(()=> botAct(idx), 400 + Math.random()*400);
    }
  }, [pRoundActive, pPlayers, pCurrentIndex]);

  function botAct(index) {
    const players = pPlayers.slice();
    const bot = players[index];
    if (!bot || bot.folded || !bot.active) {
      setPCurrentIndex((index + 1) % psLength());
      return;
    }
    const strength = estimateHandStrength(bot.hand, pCommunity);
    const toCall = pCurrentBet - (bot.betThisRound || 0);
    const callProb = Math.min(0.9, 0.2 + strength * 0.6);
    const raiseProb = Math.min(0.45, 0.05 + strength * 0.4);
    const foldProb = Math.max(0.02, 0.3 - strength * 0.25);
    let action = "call";
    if (toCall <= 0) {
      if (Math.random() < raiseProb) action = "raise";
      else action = "check";
    } else {
      const r = Math.random();
      if (r < foldProb) action = "fold";
      else if (r < foldProb + callProb) action = "call";
      else action = "raise";
    }
    if (action === "fold") {
      players[index] = {...bot, folded: true};
    } else if (action === "check") {
      // nothing
    } else if (action === "call") {
      const need = Math.min(toCall, bot.bankroll);
      players[index] = {...bot, bankroll: bot.bankroll - need, betThisRound: (bot.betThisRound || 0) + need};
      setPPot(prev=>prev + need);
    } else if (action === "raise") {
      const raiseAmt = Math.max(pMinRaise, Math.round(pCurrentBet * 0.5));
      const total = (pCurrentBet - (bot.betThisRound || 0)) + raiseAmt;
      const put = Math.min(total, bot.bankroll);
      players[index] = {...bot, bankroll: bot.bankroll - put, betThisRound: (bot.betThisRound || 0) + put};
      const newBet = Math.max(pCurrentBet, (bot.betThisRound || 0) + raiseAmt);
      setPCurrentBet(newBet);
      setPPot(prev=>prev + put);
    }
    setPPlayers(players);
    setPCurrentIndex((index + 1) % psLength());
  }

  function humanFold() {
    setPPlayers(ps => {
      const c = ps.slice();
      c[0] = {...c[0], folded:true};
      return c;
    });
    setPCurrentIndex((pCurrentIndex + 1) % psLength());
  }
  function humanCall() {
    setPPlayers(ps => {
      const c = ps.slice();
      const pl = c[0];
      const need = Math.min(pCurrentBet - (pl.betThisRound || 0), pl.bankroll);
      c[0] = {...pl, bankroll: pl.bankroll - need, betThisRound: (pl.betThisRound || 0) + need};
      setPPot(prev => prev + need);
      return c;
    });
    setPCurrentIndex((pCurrentIndex + 1) % psLength());
  }
  function humanCheck() {
    setPCurrentIndex((pCurrentIndex + 1) % psLength());
  }
  function humanRaise(amount) {
    if (amount <= 0) return;
    setPPlayers(ps => {
      const c = ps.slice();
      const pl = c[0];
      const toCall = pCurrentBet - (pl.betThisRound || 0);
      const total = toCall + amount;
      const put = Math.min(total, pl.bankroll);
      c[0] = {...pl, bankroll: pl.bankroll - put, betThisRound: (pl.betThisRound || 0) + put};
      setPPot(prev=>prev + put);
      return c;
    });
    setPCurrentBet(prev => Math.max(prev, (pPlayers[0]?.betThisRound || 0) + amount));
    setPCurrentIndex((pCurrentIndex + 1) % psLength());
  }

  function doShowdown() {
    const contenders = pPlayers.filter(p => !p.folded);
    if (contenders.length === 0) { setPWinner(null); return; }
    const scored = contenders.map(p => ({...p, eval: evaluate7([...p.hand, ...pCommunity])}));
    scored.sort((a,b)=> compareEval(a.eval, b.eval));
    const winp = scored[0];
    setPWinner(winp);
    if (winp.id === 0) {
      setBankroll(prev => prev + pPot);
    } else {
      setPPlayers(ps => ps.map(pl => pl.id === winp.id ? {...pl, bankroll: pl.bankroll + pPot} : pl));
    }
    setPPot(0);
  }

  function displayCard(c) { return c ? `${c.rank}${c.suit}` : ""; }

  function startPoker() {
    setPDealerIndex(prev => (prev + 1) % pCount);
    initPokerRound();
  }

  function initPokerRound() {
    initDealerRound(pDealerIndex);
  }

  function initDealerRound(dealerIdx) {
    if (shuffleSound) try{ shuffleSound.play().catch(()=>{}) }catch{}
    const deck = shuffleDeck(buildDeck());
    const players = [];
    for (let i=0;i<pCount;i++){
      const name = i===0 ? "You" : `Bot ${i}`;
      const hand = [deck.pop(), deck.pop()];
      const bank = i===0 ? bankroll : 200;
      players.push({ id:i, name, hand, bankroll: bank, betThisRound:0, folded:false, active:true });
    }
    const sbIndex = (dealerIdx + 1) % pCount;
    const bbIndex = (dealerIdx + 2) % pCount;
    players[sbIndex].bankroll = Math.max(0, players[sbIndex].bankroll - pSmallBlind);
    players[sbIndex].betThisRound = pSmallBlind;
    players[bbIndex].bankroll = Math.max(0, players[bbIndex].bankroll - pBigBlind);
    players[bbIndex].betThisRound = pBigBlind;
    setPPlayers(players);
    setPDeck(deck);
    setPCommunity([]);
    setPStage("preflop");
    setPPot(pSmallBlind + pBigBlind);
    setPCurrentBet(pBigBlind);
    setPCurrentIndex((bbIndex + 1) % pCount);
    setPRoundActive(true);
    setPWinner(null);
    setIsDealing(true);
    setTimeout(()=> setIsDealing(false), 600);
  }

  useEffect(()=> {
  }, [pStage]);

  return (
    <div className="min-h-screen p-6 bg-gradient-to-br from-[#082A0F] via-[#0B2E1A] to-[#06301A] text-white">
      <div className="max-w-6xl mx-auto">
        <header className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-extrabold">Casino Royale</h1>
            <div className="text-sm opacity-80">Shared Bankroll: <span className="font-bold">${Math.round(bankroll)}</span></div>
          </div>
          <div className="flex gap-3">
            <button className="px-3 py-2 bg-gray-700 rounded" onClick={()=>setMode("menu")}>Menu</button>
            <button className="px-3 py-2 bg-yellow-400 text-black rounded" onClick={()=>{ setMode("memory"); initMemory(); }}>Memory Royale</button>
            <button className="px-3 py-2 bg-yellow-400 text-black rounded" onClick={()=>{ setMode("poker"); initDealerRound(pDealerIndex); }}>Poker Royale</button>
          </div>
        </header>

        {mode === "menu" && (
          <div className="h-[60vh] flex flex-col items-center justify-center gap-4">
            <h2 className="text-2xl">Choose your game</h2>
            <div className="flex gap-4">
              <button className="px-6 py-3 bg-yellow-400 text-black rounded" onClick={()=>{ setMode("memory"); initMemory(); }}>Play Memory Royale</button>
              <button className="px-6 py-3 bg-yellow-400 text-black rounded" onClick={()=>{ setMode("poker"); initDealerRound(pDealerIndex); }}>Play Poker Royale</button>
            </div>
          </div>
        )}

        {mode === "memory" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="bg-black/40 p-3 rounded flex items-center gap-4">
                <div>Bankroll: <strong>${Math.round(bankroll)}</strong></div>
                <div>Streak: <strong>{memStreak}x</strong></div>
                <div>Attempts: <strong>{memAttempts}</strong></div>
              </div>
              <div className="flex gap-2">
                <button className="px-3 py-2 bg-blue-600 rounded" onClick={()=>setMode("menu")}>Back</button>
                <button className="px-3 py-2 bg-green-600 rounded" onClick={initMemory}>Restart</button>
              </div>
            </div>

            <div className="grid grid-cols-8 gap-3">
              {memDeck.map(card => (
                <motion.div key={card.id} variants={dealVariant} initial="hidden" animate="visible" className="w-20 h-28">
                  <div onClick={()=>onMemCardClick(card)}>
                    <motion.div className="relative w-full h-full rounded-lg shadow-lg [transform-style:preserve-3d]" animate={memFlipped.some(c=>c.id===card.id) || memMatched.some(c=>c.id===card.id) ? "front" : "back"} variants={cardFlipVariants} style={{ transformStyle: "preserve-3d" }}>
                      <div className="absolute inset-0 backface-hidden rounded-lg overflow-hidden">
                        <img src="/card-back.jpg" alt="back" className="w-full h-full object-cover rounded-lg"/>
                      </div>
                      <div className="absolute inset-0 backface-hidden rounded-lg overflow-hidden" style={{ transform: "rotateY(180deg)" }}>
                        <div className={`w-full h-full flex items-center justify-center text-2xl ${card.bonus ? "bg-yellow-300 text-black animate-pulse":"bg-white text-black"} rounded-lg`}>{card.value}</div>
                      </div>
                    </motion.div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {mode === "poker" && (
          <div className="mt-4">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-2xl">Poker Royale — Texas Hold'em</h2>
                <div className="text-sm opacity-80">Dealer: Bot {pDealerIndex}</div>
              </div>
              <div className="flex gap-2">
                <div className="bg-black/40 p-3 rounded">Pot: <strong>${pPot}</strong></div>
                <div className="bg-black/40 p-3 rounded">Stage: <strong>{pStage}</strong></div>
                <button className="px-3 py-2 bg-blue-600 rounded" onClick={()=>{ setMode("menu"); }}>Menu</button>
                <button className="px-3 py-2 bg-yellow-400 rounded text-black" onClick={()=>initDealerRound(pDealerIndex)}>New Round</button>
              </div>
            </div>

            <div className="relative flex items-center justify-center">
              <div className="w-[760px] h-[380px] rounded-full bg-[radial-gradient(circle_at_center,_#0a3d1f,_#043017)] shadow-2xl flex flex-col items-center justify-center">
                <div className="mb-6">
                  <div className="flex gap-3 justify-center">
                    <AnimatePresence>
                      {pCommunity.map((c,i)=>(
                        <motion.div key={i} initial={{ y:-20, opacity:0 }} animate={{ y:0, opacity:1 }} exit={{ opacity:0 }} className="w-20 h-28 bg-white text-black rounded flex items-center justify-center text-lg font-bold">
                          {displayCard(c)}
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                </div>
                <div className="text-center mb-4">
                  <div className="inline-block bg-black/50 px-4 py-2 rounded">Pot <strong>${pPot}</strong></div>
                </div>
                <div className="absolute bottom-6 left-6 w-48">
                </div>
                <div className="absolute top-6 left-6 space-y-3">
                  {pPlayers.slice(1,3).map((pl, idx)=>(
                    <div key={idx} className="p-2 bg-green-800 rounded w-40">
                      <div className="flex justify-between"><strong>{pl.name}</strong><span>${Math.round(pl.bankroll)}</span></div>
                      <div className="mt-2 flex gap-2">
                        {pStage === "showdown" || pl.id === 0 ? pl.hand.map((c,i)=>(<div key={i} className="w-12 h-16 bg-white text-black rounded flex items-center justify-center">{displayCard(c)}</div>)) : pl.hand.map(()=> (<div key={Math.random()} className="w-12 h-16 bg-gray-700 rounded"></div>))}
                      </div>
                      <div className="mt-2">Bet: ${pl.betThisRound}</div>
                      <div>{pl.folded ? <em>Fold</em> : <em>Active</em>}</div>
                    </div>
                  ))}
                </div>

                <div className="absolute top-6 right-6 space-y-3">
                  {pPlayers.slice(3,6).map((pl, idx)=>(
                    <div key={idx} className="p-2 bg-green-800 rounded w-40">
                      <div className="flex justify-between"><strong>{pl.name}</strong><span>${Math.round(pl.bankroll)}</span></div>
                      <div className="mt-2 flex gap-2">
                        {pStage === "showdown" || pl.id === 0 ? pl.hand.map((c,i)=>(<div key={i} className="w-12 h-16 bg-white text-black rounded flex items-center justify-center">{displayCard(c)}</div>)) : pl.hand.map(()=> (<div key={Math.random()} className="w-12 h-16 bg-gray-700 rounded"></div>))}
                      </div>
                      <div className="mt-2">Bet: ${pl.betThisRound}</div>
                      <div>{pl.folded ? <em>Fold</em> : <em>Active</em>}</div>
                    </div>
                  ))}
                </div>

                {/* bottom (You) */}
                <div className="absolute bottom-6 w-full flex items-end justify-center">
                  <div className="w-[520px] p-4 bg-black/40 rounded flex flex-col items-center">
                    <div className="w-full flex justify-between items-center mb-3">
                      <div><strong>You</strong> <span className="text-sm opacity-80"> ${Math.round(bankroll)}</span></div>
                      <div className="text-sm opacity-80">Current Bet: ${pCurrentBet}</div>
                    </div>
                    <div className="flex gap-3">
                      {pPlayers[0] && (pStage === "showdown" ? pPlayers[0].hand.map((c,i)=>(<div key={i} className="w-20 h-28 bg-white text-black rounded flex items-center justify-center text-lg">{displayCard(c)}</div>)) : pPlayers[0].hand.map((c,i)=>(<div key={i} className="w-20 h-28 bg-white text-black rounded flex items-center justify-center text-lg">{displayCard(c)}</div>)))}
                    </div>

                    {pStage !== "showdown" && (
                      <div className="mt-3 flex gap-3">
                        <button className="px-3 py-1 bg-gray-200 text-black rounded" onClick={()=>humanCheck()}>Check</button>
                        <button className="px-3 py-1 bg-gray-200 text-black rounded" onClick={()=>humanCall()}>Call</button>
                        <button className="px-3 py-1 bg-red-500 text-white rounded" onClick={()=>humanFold()}>Fold</button>
                        <button className="px-3 py-1 bg-green-400 text-black rounded" onClick={()=>humanRaise(pMinRaise)}>Raise {pMinRaise}</button>
                      </div>
                    )}

                    {pStage === "showdown" && pWinner && (
                      <div className="mt-3 text-lg">
                        <div>Winner: <strong>{pWinner.name}</strong></div>
                        <div>Hand: <span className="opacity-80">{pWinner.eval ? `Category ${pWinner.eval.category}` : ""}</span></div>
                        <div className="mt-2 flex gap-2">
                          <button className="px-3 py-1 bg-yellow-400 text-black rounded" onClick={()=>initDealerRound((pDealerIndex+1) % pCount)}>Next Round</button>
                          <button className="px-3 py-1 bg-blue-600 rounded" onClick={()=>setMode("menu")}>Back to Menu</button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

              </div>
            </div>
          </div>
        )}
a
      </div>
    </div>
  );
}
