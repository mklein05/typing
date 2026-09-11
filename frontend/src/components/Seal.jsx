{/* Animated Typing Seal */}
<div className="relative w-24 h-24 mb-2 select-none pointer-events-none">
  <img
    src="/seal-left.png"
    alt="Seal typing left"
    className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-75 ${
      sealFrame === 0 ? 'opacity-100' : 'opacity-0'
    }`}
  />
  <img
    src="/seal-right.png"
    alt="Seal typing right"
    className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-75 ${
      sealFrame === 1 ? 'opacity-100' : 'opacity-0'
    }`}
  />
</div>