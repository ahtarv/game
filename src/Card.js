import { motion } from "framer-motion";

export default function Card({ card, flipped, nearMiss, onClick }) {
  return (
    <motion.div className="w-20 h-28 cursor-pointer [perspective:1000px]" onClick={()=>onClick(card)} whileTap={{scale:0.95}}>
      <motion.div className="relative w-full h-full rounded-xl shadow-lg [transform-style:preserve-3d]" animate={{rotateY: flipped ? 180 : 0}} transition={{duration:0.5}}>
        <div className="absolute inset-0 rounded-xl overflow-hidden [backface-visibility:hidden]">
          <img
            src="/card-back.jpg"
            alt="Card Back"
            className="w-full h-full object-cover"
          />
        </div>
        <div className={`absolute inset-0 flex items-center justify-center text-3xl font-bold rounded-xl [backface-visibility:hidden] [transform:rotateY(180deg)]
          ${card.bonus ? "bg-yellow-400 text-black animate-pulse" : "bg-white text-black"}
          ${nearMiss ? "ring-4 ring-red-500 animate-pulse" : ""}`}>
          {card.value}
        </div>
      </motion.div>
    </motion.div>
  );
}
