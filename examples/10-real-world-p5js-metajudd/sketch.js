/*
 *
 * CENTURY-XXX-METAJUDD
 *
 * Donald Judd
 * 3 June 1928 – 12 February 1994
 *
 * 'P' to pause
 * 'R' to re-roll
 *
 */

let paper = "#F6F6F6"; // white

let colorNames = {
  "#FF0000": "Alizarin Crimson",
  "#00FF00": "Viridian Green",
  "#0000FF": "Ultramarine Blue",
  "#FFCC00": "Cadmium Yellow",
  "#FF00CC": "Cadmium Red",
  "#00CCFF": "Cerulean Blue",
  "#FF6600": "Cadmium Orange",
  "#66FF00": "Permanent Green",
  "#0066FF": "Cobalt Blue"
}
let colors;

let fill1A, fill1B;
let fill2A, fill2B;
let line1, line2;

let fillTypes = ["Center", "Border", "Center & Border"];
let gridTypes = [
  "2x2",  // 2 by 2, all thick
  "3x2A",  // 3 by 2, all thin (2 line colors, by direction)
  "3x2B",  // 3 by 2, vertical thin, horizontal thick (2 line colors, by direction)
  "3x3A",  // 3 by 3, all thin
  "3x3B",  // 3 by 3, all thin with thin 2 by 2 overlay (2 line colors, by overlay)
  "3x3C",  // 3 by 3, vertical thick, horizontal thin (2 line colors, by direction)
  "4x3",  // 4 by 3, all thin
  "4x4A",  // 4 by 4, all thin (2 line colors, by direction)
  "4x4B",  // 4 by 4, all thin (2 line colors, inner 2x2 grid vs outer lines)
  "6x6",  // 6 by 6, all thin
];

let fillType, gridType;

let angle1 = 0.0;
let angle2 = 3.1415;

let orientation;
let thin, thick;

let isPaused = false;
let needsCapture = true;

function setup() {
  createCanvas(windowWidth, windowHeight, WEBGL);
  if (height > width) {
    orientation = "vertical";
  } else {
    orientation = "horizontal";  // Includes square
  }
  colors = Object.keys(colorNames);
  setLineWeight();
  rollDice();
  noSmooth();

  // Synchronous bootloader - set features immediately
  setFeatures();
}

function setLineWeight() {
  thin = 0.008 * min(width, height);
  thinF = floor(thin);
  if (thinF % 2 === 0) {
    thin = thinF;
  } else {
    thin = ceil(thin);
  }
  thick = floor(2 * thin);
}

function rollDice() {
  fillTypeChance = $bootloader.rnd();
  //print(fillTypeChance);
  if (fillTypeChance < 0.375) {
    fillType = "Center";
  } else if (fillTypeChance < 0.75) {
    fillType = "Border";
  } else {
    fillType = "Center & Border";
  }

  gridType = gridTypes[int($bootloader.rnd() * gridTypes.length)];

  fill1A = colors[int($bootloader.rnd() * colors.length)];
  fill1B = colors[int($bootloader.rnd() * colors.length)];
  while (fill1B === fill1A) {
    fill1B = colors[int($bootloader.rnd() * colors.length)];
  }
  fill2A = colors[int($bootloader.rnd() * colors.length)];
  while ((fill2A === fill1A) | (fill2A === fill1B)) {
    fill2A = colors[int($bootloader.rnd() * colors.length)];
  }
  fill2B = colors[int($bootloader.rnd() * colors.length)];
  while ((fill2B === fill1A) | (fill2B === fill1B) | (fill2B === fill2A)) {
    fill2B = colors[int($bootloader.rnd() * colors.length)];
  }
  line1 = colors[int($bootloader.rnd() * colors.length)];
  while (
    (line1 === fill1A) |
    (line1 === fill1B) |
    (line1 === fill2A) |
    (line1 === fill2B)
  ) {
    line1 = colors[int($bootloader.rnd() * colors.length)];
  }
  line2 = colors[int($bootloader.rnd() * colors.length)];
  while (
    (line2 === fill1A) |
    (line2 === fill1B) |
    (line2 === fill2A) |
    (line2 === fill2B) |
    (line2 === line1)
  ) {
    line2 = colors[int($bootloader.rnd() * colors.length)];
  }
}

