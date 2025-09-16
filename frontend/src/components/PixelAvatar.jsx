import React, { useEffect, useRef } from 'react';

/**
 * Generates a pseudo-random number between min and max based on a seed
 */
const seededRandom = (seed, min, max) => {
  // Simple LCG (Linear Congruential Generator)
  const a = 1664525;
  const c = 1013904223;
  const m = Math.pow(2, 32);
  
  // Calculate next seed
  const nextSeed = (a * seed + c) % m;
  
  // Return a value between min and max
  return min + (nextSeed / m) * (max - min);
};

/**
 * Creates a hash number from a string
 * Even a small change in the input creates a completely different output
 */
const stringToHashNumber = (str) => {
  let hash = 0;
  if (str.length === 0) return hash;
  
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  
  return Math.abs(hash);
};

/**
 * Draws a wobbly line like a child would draw
 * The line goes through the center of the canvas
 */
const drawChildishLine = (ctx, canvasSize, seed, lineWidth) => {
  // Center point of the canvas
  const centerX = canvasSize / 2;
  const centerY = canvasSize / 2;
  
  // Determine edge points (where the line starts and ends)
  // We'll pick two points on opposite sides of the canvas
  
  // First, determine which sides to connect (0: top, 1: right, 2: bottom, 3: left)
  const side1 = Math.floor(seededRandom(seed, 0, 4));
  const side2 = (side1 + 2) % 4; // Opposite side
  
  // Determine positions on those sides
  let startX = 0, startY = 0, endX = 0, endY = 0;
  
  switch (side1) {
    case 0: // Top
      startX = seededRandom(seed + 1, 0, canvasSize);
      startY = 0;
      break;
    case 1: // Right
      startX = canvasSize;
      startY = seededRandom(seed + 2, 0, canvasSize);
      break;
    case 2: // Bottom
      startX = seededRandom(seed + 3, 0, canvasSize);
      startY = canvasSize;
      break;
    case 3: // Left
      startX = 0;
      startY = seededRandom(seed + 4, 0, canvasSize);
      break;
  }
  
  switch (side2) {
    case 0: // Top
      endX = seededRandom(seed + 5, 0, canvasSize);
      endY = 0;
      break;
    case 1: // Right
      endX = canvasSize;
      endY = seededRandom(seed + 6, 0, canvasSize);
      break;
    case 2: // Bottom
      endX = seededRandom(seed + 7, 0, canvasSize);
      endY = canvasSize;
      break;
    case 3: // Left
      endX = 0;
      endY = seededRandom(seed + 8, 0, canvasSize);
      break;
  }
  
  // Set line properties
  ctx.strokeStyle = 'white';
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  
  // Start drawing the line
  ctx.beginPath();
  ctx.moveTo(startX, startY);
  
  // Add some wobbliness to the line
  // We'll create a few control points along the way
  
  // Increase the number of control points for more wobbliness (4-10)
  const controlPointCount = Math.floor(seededRandom(seed + 9, 4, 11));
  
  // Create an array of points including start, center, end, and control points
  const points = [];
  points.push({ x: startX, y: startY });
  
  // Add control points before center with increased wobbliness
  for (let i = 0; i < Math.floor(controlPointCount / 2); i++) {
    const ratio = (i + 1) / (Math.floor(controlPointCount / 2) + 1);
    
    // Base position on the line from start to center
    const baseX = startX + (centerX - startX) * ratio;
    const baseY = startY + (centerY - startY) * ratio;
    
    // Add more randomness (increased wobbliness)
    const wobbleAmount = seededRandom(seed + 10 + i, 10, 25); // Increased from 5-15 to 10-25
    const wobbleX = baseX + seededRandom(seed + 20 + i, -wobbleAmount, wobbleAmount);
    const wobbleY = baseY + seededRandom(seed + 30 + i, -wobbleAmount, wobbleAmount);
    
    points.push({ x: wobbleX, y: wobbleY });
  }
  
  // Add center point with slight offset for more randomness
  const centerOffsetX = seededRandom(seed + 100, -5, 5);
  const centerOffsetY = seededRandom(seed + 101, -5, 5);
  points.push({ x: centerX + centerOffsetX, y: centerY + centerOffsetY });
  
  // Add control points after center with increased wobbliness
  for (let i = 0; i < Math.ceil(controlPointCount / 2); i++) {
    const ratio = (i + 1) / (Math.ceil(controlPointCount / 2) + 1);
    
    // Base position on the line from center to end
    const baseX = centerX + (endX - centerX) * ratio;
    const baseY = centerY + (endY - centerY) * ratio;
    
    // Add more randomness (increased wobbliness)
    const wobbleAmount = seededRandom(seed + 40 + i, 10, 25); // Increased from 5-15 to 10-25
    const wobbleX = baseX + seededRandom(seed + 50 + i, -wobbleAmount, wobbleAmount);
    const wobbleY = baseY + seededRandom(seed + 60 + i, -wobbleAmount, wobbleAmount);
    
    points.push({ x: wobbleX, y: wobbleY });
  }
  
  // Add some additional random points for extra wobbliness
  const extraPoints = Math.floor(seededRandom(seed + 200, 0, 3)); // 0-2 extra points
  for (let i = 0; i < extraPoints; i++) {
    // Find a random position to insert the extra point
    const insertIndex = Math.floor(seededRandom(seed + 210 + i, 1, points.length - 1));
    
    // Get the points before and after the insertion point
    const prevPoint = points[insertIndex - 1];
    const nextPoint = points[insertIndex];
    
    // Create a new point that deviates from the line between prevPoint and nextPoint
    const midX = (prevPoint.x + nextPoint.x) / 2;
    const midY = (prevPoint.y + nextPoint.y) / 2;
    
    const wobbleAmount = seededRandom(seed + 220 + i, 15, 30);
    const extraX = midX + seededRandom(seed + 230 + i, -wobbleAmount, wobbleAmount);
    const extraY = midY + seededRandom(seed + 240 + i, -wobbleAmount, wobbleAmount);
    
    // Insert the extra point
    points.splice(insertIndex, 0, { x: extraX, y: extraY });
  }
  
  // Add end point
  points.push({ x: endX, y: endY });
  
  // Draw the line through all points
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  
  ctx.stroke();
};

