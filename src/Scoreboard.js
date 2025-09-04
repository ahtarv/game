export default function Scoreboard({ bankroll, bet, setBet, attempts, streak }) {
  return (
    <div className="flex justify-between items-center p-4 bg-gray-900 text-white rounded-lg">
      <div>💰 Bankroll: ${bankroll.toFixed(0)}</div>
      <div>
        Bet:
        {[10,20,50,100].map(amount=>(
          <button key={amount} className={`ml-2 px-2 py-1 rounded font-bold ${bet===amount?"bg-yellow-400 text-black":"bg-gray-700 text-white"}`} onClick={()=>setBet(amount)}>{amount}</button>
        ))}
      </div>
      <div>❤️ Attempts: {attempts}</div>
      <div>🔥 Streak: {streak}</div>
    </div>
  );
}