function setFeatures() {
  let gradientColors = getColorFeatures("gradient");
  let lineColors = getColorFeatures("line");

  $bootloader.setFeatures({
    "Grid Type": gridType,
    "Gradient Type": fillType,
    "Gradient Colors": gradientColors,
    "Line Color(s)": lineColors
  });
}

function getColorFeatures(type) {
  if (type === "gradient") {
    if (fillType === "Center" | fillType === "Border") {
      return (`${colorNames[fill1A]} & ${colorNames[fill1B]}`);
    } else {
      return(`${colorNames[fill1A]} & ${colorNames[fill1B]}, ${colorNames[fill2A]} & ${colorNames[fill2B]}`);
    }
  } else {
    if (gridType === "2x2" | gridType === "3x3A" | gridType === "4x3" | gridType === "6x6") {
      return colorNames[line1];
    } else {
      return (`${colorNames[line1]} & ${colorNames[line2]}`);
    }
  }
}

function draw() {
  translate(-width / 2, -height / 2, 0); // WEBGL translation
  blendMode(BLEND);
  drawFill();
  blendMode(MULTIPLY);
  drawGrid();

  if (needsCapture && $bootloader.isCapture) {
    $bootloader.capture();
    needsCapture = false;
  }
}

function drawFill() {
  noStroke();
  let sixth = min(width, height) / 6 - thin / 2;
  if (!isPaused) {
    angle1 += 0.005;
    angle2 += 0.005;
  }

  if (fillType === "Center") {
    background(paper);
    let mid = lerpColor(color(fill1A), color(fill1B), 0.5);
    if (orientation === "horizontal") {
      let xx = map(sin(angle1), -1, 1, sixth, width - sixth);
      let moving;
      if (sin(angle1) < 0) {
        moving = "up";
      } else {
        moving = "down";
      }

      noStroke();
      beginShape();
      fill(fill1A);
      vertex(sixth, sixth);
      fill(mid);
      vertex(xx, sixth);
      fill(fill1B);
      vertex(width - sixth, sixth);
      vertex(width - sixth, height - sixth);
      fill(mid);
      vertex(xx, height - sixth);
      fill(fill1A);
      vertex(sixth, height - sixth);
      endShape(CLOSE);
      
    } else {
      // vertical
      let xx = map(sin(angle1), -1, 1, sixth, height - sixth);

      noStroke();
      beginShape();
      fill(fill1A);
      vertex(sixth, sixth);
      vertex(width - sixth, sixth);
      fill(mid);
      vertex(width - sixth, min(height - sixth, xx + 1));
      vertex(sixth, min(height - sixth, xx + 1));
      endShape(CLOSE);

      beginShape();
      fill(mid);
      vertex(sixth, xx);
      vertex(width - sixth, xx);
      fill(fill1B);
      vertex(width - sixth, height - sixth);
      vertex(sixth, height - sixth);
      endShape(CLOSE);
    }
    
  } else if (fillType === "Border") {
    let mid = lerpColor(color(fill1A), color(fill1B), 0.5);
    if (orientation === "horizontal") {
      let xx = map(sin(angle1), -1, 1, 0, width);

      noStroke();
      beginShape();
      fill(fill1A);
      vertex(0, 0);
      fill(mid);
      vertex(xx, 0);
      fill(fill1B);
      vertex(width, 0);
      vertex(width, height);
      fill(mid);
      vertex(xx, height);
      fill(fill1A);
      vertex(0, height);
      endShape(CLOSE);
      
    } else {
      // vertical
      let xx = map(sin(angle1), -1, 1, 0, height);

      noStroke();
      beginShape();
      fill(fill1A);
      vertex(0, 0);
      vertex(width, 0);
      fill(mid);
      vertex(width, min(height, xx + 1));
      vertex(0, min(height, xx + 1));
      endShape(CLOSE);

      beginShape();
      fill(mid);
      vertex(0, xx);
      vertex(width, xx);
      fill(fill1B);
      vertex(width, height);
      vertex(0, height);
      endShape(CLOSE);
    }

    fill(paper);
    rect(sixth, sixth, width - 2 * sixth, height - 2 * sixth);
  } else {
    // both
    let mid = lerpColor(color(fill1A), color(fill1B), 0.5);
    let mid2 = lerpColor(color(fill2A), color(fill2B), 0.5);
    if (orientation === "horizontal") {
      let xx = map(sin(angle2), -1, 1, 0, width); // change based on orientation

      noStroke();
      beginShape();
      fill(fill1A);
      vertex(0, 0);
      fill(mid2);
      vertex(xx, 0); // Midpoint Top
      fill(fill1B);
      vertex(width, 0);
      vertex(width, height);
      fill(mid2);
      vertex(xx, height); // Midpoint Bottom
      fill(fill1A);
      vertex(0, height);
      endShape(CLOSE);

      let xx2 = map(sin(angle1), -1, 1, sixth, width - sixth);
      let moving;
      if (sin(angle1) < 0) {
        moving = "up";
      } else {
        moving = "down";
      }

      noStroke();
      beginShape();
      fill(fill1A);
      vertex(sixth, sixth);
      fill(mid);
      vertex(xx2, sixth); // Midpoint Top
      fill(fill1B);
      vertex(width - sixth, sixth);
      vertex(width - sixth, height - sixth);
      fill(mid);
      vertex(xx2, height - sixth); // Midpoint Bottom
      fill(fill1A);
      vertex(sixth, height - sixth);
      endShape(CLOSE);
    } else {
      // vertical
      let xx = map(sin(angle1), -1, 1, 0, height);

      noStroke();
      beginShape();
      fill(fill1A);
      vertex(0, 0);
      vertex(width, 0);
      fill(mid);
      vertex(width, min(height, xx + 1));
      vertex(0, min(height, xx + 1));
      endShape(CLOSE);

      beginShape();
      fill(mid);
      vertex(0, xx);
      vertex(width, xx);
      fill(fill1B);
      vertex(width, height);
      vertex(0, height);
      endShape(CLOSE);

      let xx2 = map(sin(angle2), -1, 1, sixth, height - sixth);

      noStroke();

      beginShape();
      fill(fill2A);
      vertex(sixth, sixth);
      vertex(width - sixth, sixth);
      fill(mid2);
      vertex(width - sixth, min(height - sixth, xx2 + 1));
      vertex(sixth, min(height - sixth, xx2 + 1));
      endShape(CLOSE);

      beginShape();
      fill(mid2);
      vertex(sixth, xx2);
      vertex(width - sixth, xx2);
      fill(fill2B);
      vertex(width - sixth, height - sixth);
      vertex(sixth, height - sixth);
      endShape(CLOSE);
    }
  }
}