/**
 * Generates a unique line-based avatar from a Tezos address
 * Lines cross the canvas and go through the middle, like a child's drawing
 */
const PixelAvatar = ({ 
  address, 
  size = 40,
  className = '' 
}) => {
  const canvasRef = useRef(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Set canvas dimensions to 100x100 as requested
    const canvasSize = 100;
    canvas.width = canvasSize;
    canvas.height = canvasSize;
    
    // Generate a hash from the address
    // This ensures a small change in address creates a completely different result
    const baseHash = stringToHashNumber(address);
    
    // Set background to black
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvasSize, canvasSize);
    
    // Determine number of lines based on the hash (1-18 lines)
    const lineCount = 1 + (baseHash % 12);
    
    // Draw the childish lines
    for (let i = 0; i < lineCount; i++) {
      // Generate a unique seed for each line
      const lineSeed = baseHash + (i * 1000);
      
      // All lines should be exactly 1px wide
      const lineWidth = 1;
      
      // Draw the line
      drawChildishLine(ctx, canvasSize, lineSeed, lineWidth);
    }
  }, [address, size]);
  
  return (
    <canvas 
      ref={canvasRef} 
      className={className}
      style={{ 
        width: size + 'px', 
        height: size + 'px',
        display: 'block',
        borderRadius: '50%', // Make it circular
        imageRendering: 'pixelated', // Critical for crisp pixels when scaling
        padding: 0,
        margin: 0,
        border: 'none'
      }}
    />
  );
};

export default PixelAvatar;