function drawGrid() {
  if (gridType === "2x2") {
    // 2 by 2, all thick
    strokeWeight(thick);
    stroke(line1);
    line(width / 2, 0, width / 2, height);
    line(0, height / 2, width, height / 2);
  } else if (gridType === "3x2A") {
    // 3 by 2, all thin (2 line colors, by direction)
    strokeWeight(thin);
    if (orientation === "vertical") {
      stroke(line1);
      for (let i = 1; i < 3; i++) {
        line(0, (height / 3) * i, width, (height / 3) * i);
      }
      stroke(line2);
      for (let i = 1; i < 2; i++) {
        line((width / 2) * i, 0, (width / 2) * i, height);
      }
    } else if (orientation === "horizontal") {
      stroke(line1);
      for (let i = 1; i < 3; i++) {
        line((width / 3) * i, 0, (width / 3) * i, height);
      }
      stroke(line2);
      for (let i = 1; i < 2; i++) {
        line(0, (height / 2) * i, width, (height / 2) * i);
      }
    }
  } else if (gridType === "3x2B") {
    // 3 by 2, vertical thin, horizontal thick (2 line colors, by direction)
    if (orientation === "vertical") {
      strokeWeight(thin);
      stroke(line1);
      for (let i = 1; i < 3; i++) {
        line(0, (height / 3) * i, width, (height / 3) * i);
      }
      strokeWeight(thick);
      stroke(line2);
      for (let i = 1; i < 2; i++) {
        line((width / 2) * i, 0, (width / 2) * i, height);
      }
    } else if (orientation === "horizontal") {
      strokeWeight(thin);
      stroke(line1);
      for (let i = 1; i < 3; i++) {
        line((width / 3) * i, 0, (width / 3) * i, height);
      }
      strokeWeight(thick);
      stroke(line2);
      for (let i = 1; i < 2; i++) {
        line(0, (height / 2) * i, width, (height / 2) * i);
      }
    }
  } else if (gridType === "3x3A") {
    // 3 by 3, all thin
    strokeWeight(thin);
    stroke(line1);
    for (let i = 1; i < 3; i++) {
      line((width / 3) * i, 0, (width / 3) * i, height);
      line(0, (height / 3) * i, width, (height / 3) * i);
    }
  } else if (gridType === "3x3B") {
    // 3 by 3, all thin with thin 2 by 2 overlay (2 line colors, by overlay)
    strokeWeight(thin);
    stroke(line1);
    for (let i = 1; i < 3; i++) {
      line((width / 3) * i, 0, (width / 3) * i, height);
      line(0, (height / 3) * i, width, (height / 3) * i);
    }
    // 2x2 overlay
    stroke(line2);
    line(width / 2, 0, width / 2, height);
    line(0, height / 2, width, height / 2);
  } else if (gridType === "3x3C") {
    // 3 by 3, vertical thick, horizontal thin (2 line colors, by direction),
    if (orientation === "vertical") {
      stroke(line1);
      strokeWeight(thick);
      for (let i = 1; i < 3; i++) {
        line(0, (height / 3) * i, width, (height / 3) * i);
      }
      stroke(line2);
      strokeWeight(thin);
      for (let i = 1; i < 3; i++) {
        line((width / 3) * i, 0, (width / 3) * i, height);
      }
    } else if (orientation === "horizontal") {
      stroke(line1);
      strokeWeight(thick);
      for (let i = 1; i < 3; i++) {
        line((width / 3) * i, 0, (width / 3) * i, height);
      }
      stroke(line2);
      strokeWeight(thin);
      for (let i = 1; i < 3; i++) {
        line(0, (height / 3) * i, width, (height / 3) * i);
      }
    }
  } else if (gridType === "4x3") {
    // 4 by 3, all thin
    strokeWeight(thin);
    if (orientation === "vertical") {
      stroke(line1);
      for (let i = 1; i < 4; i++) {
        line(0, (height / 4) * i, width, (height / 4) * i);
      }
      for (let i = 1; i < 3; i++) {
        line((width / 3) * i, 0, (width / 3) * i, height);
      }
    } else if (orientation === "horizontal") {
      stroke(line1);
      for (let i = 1; i < 4; i++) {
        line((width / 4) * i, 0, (width / 4) * i, height);
      }
      for (let i = 1; i < 3; i++) {
        line(0, (height / 3) * i, width, (height / 3) * i);
      }
    }
  } else if (gridType === "4x4A") {
    // 4 by 4, all thin (2 line colors, by direction)
    // think about order
    strokeWeight(thin);
    stroke(line1);
    for (let i = 1; i < 4; i++) {
      line((width / 4) * i, 0, (width / 4) * i, height);
    }
    stroke(line2);
    for (let i = 1; i < 4; i++) {
      line(0, (height / 4) * i, width, (height / 4) * i);
    }
  } else if (gridType === "4x4B") {
    // 4 by 4, all thin (2 line colors, inner 2x2 grid vs outer lines)
    strokeWeight(thin);
    stroke(line1);
    for (let i = 1; i < 4; i++) {
      if (i === 2) {
        continue;
      }
      line((width / 4) * i, 0, (width / 4) * i, height);
      line(0, (height / 4) * i, width, (height / 4) * i);
    }
    // 2x2 overlay
    stroke(line2);
    line(width / 2, 0, width / 2, height);
    line(0, height / 2, width, height / 2);
  } else {
    // 6x6
    strokeWeight(thin);
    stroke(line1);
    for (let i = 1; i < 6; i++) {
      line((width / 6) * i, 0, (width / 6) * i, height);
      line(0, (height / 6) * i, width, (height / 6) * i);
    }
  }
}

function keyPressed() {
  if ((key === "r") | (key === "R")) {
    rollDice();
  }
  else if ((key === "p") | (key === "P")) {
    isPaused = !isPaused;
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  if (height > width) {
    orientation = "vertical";
  } else {
    orientation = "horizontal";
  }
  setLineWeight();
}
