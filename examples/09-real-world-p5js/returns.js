//
// By Aleksandra Jovanic
// twitter: @alexis_o_O
// instagram: aleksandrajovanic

// **************************
// *       PARAMETERS       *
// **************************

// Set this to true when minting
p5.disableFriendlyErrors = true;

// The title of your piece goes here
document.title = "returns - object one release ";

let size;

let boje = [];
let steps = 26;
let izbor_boja = [];
let grad1 = [];
let grad2 = [];
let gradient = [];
let gradient_shadow = [];
let bg;
let paused = 0;

let ptacke = [];
let tacke = [];
let klinovi = [];

let v0;
let f = 0.1;
let linija = [];

let points = [];

let back = 0;
let outline = 0;
let flow = 1;
let tip_animacije = 2;

let font;
let mar;
let rows, cols;
let dimx, dimy;
let ispis = "Bands: ";

function preload() {
  font = loadFont("ConsolaMono-Book.ttf");
}

// **************************
// *          SETUP         *
// **************************

function setup() {
  centerCanvas();
  noiseSeed(get_random(0, 9999));

  size = min(windowWidth, windowHeight);
  createCanvas(windowWidth, windowHeight);

  // size = 1080;
  // createCanvas(1080, 1440)

  frameRate(30);
  strokeJoin(ROUND);
  strokeCap(SQUARE);
  textFont(font);

  //palette
  bg = color(249, 245, 234);

  boje[0] = "rgba(147, 180, 189, 1)";
  boje[1] = "rgba(228, 227, 222, 1)";
  //  boje[1] ='rgba(249, 245, 234, 1)';
  boje[2] = "rgba(143, 156, 175, 1)";
  boje[3] = "rgba(234, 70, 77, 1)";
  boje[4] = "rgba(199, 190, 149, 1)";
  boje[5] = "rgba(253, 168, 62, 1)";
  boje[6] = "rgba(97, 83, 118, 1)";
  boje[7] = "rgba(213, 67, 77, 1)";
  boje[8] = "rgba(208, 216, 192, 1)";
  boje[9] = "rgba(240, 236, 225, 1)";

  //grid variables

  rowscols();
  reset_all();

  // Set up capture after initial setup to prevent auto-capture
  if ($bootloader.isCapture) {
    // We'll capture preview on frame 11 when artwork is ready
    // This just prevents auto-capture from firing too early
  }
}

function reset_all() {
  for (let i = 0; i < 4; i++) {
    izbor_boja[i] = boje[floor(get_random(0, boje.length))];
  }

  for (let i = 0; i < steps; i++) {
    grad1[i] = lerpColor(
      color(izbor_boja[0]),
      color(izbor_boja[1]),
      i / (steps - 1)
    );
    grad2[i] = lerpColor(
      color(izbor_boja[2]),
      color(izbor_boja[3]),
      i / (steps - 1)
    );
    gradient[i] = [];
    gradient_shadow[i] = [];
    for (let j = 0; j < steps; j++) {
      gradient[i][j] = lerpColor(
        color(grad1[i]),
        color(grad2[i]),
        j / (steps - 1)
      );
      gradient_shadow[i][j] = color(
        red(gradient[i][j]) - 30,
        green(gradient[i][j]) - 30,
        blue(gradient[i][j]) - 30
      );
    }
  }

  v0 = createVector(1, 0);

  let raspodela_tipova = get_random(0, 1);
  let tip = 0;
  if (raspodela_tipova < 0.15) {
    tip = 0;
  } else if (raspodela_tipova < 0.3) {
    tip = 1;
  } else {
    tip = 2;
  }

  back = floor(get_random(0, 2));
  outline = 1;

  let rows = floor(get_random(2, 5));

  klinovi = [];
  let nojzines = get_random(0.0, 0.05);

  for (let j = 0; j < rows; j += 1) {
    if (tip == 2) {
      tip_trake = constrain(j, 0, 1) + floor(get_random(2, 4));
    } else {
      tip_trake = tip;
    }

    ispis += tip_trake + "-";

    let granice = [0.05, width / height - 0.05, 0.05, 0.95];
    if (width < height) {
      granice = [0.05, 0.95, 0.05, height / width - 0.05];
    }

    let epicentar = createVector(
      get_random(granice[0], granice[1]),
      get_random(granice[2], granice[3])
    );
    let start_angle = get_random(0, TAU);

    let tmp_rnd = get_random(0.75, 1.15);
    if (tip_trake == 4) {
      tmp_rnd = get_random(0.15, 0.35);
    }
    let tang_angle = (floor(get_random(0, 2)) * 2 - 1) * tmp_rnd; // tangente su sa krajeva opsega

    let fine = 25;
    let pps = [];
    let n;

    if (tip_trake == 0) {
      // kada znam koliko jednakih trakica
      n = floor(get_random(2, 5)) * 2 + 1; //2,10
      for (let t = 0; t <= n; t++) {
        pps[t] = t / n;
      }
      n += 1;
    } else if (tip_trake == 1) {
      //kada su random trakice random sirina
      pps[0] = 0;
      while (pps[pps.length - 1] <= 1) {
        append(pps, pps[pps.length - 1] + get_random(0.01, 0.15));
      }
      pps[pps.length - 1] = 1;
      if ((pps.length - 1) % 2 == 0) {
        //mora da bude paran broj da bi se zatvorila poslednja
        n = pps.length - 1;
      } else {
        n = pps.length - 2;
      }
    } else if (tip_trake == 2) {
      //jednake trakice sa senkom
      n = floor(get_random(2, 5)) * 2 + 1;
      pps[0] = 0;
      let rnd;
      for (let i = 0; i <= n; i++) {
        rnd = 1 / n;
        if (i % 2 == 0) {
          append(pps, pps[pps.length - 1] + rnd * 0.75);
          append(pps, pps[pps.length - 2] + rnd * 0.75);
          append(pps, pps[pps.length - 1] + rnd * 0.25);
        } else {
          append(pps, pps[pps.length - 1] + rnd * 0.5);
        }
      }
      n = pps.length - 1;
    } else if (tip_trake == 3) {
      // RANDOM trakice kada imaju senku
      pps[0] = 0;
      let rnd;
      while (pps[pps.length - 1] <= 0.75) {
        rnd = get_random(0.01, 0.15); //0.01, 0.15
        append(pps, pps[pps.length - 1] + rnd);
        append(pps, pps[pps.length - 2] + rnd);
        append(pps, pps[pps.length - 1] + rnd * 0.25);

        rnd = get_random(0.01, 0.15);
        append(pps, pps[pps.length - 1] + rnd);
      }

      rnd = 1 - pps[pps.length - 1];
      append(pps, pps[pps.length - 1] + (2 * rnd) / 3);
      append(pps, pps[pps.length - 2] + (2 * rnd) / 3);
      append(pps, pps[pps.length - 1] + rnd / 3);

      pps[pps.length - 1] = 1;
      n = pps.length;
    } else {
      pps = [0, 0.7, 0.7, 1, 1];
      n = 4;
    }

    let vis_len = floor(get_random(15, 18));
    let len = floor(get_random(20, 35));

    let th = get_random(0.1, 0.15);
    if (tip_trake == 4) {
      th = 0.01;
    }

    linija[j] = new Linija(
      j,
      0,
      len,
      createVector(epicentar.x, epicentar.y),
      0.15,
      0.35,
      th,
      start_angle,
      granice,
      tang_angle,
      flow,
      j * 5 - 10,
      fine,
      n,
      pps,
      vis_len,
      nojzines,
      tip_trake
    );

    for (let k = 0; k < 10; k++) {
      append(
        klinovi,
        new Klin(
          get_random(granice[0], granice[1]),
          get_random(granice[2], granice[3]),
          PI / 2,
          get_random(0.008, 0.012),
          get_random(0.02, 0.06),
          get_random(0.1, 0.4),
          get_random(50, 100)
        )
      );
    }
  } //end for
} //end reset_all();

function grid_back_f() {
  textAlign(CENTER, CENTER);
  textSize(0.008 * size);

  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      push();
      translate(
        floor(i * dimx + 2 * mar) + 0.5,
        floor(j * dimy + 2 * mar) + 0.5
      );
      noFill();
      stroke(0);
      strokeWeight(0.0003 * size);
      line(mar / 4, 0, dimx - mar / 4, 0);
      line(
        floor(dimx - mar / 4),
        0,
        floor(dimx - mar / 4),
        floor(dimy - mar / 2)
      );
      line(
        mar / 4,
        floor(dimy - mar / 2),
        dimx - mar / 4,
        floor(dimy - mar / 2)
      );
      line(floor(mar / 4), 0, floor(mar / 4), floor(dimy - mar / 2));

      for (let k = 1; k < 10; k++) {
        line(
          mar / 4,
          floor((k * (dimy - 2 * mar)) / 10),
          (((k % 2) + 1) * mar) / 2.4,
          floor((k * (dimy - 2 * mar)) / 10)
        );
      }
      for (let k = 1; k < 10; k++) {
        line(
          floor(mar / 4 + (k * dimx) / 10),
          0,
          floor(mar / 4 + (k * dimx) / 10),
          mar / 4
        );
      }

      fill(60);
      noStroke();
      text(romanize(i + j * cols + 1), floor(mar / 4) + 1.5 * mar, mar);
      pop();
    }
  }

  for (let i = 0; i < klinovi.length; i += 2) {
    noFill();
    stroke(0);
    strokeWeight(0.00025 * size);
    drawingContext.setLineDash([
      size * 0.016,
      size * 0.01,
      size * 0.004,
      size * 0.01,
    ]);
    ellipse(
      klinovi[i].px_centar * size,
      klinovi[i].py_centar * size,
      2 * klinovi[i].r * size,
      2 * klinovi[i].r * size
    );
    drawingContext.setLineDash([]);
  }

  //sinusoida

  push();
  translate(4 * mar, height - 7 * mar);
  stroke(0);
  noFill();

  let g = 64;
  let s = width - 8 * mar;
  let amp = width * 0.02;
  let u = 0;
  let korak = (4 * PI) / g;
  for (let i = 0; i <= g; i++) {
    strokeWeight(0.0003 * size);
    stroke(0);

    push();
    translate(i * (s / g), cos(u) * amp - amp);
    let tx = curveTangent(
      i * (s / g),
      i * (s / g),
      (i + 1) * (s / g),
      (i + 1) * (s / g),
      1
    );
    let ty = curveTangent(
      cos(u) * amp - amp,
      cos(u) * amp - amp,
      cos(u + korak) * amp - amp,
      cos(u + korak) * amp - amp,
      1
    );
    let a = atan2(ty, tx);
    rotate(a - PI / 2);
    if (i % 4 == 0) {
      line(-size * 0.02, 0, size * 0.03, 0);
      noStroke();
      fill(60);
      textSize(0.01 * size);
      text(nf(u, 0, 2), size * 0.05, 0);
      noFill();
    } else {
      line(0, 0, size * 0.01, 0);
    }
    pop();

    if (i != g) {
      if (i % 2 == 0) {
        strokeWeight(0.0006 * size);
        stroke(60);
        beginShape();
        vertex(i * (s / g), cos(u) * amp - amp - size * 0.0025);
        vertex((i + 1) * (s / g), cos(u + korak) * amp - amp - size * 0.0025);
        endShape();
      }

      stroke(0);
      strokeWeight(0.0003 * size);
      beginShape();
      vertex(i * (s / g), cos(u) * amp - amp);
      vertex((i + 1) * (s / g), cos(u + korak) * amp - amp);
      endShape();

      beginShape();
      vertex(i * (s / g), cos(u) * amp - amp - size * 0.005);
      vertex((i + 1) * (s / g), cos(u + korak) * amp - amp - size * 0.005);
      endShape();

      beginShape();
      vertex(i * (s / g), cos(u) * amp - 0.8 * amp - size * 0.005);
      vertex(
        (i + 1) * (s / g),
        cos(u + korak) * amp - 0.8 * amp - size * 0.005
      );
      endShape();
      beginShape();
      vertex(i * (s / g), cos(u) * amp - 0.76 * amp - size * 0.005);
      vertex(
        (i + 1) * (s / g),
        cos(u + korak) * amp - 0.76 * amp - size * 0.005
      );
      endShape();
    }

    u += korak;
  }
  pop();
}

function grid_front() {
  for (let i = 0; i < klinovi.length; i++) {
    klinovi[i].move();
    klinovi[i].display(i);
  }
}

class Linija {
  constructor(
    index,
    p = 0,
    len = 0,
    poc = createVector(0, 0),
    wmin = 0.04,
    wmax = 0.1,
    h = 0.02,
    start_angle,
    granice,
    tang_angle,
    flow,
    start = 0,
    fine,
    n,
    pps,
    vis_len,
    nojzines,
    tip_trake
  ) {
    this.index = index;
    this.len = len;
    this.poc = poc;
    this.wmin = wmin;
    this.wmax = wmax;
    this.start = start;
    this.h = h;
    this.p = p;
    this.start_angle = start_angle;
    this.granice = granice;
    this.flow = flow;

    this.fine = fine;
    this.n = n;
    this.pps = pps;
    this.vis_len = vis_len;

    this.nojzines = nojzines;
    this.tip_trake = tip_trake;

    this.tacke = random_tacke(
      this.len,
      this.poc,
      this.wmin,
      this.wmax,
      this.start_angle,
      this.granice,
      this.p
    );

    if (p < 0) {
      for (let i = 0; i < linija[this.index - 1].tacke.length; i++) {
        if (width > height) {
          tacke[i] = createVector(
            width / height / 2 -
              (linija[this.index - 1].tacke[i].x - width / height / 2),
            linija[this.index - 1].tacke[i].y
          );
        } else {
          tacke[i] = createVector(
            0.5 - (linija[this.index - 1].tacke[i].x - 0.5),
            linija[this.index - 1].tacke[i].y
          );
        }
      }
    }

    this.die = 0;
    this.end = 1;

    this.traka_br = [];
    this.direction = [];
    this.len = [];
    this.A = [];
    this.B = [];
    this.C = [];
    this.D = [];

    this.tangente = [];
    this.tg_len = [];
    this.t = tang_angle;

    this.tu = [];

    this.offset = floor(get_random(0, 10));

    let previous_tangente = [
      get_random(-this.t, this.t),
      get_random(-this.t, this.t),
      get_random(-this.t, this.t),
      get_random(-this.t, this.t),
    ];
    this.traka_br[0] = 0;

    for (let i = 0; i < this.tacke.length - 1; i++) {
      this.direction[i] = p5.Vector.sub(
        createVector(this.tacke[i].x, this.tacke[i].y),
        createVector(this.tacke[i + 1].x, this.tacke[i + 1].y)
      ).normalize();
      this.len[i] = dist(
        this.tacke[i].x,
        this.tacke[i].y,
        this.tacke[i + 1].x,
        this.tacke[i + 1].y
      );
      this.traka_br[i + 1] = this.traka_br[i];
      if (i > 0) {
        if (
          abs(
            p5.Vector.angleBetween(
              this.direction[i],
              p5.Vector.mult(this.direction[i - 1], -1)
            )
          ) <
          0.55 * PI
        ) {
          this.traka_br[i + 1] = this.traka_br[i] + 1;
        }
      } else {
        this.traka_br[i + 1] = 0;
      }

      this.tu[i] = [
        get_random(-this.t, this.t),
        previous_tangente[0],
        previous_tangente[1],
        get_random(-this.t, this.t),
        get_random(-this.t, this.t),
        get_random(-this.t, this.t),
        get_random(-this.t, this.t),
        get_random(-this.t, this.t),
      ];

      previous_tangente[0] = this.tu[i][6];
      previous_tangente[1] = this.tu[i][5];
    }

    this.direction[this.tacke.length - 1] = p5.Vector.sub(
      createVector(
        this.tacke[tacke.length - 1].x,
        this.tacke[tacke.length - 1].y
      ),
      createVector(0, 0)
    ).normalize();
    this.len[this.tacke.length - 1] = 0;

    generate(
      this.tacke,
      this.direction,
      this.traka_br,
      this.A,
      this.B,
      this.C,
      this.D,
      this.offset,
      this.tu,
      this.tangente,
      this.tg_len,
      this.h,
      this.flow
    );

    this.segmenti = [0];

    for (let i = 0; i < this.tacke.length - 2; i++) {
      if (this.traka_br[i + 1] != this.traka_br[i + 2]) {
        append(this.segmenti, i + 1);
      }
    }
    append(this.segmenti, this.tacke.length - 1);
  }

  display() {
    let c = color(bg);
    strokeWeight(size * 0.001);

    for (let j = 1; j < this.segmenti.length; j++) {
      for (let i = this.segmenti[j - 1]; i < this.segmenti[j]; i++) {
        let l = this.segmenti[j] - i;
        if (j == this.segmenti.length - 1) {
          l = 0;
        }
        let values = animacija(
          tip_animacije,
          i,
          this.end,
          this.start,
          this.fine,
          this.vis_len,
          this.tacke.length
        );
        let stanje = values[0];
        this.start = values[1];
        this.end = values[2];
        push();
        translate(size * 0.005, size * 0.01);
        traka(
          i,
          l,
          this.A[i],
          this.B[i],
          this.C[i],
          this.D[i],
          this.tangente[i],
          c,
          this.fine,
          this.end,
          this.n,
          this.pps,
          stanje,
          2,
          this.traka_br[i + 1] % 2,
          this.traka_br[i] != this.traka_br[i + 1] ? 1 : 0,
          this.nojzines,
          this.tip_trake
        );
        pop();
      }

      for (let i = this.segmenti[j - 1]; i < this.segmenti[j]; i++) {
        let l = this.segmenti[j] - i;
        if (j == this.segmenti.length - 1) {
          l = 0;
        }
        let values = animacija(
          tip_animacije,
          i,
          this.end,
          this.start,
          this.fine,
          this.vis_len,
          this.tacke.length
        );
        let stanje = values[0];
        this.start = values[1];
        this.end = values[2];

        traka(
          i,
          l,
          this.A[i],
          this.B[i],
          this.C[i],
          this.D[i],
          this.tangente[i],
          c,
          this.fine,
          this.end,
          this.n,
          this.pps,
          stanje,
          0,
          this.traka_br[i + 1] % 2,
          this.traka_br[i + 1] != this.traka_br[i + 2] ? 1 : 0,
          this.nojzines,
          this.tip_trake
        );
      }
    }

    function animacija(a, i, end, start, fine, vis_len, tacke_length) {
      let stanje;
      if (a == 0) {
        // stalno vidljivo
        stanje = 1;
      } else if (a == 1) {
        //samo raste
        stanje = 3;
        if (floor(end / fine - start) == i) {
          stanje = 0;
        }
        if (floor(end / fine - start) > i) {
          stanje = 1;
        }
      } else if (a == 2) {
        // nastaje i nestaje u duzini vis_len
        stanje = 3;
        if (floor(end / fine - start) == i) {
          stanje = 0;
        }
        if (
          floor(end / fine - start) > i &&
          floor(end / fine - start) < i + vis_len
        ) {
          stanje = 1;
        }
        if (floor(end / fine - start) == i + vis_len) {
          stanje = 2;
        }
        if (floor(end / fine - start) > i + vis_len + tacke_length - 1) {
          start = 0;
          end = 1;
        }
      }

      return [stanje, start, end];
    }
  }

  move() {
    //ako je animiran oblik
    generate(
      this.tacke,
      this.direction,
      this.traka_br,
      this.A,
      this.B,
      this.C,
      this.D,
      this.offset,
      this.tu,
      this.tangente,
      this.tg_len,
      this.h,
      this.flow
    );
    this.end += 2;
  }

  grafikon() {
    for (let i = 0; i < this.tacke.length / 2 - 1; i++) {
      let tmpx = (2 * width) / (this.tacke.length - 1);
      let tmpy = ((0.5 + this.tacke[i].y) * size) / 2;
      let tmpy_next = ((0.5 + this.tacke[i + 1].y) * size) / 2;
      noStroke();
      fill(60);
      ellipse(tmpx * i, tmpy, size * 0.002, size * 0.002);
      textSize(size * 0.009);
      text(nf(this.tacke[i].y, 0, 2), tmpx * i + 0.02 * size, tmpy);
      noFill();
      stroke(0);
      strokeWeight(0.0002 * size);
      bezier(
        tmpx * i,
        tmpy,
        tmpx * i + 0.04 * size,
        tmpy,
        tmpx * (i + 1) - 0.04 * size,
        tmpy_next,
        tmpx * (i + 1),
        tmpy_next
      );
    }
  }
}

class Klin {
  constructor(px, py, rot, s1, s2, r, speed) {
    this.rot = rot;
    this.s1 = s1;
    this.s2 = s2;
    this.r = r;
    this.speed = speed;
    this.px_centar = px;
    this.py_centar = py;
    this.st_u = get_random(0, TAU);

    this.px = this.px_centar + cos(this.st_u) * this.r;
    this.py = this.py_centar + sin(this.st_u) * this.r;

    this.pv = [];
    let u = 0;
    for (let i = 0; i < 4; i++) {
      append(this.pv, createVector((cos(u) * this.s1) / 3, sin(u) * this.s1));
      u += PI / 2 + get_random(-PI / 8, PI / 8);
    }
  }

  display(index) {
    noFill();
    strokeWeight(0.0003 * size);
    stroke(0);
    fill(bg);

    push();
    translate(this.px * size, this.py * size);
    rotate(this.rot);
    beginShape();
    for (let i = 0; i < 4; i++) {
      vertex(this.pv[i].x * size, this.pv[i].y * size);
    }
    endShape(CLOSE);

    beginShape();
    vertex(this.pv[0].x * size, this.pv[0].y * size);
    vertex(this.pv[0].x * size + this.s2 * size, this.pv[0].y * size);
    vertex(this.pv[1].x * size, this.pv[1].y * size);
    vertex(this.pv[0].x * size, this.pv[0].y * size);
    endShape();

    beginShape();
    vertex(this.pv[3].x * size, this.pv[3].y * size);
    vertex(this.pv[0].x * size + this.s2 * size, this.pv[0].y * size);
    vertex(this.pv[0].x * size, this.pv[0].y * size);
    vertex(this.pv[3].x * size, this.pv[3].y * size);
    endShape();
    pop();

    push();
    translate(this.px * size, this.py * size);
    noStroke();
    fill(60);
    textSize(0.011 * size);
    text(index, 0.02 * size, -0.02 * size);
    stroke(0);
    pop();
  }

  move() {
    this.px =
      this.px_centar + cos(this.st_u + frameCount / this.speed) * this.r;
    this.py =
      this.py_centar + sin(this.st_u + frameCount / this.speed) * this.r;
    this.rot = this.st_u + frameCount / this.speed + PI / 2;
  }
}

function traka(
  index,
  l_index,
  A,
  B,
  C,
  D,
  tangente,
  c,
  fine,
  end,
  n,
  pps,
  stanje,
  sw = 0,
  reverse,
  brejk,
  nojzines = 0,
  tip_trake
) {
  let c1, c2, c3;
  //generisi noise unutar trakice
  let td = 3;
  noiseSeed(index);
  rnd_dist = [];
  rnd_u = PI / 2 + p5.Vector.sub(D, A).heading();
  for (let i = 0; i <= fine; i++) {
    rnd_dist[i] =
      sin((i * PI) / fine) *
      map(noise(td), 0, 1, -nojzines * size, nojzines * size);
    td += 0.05;
  }

  //trakice
  let x, y;

  let S = [];
  let E = [];
  let tgs = [];
  let tge = [];

  for (let i = 0; i < n; i++) {
    if (reverse == 1) {
      S[i] = createVector(
        bezierPoint(B.x, tangente[2].x, tangente[1].x, A.x, pps[i]),
        bezierPoint(B.y, tangente[2].y, tangente[1].y, A.y, pps[i])
      );
      E[i] = createVector(
        bezierPoint(C.x, tangente[5].x, tangente[6].x, D.x, pps[i]),
        bezierPoint(C.y, tangente[5].y, tangente[6].y, D.y, pps[i])
      );

      tgs[i] = p5.Vector.add(
        p5.Vector.sub(tangente[3], B)
          .setMag(
            lerp(
              p5.Vector.sub(tangente[3], B).mag(),
              p5.Vector.sub(tangente[0], A).mag(),
              pps[i]
            )
          )
          .rotate(
            pps[i] *
              p5.Vector.angleBetween(
                p5.Vector.sub(tangente[3], B),
                p5.Vector.sub(tangente[0], A)
              )
          ),
        S[i]
      );

      tge[i] = p5.Vector.add(
        p5.Vector.sub(tangente[4], C)
          .setMag(
            lerp(
              p5.Vector.sub(tangente[4], C).mag(),
              p5.Vector.sub(tangente[7], D).mag(),
              pps[i]
            )
          )
          .rotate(
            pps[i] *
              p5.Vector.angleBetween(
                p5.Vector.sub(tangente[4], C),
                p5.Vector.sub(tangente[7], D)
              )
          ),
        E[i]
      );
    } else {
      S[i] = createVector(
        bezierPoint(A.x, tangente[1].x, tangente[2].x, B.x, pps[i]),
        bezierPoint(A.y, tangente[1].y, tangente[2].y, B.y, pps[i])
      );
      E[i] = createVector(
        bezierPoint(D.x, tangente[6].x, tangente[5].x, C.x, pps[i]),
        bezierPoint(D.y, tangente[6].y, tangente[5].y, C.y, pps[i])
      );

      tgs[i] = p5.Vector.add(
        p5.Vector.sub(tangente[0], A)
          .setMag(
            lerp(
              p5.Vector.sub(tangente[0], A).mag(),
              p5.Vector.sub(tangente[3], B).mag(),
              pps[i]
            )
          )
          .rotate(
            pps[i] *
              p5.Vector.angleBetween(
                p5.Vector.sub(tangente[0], A),
                p5.Vector.sub(tangente[3], B)
              )
          ),
        S[i]
      );
      tge[i] = p5.Vector.add(
        p5.Vector.sub(tangente[7], D)
          .setMag(
            lerp(
              p5.Vector.sub(tangente[7], D).mag(),
              p5.Vector.sub(tangente[4], C).mag(),
              pps[i]
            )
          )
          .rotate(
            pps[i] *
              p5.Vector.angleBetween(
                p5.Vector.sub(tangente[7], D),
                p5.Vector.sub(tangente[4], C)
              )
          ),
        E[i]
      );
    }
  }

  let tmpx, tmpy;

  let upto = n - 2; // tip 0, 1, 2, 3, 4

  for (let i = 0; i <= upto; i++) {
    //i=0;

    //boje i senke
    if (sw == 0) {
      tmpx = floor(((steps - 1) * (cos((index * TAU) / 8) + 1)) / 2);

      if (tip_trake == 4) {
        tmpy = floor(map(i, 0, upto, 0, 2));
      } else {
        tmpy = floor(map(i, 0, upto, 0, steps - 1));
      }

      c = gradient[tmpx][tmpy];
      c1 = gradient_shadow[tmpx][tmpy];

      c2 =
        gradient[floor(((steps - 1) * (cos(((index + 1) * TAU) / 8) + 1)) / 2)][
          tmpy
        ];
      c3 =
        gradient_shadow[
          floor(((steps - 1) * (cos(((index + 1) * TAU) / 8) + 1)) / 2)
        ][tmpy];

      tmpcol1 = color(red(c) + 10, green(c) + 10, blue(c) + 10);
      tmpcol2 = color(red(c) - 10, green(c) - 10, blue(c) - 10);
      tmpcol3 = color(red(c2) - 10, green(c2) - 10, blue(c2) - 10);

      fill(c);
      stroke(c);
      strokeWeight(0.001 * size);

      // let lingrad = drawingContext.createLinearGradient(tacke[index].x*size, tacke[index].y*size, tacke[index+1].x*size, tacke[index+1].y*size);
      let lingrad = drawingContext.createLinearGradient(
        S[i].x * size,
        S[i].y * size,
        E[i].x * size,
        E[i].y * size
      );
      lingrad.addColorStop(0.1, tmpcol2);
      lingrad.addColorStop(0.3, tmpcol1);
      lingrad.addColorStop(0.6, tmpcol1);
      lingrad.addColorStop(0.9, tmpcol3);

      //let lingrad_shadow = drawingContext.createLinearGradient(tacke[index].x*size, tacke[index].y*size, tacke[index+1].x*size, tacke[index+1].y*size);

      let lingrad_shadow = drawingContext.createLinearGradient(
        S[i].x * size,
        S[i].y * size,
        E[i].x * size,
        E[i].y * size
      );
      lingrad_shadow.addColorStop(0, c1);
      lingrad_shadow.addColorStop(1, c3);

      if (l_index == 1) {
        tmpcol1 = color(red(c) - 10, green(c) - 10, blue(c) - 10);
        tmpcol2 = color(red(c) - 10, green(c) - 10, blue(c) - 10);
        tmpcol3 = color(red(c2) - 40, green(c2) - 40, blue(c2) - 40);

        //  lingrad = drawingContext.createLinearGradient(tacke[index].x*size, tacke[index].y*size, tacke[index+1].x*size, tacke[index+1].y*size);
        lingrad = drawingContext.createLinearGradient(
          S[i].x * size,
          S[i].y * size,
          E[i].x * size,
          E[i].y * size
        );

        lingrad.addColorStop(0.1, tmpcol2);
        lingrad.addColorStop(0.3, tmpcol1);
        lingrad.addColorStop(0.5, tmpcol1);
        lingrad.addColorStop(0.8, tmpcol3);
      }

      drawingContext.fillStyle = lingrad;
      drawingContext.strokeStyle = lingrad;

      //boje za trakice, sa pozadinom i bez

      if ((tip_trake == 3 || tip_trake == 2 || tip_trake == 4) && i % 4 == 2) {
        fill(c1);
        stroke(c1);
        drawingContext.fillStyle = lingrad_shadow;
        drawingContext.strokeStyle = lingrad_shadow;
      }

      if (
        ((tip_trake == 2 || tip_trake == 3) && back == 1 && i % 4 == 3) ||
        ((tip_trake == 0 || tip_trake == 1) && back == 1 && i % 2 == 1)
      ) {
        fill(bg);
        stroke(bg);
        strokeWeight(0.0001 * size);
        strokeCap(PROJECT);
      } else if (i % 2 == 1 && back == 0) {
        noFill();
        noStroke();
      }
    } else if (sw == 2) {
      fill(0, 20);
      noStroke();
      if (i % 2 == 1 && back == 0) {
        noFill();
        noStroke();
      }
    } else {
      fill(bg);
      noStroke();
      if (i % 2 == 1 && back == 0) {
        noFill();
        noStroke();
      }
    }

    if (stanje == 0) {
      //iscrtava se
      let x0, y0;
      x0 = bezierPoint(S[i].x, tgs[i].x, tge[i].x, E[i].x, 0);
      y0 = bezierPoint(S[i].y, tgs[i].y, tge[i].y, E[i].y, 0);
      beginShape();
      for (let j = 0; j <= constrain(end % fine, 0, fine); j++) {
        x = bezierPoint(S[i].x, tgs[i].x, tge[i].x, E[i].x, j / fine);
        y = bezierPoint(S[i].y, tgs[i].y, tge[i].y, E[i].y, j / fine);
        vertex(
          x * size + cos(rnd_u) * rnd_dist[j],
          y * size + sin(rnd_u) * rnd_dist[j]
        );
      }

      for (let j = constrain(end % fine, 0, fine); j >= 0; j--) {
        x = bezierPoint(
          S[i + 1].x,
          tgs[i + 1].x,
          tge[i + 1].x,
          E[i + 1].x,
          j / fine
        );
        y = bezierPoint(
          S[i + 1].y,
          tgs[i + 1].y,
          tge[i + 1].y,
          E[i + 1].y,
          j / fine
        );
        vertex(
          x * size + cos(rnd_u) * rnd_dist[j],
          y * size + sin(rnd_u) * rnd_dist[j]
        );
      }
      endShape();

      if (sw != 2) {
        if (tip_trake == 4 && i % 4 == 2) {
          stroke(c1);
        } else if (i % 4 == 2) {
          //  stroke(tmpcol3);
        }

        strokeWeight(size * 0.001);
        line(
          x * size + cos(rnd_u) * rnd_dist[0],
          y * size + sin(rnd_u) * rnd_dist[0],
          x0 * size + cos(rnd_u) * rnd_dist[0],
          y0 * size + sin(rnd_u) * rnd_dist[0]
        );
      }
    } else if (stanje == 2) {
      //nestaje

      beginShape();
      for (let j = constrain(end % fine, 0, fine + 1); j <= fine; j++) {
        x = bezierPoint(S[i].x, tgs[i].x, tge[i].x, E[i].x, j / fine);
        y = bezierPoint(S[i].y, tgs[i].y, tge[i].y, E[i].y, j / fine);
        vertex(
          x * size + cos(rnd_u) * rnd_dist[j],
          y * size + sin(rnd_u) * rnd_dist[j]
        );
      }
      for (let j = fine; j >= constrain(end % fine, 0, fine + 1); j--) {
        x = bezierPoint(
          S[i + 1].x,
          tgs[i + 1].x,
          tge[i + 1].x,
          E[i + 1].x,
          j / fine
        );
        y = bezierPoint(
          S[i + 1].y,
          tgs[i + 1].y,
          tge[i + 1].y,
          E[i + 1].y,
          j / fine
        );
        vertex(
          x * size + cos(rnd_u) * rnd_dist[j],
          y * size + sin(rnd_u) * rnd_dist[j]
        );
      }
      endShape();
    } else if (stanje == 1) {
      let x0, y0;
      x0 = bezierPoint(S[i].x, tgs[i].x, tge[i].x, E[i].x, 0);
      y0 = bezierPoint(S[i].y, tgs[i].y, tge[i].y, E[i].y, 0);
      beginShape();
      for (let j = 0; j <= fine; j++) {
        //constrain(frameCount, 0, fine)
        x = bezierPoint(S[i].x, tgs[i].x, tge[i].x, E[i].x, j / fine);
        y = bezierPoint(S[i].y, tgs[i].y, tge[i].y, E[i].y, j / fine);
        vertex(
          x * size + cos(rnd_u) * rnd_dist[j],
          y * size + sin(rnd_u) * rnd_dist[j]
        );
      }
      for (let j = fine; j >= 0; j--) {
        //constrain(frameCount, 0, fine)
        x = bezierPoint(
          S[i + 1].x,
          tgs[i + 1].x,
          tge[i + 1].x,
          E[i + 1].x,
          j / fine
        );
        y = bezierPoint(
          S[i + 1].y,
          tgs[i + 1].y,
          tge[i + 1].y,
          E[i + 1].y,
          j / fine
        );
        vertex(
          x * size + cos(rnd_u) * rnd_dist[j],
          y * size + sin(rnd_u) * rnd_dist[j]
        );
      }
      endShape();

      if (sw != 2) {
        if (tip_trake == 4 && i % 4 == 2) {
          stroke(c1);
        } else if (i % 4 == 2) {
          //stroke(c1);
        }

        strokeWeight(size * 0.001);
        line(
          x * size + cos(rnd_u) * rnd_dist[0],
          y * size + sin(rnd_u) * rnd_dist[0],
          x0 * size + cos(rnd_u) * rnd_dist[0],
          y0 * size + sin(rnd_u) * rnd_dist[0]
        );
      }
    }
  }

  if (sw == 0) {
    if (outline == 1) {
      // outline za trakice
      upto = n;
      stroke(0);
      strokeWeight(size * 0.0003);
      noFill();

      for (let i = 0; i < upto; i += 1) {
        if (stanje == 0) {
          // iscrtava se

          beginShape();

          if (index == 0 && i % 2 == 0) {
            x = bezierPoint(
              S[i + 1].x,
              tgs[i + 1].x,
              tge[i + 1].x,
              E[i + 1].x,
              0
            );
            y = bezierPoint(
              S[i + 1].y,
              tgs[i + 1].y,
              tge[i + 1].y,
              E[i + 1].y,
              0
            );
            vertex(
              x * size + cos(rnd_u) * rnd_dist[0],
              y * size + sin(rnd_u) * rnd_dist[0]
            );
          }

          if (
            ((tip_trake == 4 || tip_trake == 2 || tip_trake == 3) &&
              i % 4 != 2) ||
            tip_trake == 1 ||
            tip_trake == 0
          ) {
            for (let j = 0; j <= constrain(end % fine, 0, fine); j += 1) {
              x = bezierPoint(S[i].x, tgs[i].x, tge[i].x, E[i].x, j / fine);
              y = bezierPoint(S[i].y, tgs[i].y, tge[i].y, E[i].y, j / fine);
              vertex(
                x * size + cos(rnd_u) * rnd_dist[j],
                y * size + sin(rnd_u) * rnd_dist[j]
              );
            }

            if (i % 2 == 0) {
              x = bezierPoint(
                S[i + 1].x,
                tgs[i + 1].x,
                tge[i + 1].x,
                E[i + 1].x,
                constrain(end % fine, 0, fine) / fine
              );
              y = bezierPoint(
                S[i + 1].y,
                tgs[i + 1].y,
                tge[i + 1].y,
                E[i + 1].y,
                constrain(end % fine, 0, fine) / fine
              );
              vertex(
                x * size +
                  cos(rnd_u) * rnd_dist[constrain(end % fine, 0, fine)],
                y * size + sin(rnd_u) * rnd_dist[constrain(end % fine, 0, fine)]
              );
            }
          }

          endShape();
        } else if (stanje == 2) {
          //nestaje

          beginShape();
          if (i % 2 == 0) {
            let tmp = constrain(end % fine, 0, fine + 1);
            x = bezierPoint(
              S[i + 1].x,
              tgs[i + 1].x,
              tge[i + 1].x,
              E[i + 1].x,
              tmp / fine
            );
            y = bezierPoint(
              S[i + 1].y,
              tgs[i + 1].y,
              tge[i + 1].y,
              E[i + 1].y,
              tmp / fine
            );
            vertex(
              x * size + cos(rnd_u) * rnd_dist[tmp],
              y * size + sin(rnd_u) * rnd_dist[tmp]
            );
            x = bezierPoint(S[i].x, tgs[i].x, tge[i].x, E[i].x, tmp / fine);
            y = bezierPoint(S[i].y, tgs[i].y, tge[i].y, E[i].y, tmp / fine);
            vertex(
              x * size + cos(rnd_u) * rnd_dist[tmp],
              y * size + sin(rnd_u) * rnd_dist[tmp]
            );
          }
          if (
            ((tip_trake == 4 || tip_trake == 2 || tip_trake == 3) &&
              i % 4 != 2) ||
            tip_trake == 1 ||
            tip_trake == 0
          ) {
            for (let j = constrain(end % fine, 0, fine + 1); j <= fine; j++) {
              x = bezierPoint(S[i].x, tgs[i].x, tge[i].x, E[i].x, j / fine);
              y = bezierPoint(S[i].y, tgs[i].y, tge[i].y, E[i].y, j / fine);
              vertex(
                x * size + cos(rnd_u) * rnd_dist[j],
                y * size + sin(rnd_u) * rnd_dist[j]
              );
            }
          }

          endShape();
        } else if (stanje == 1) {
          beginShape();
          if (index == 0 && i % 2 == 0) {
            x = bezierPoint(
              S[i + 1].x,
              tgs[i + 1].x,
              tge[i + 1].x,
              E[i + 1].x,
              0
            );
            y = bezierPoint(
              S[i + 1].y,
              tgs[i + 1].y,
              tge[i + 1].y,
              E[i + 1].y,
              0
            );
            vertex(
              x * size + cos(rnd_u) * rnd_dist[0],
              y * size + sin(rnd_u) * rnd_dist[0]
            );
          }

          if (
            ((tip_trake == 4 || tip_trake == 2 || tip_trake == 3) &&
              i % 4 != 2) ||
            tip_trake == 1 ||
            tip_trake == 0
          ) {
            for (let j = 0; j <= fine; j++) {
              x = bezierPoint(S[i].x, tgs[i].x, tge[i].x, E[i].x, j / fine);
              y = bezierPoint(S[i].y, tgs[i].y, tge[i].y, E[i].y, j / fine);
              vertex(
                x * size + cos(rnd_u) * rnd_dist[j],
                y * size + sin(rnd_u) * rnd_dist[j]
              );
            }
          }

          // if (   brejk == 1){
          //   x = bezierPoint(S[i+1].x, tgs[i+1].x, tge[i+1].x, E[i+1].x, 1);
          //   y = bezierPoint(S[i+1].y, tgs[i+1].y, tge[i+1].y, E[i+1].y, 1);
          //   vertex(x*size + cos(rnd_u)*rnd_dist[fine], y*size+ sin(rnd_u)*rnd_dist[fine]);
          // }

          endShape();
        }
      }
    }
  }
}

function generate(
  tacke,
  direction,
  traka_br,
  A,
  B,
  C,
  D,
  offset,
  tu,
  tangente,
  tg_len,
  h,
  flow
) {
  //note: offset za kad pocinje, zaostatak... mozda moze drugacije

  for (let i = 0; i < tacke.length - 1; i++) {
    let f1, f2;

    if (traka_br[i + 1] == traka_br[i + 2] || i == tacke.length - 2) {
      //  f1 =   1*h + ((sin(  (i%6) + frameCount/10 + offset)+1)/2)*h*1.25;     // +(sin((i%10) +frameCount/20 + offset  )+0.5)*h   15*TAU*i/tacke.length

      //f1 =   1*h - constrain( sin(((tacke.length-i)%6) + frameCount/10+ offset)   , 0, 1 )*h*0.55;

      f1 =
        1 * h -
        constrain(sin(((tacke.length - i) % 4) + offset), 0, 1) * h * 0.75;

      // f1 =   1*h  - constrain(  i/(tacke.length)   , 0, 1 )*h ;

      f2 = f1;
    } else {
      f1 = h;
      f2 = f1;
    }

    //  if (traka_br[i+1]==traka_br[i+2] || i==(tacke.length-2)){
    //     f1 =   0.25*h + ((sin((i%6) + frameCount/10 + offset)+1)/2)*h*0.75;     // +(sin((i%10) +frameCount/20 + offset  )+0.5)*h   15*TAU*i/tacke.length
    //     f2 = f1;
    //   } else {
    //     f1 = h;
    //     f2 = f1;
    //   }

    // f1 = h;
    // f2 = h ;

    //  f1 =  dist(tacke[i].x, tacke[i].y, tacke[i+1].x, tacke[i+1].y)*h*10;
    //  f2 =  f1;

    // f1 =  ( traka_br[i]%2)*(0.00)+h;
    // f2 =  ( traka_br[i+1]%2)*(0.02)+h;

    // f1 = (1-0.8*i/tacke.length)*h;
    // f2 = f1;

    let ugao = PI / 2 + v0.angleBetween(direction[i]);

    A[i] = createVector(
      cos(ugao) * f1 + tacke[i].x,
      sin(ugao) * f1 + tacke[i].y
    );
    B[i] = createVector(
      cos(ugao - PI) * f1 + tacke[i].x,
      sin(ugao - PI) * f1 + tacke[i].y
    );
    D[i] = createVector(
      cos(ugao) * f2 + tacke[i + 1].x,
      sin(ugao) * f2 + tacke[i + 1].y
    );
    C[i] = createVector(
      cos(ugao - PI) * f2 + tacke[i + 1].x,
      sin(ugao - PI) * f2 + tacke[i + 1].y
    );
  }

  //  korekcija flip trake
  for (let i = 0; i < tacke.length - 2; i++) {
    if (traka_br[i + 1] == traka_br[i + 2]) {
      let tmpX = createVector(
        lerp(D[i].x, A[i + 1].x, 0.5),
        lerp(D[i].y, A[i + 1].y, 0.5)
      );
      let tmpY = createVector(
        lerp(C[i].x, B[i + 1].x, 0.5),
        lerp(C[i].y, B[i + 1].y, 0.5)
      );

      D[i] = tmpX;
      A[i + 1] = tmpX;
      C[i] = tmpY;
      B[i + 1] = tmpY;
    } else {
      let tmpX = createVector(
        lerp(D[i].x, B[i + 1].x, 0.5),
        lerp(D[i].y, B[i + 1].y, 0.5)
      );
      let tmpY = createVector(
        lerp(C[i].x, A[i + 1].x, 0.5),
        lerp(C[i].y, A[i + 1].y, 0.5)
      );

      D[i] = tmpX;
      B[i + 1] = tmpX;
      C[i] = tmpY;
      A[i + 1] = tmpY;
    }
  }

  //tangente prema korigovanim temenima, dodirne tangente da budu iste
  for (let i = 0; i < tacke.length - 1; i++) {
    let ugao;
    tangente[i] = [];

    tg_len[0] = dist(A[i].x, A[i].y, B[i].x, B[i].y) * 0.4;
    tg_len[1] = dist(B[i].x, B[i].y, C[i].x, C[i].y) * 0.4;
    tg_len[2] = dist(C[i].x, C[i].y, D[i].x, D[i].y) * 0.4;
    tg_len[3] = dist(A[i].x, A[i].y, D[i].x, D[i].y) * 0.4;

    ugao = PI / 2 + v0.angleBetween(direction[i]);
    tangente[i][0] = createVector(
      A[i].x + cos(ugao + PI / 2 + tu[i][0]) * tg_len[3],
      A[i].y + sin(ugao + PI / 2 + tu[i][0]) * tg_len[3]
    );
    tangente[i][3] = createVector(
      B[i].x + cos(ugao + PI / 2 + tu[i][3]) * tg_len[1],
      B[i].y + sin(ugao + PI / 2 + tu[i][3]) * tg_len[1]
    );
    tangente[i][4] = createVector(
      C[i].x + cos(ugao - PI / 2 + tu[i][4]) * tg_len[1],
      C[i].y + sin(ugao - PI / 2 + tu[i][4]) * tg_len[1]
    );
    tangente[i][7] = createVector(
      D[i].x + cos(ugao - PI / 2 + tu[i][7]) * tg_len[3],
      D[i].y + sin(ugao - PI / 2 + tu[i][7]) * tg_len[3]
    );

    ugao = v0.angleBetween(p5.Vector.sub(A[i], B[i]));
    tangente[i][1] = createVector(
      A[i].x + cos(ugao - PI + tu[i][1]) * tg_len[0],
      A[i].y + sin(ugao - PI + tu[i][1]) * tg_len[0]
    );
    tangente[i][2] = createVector(
      B[i].x + cos(ugao + tu[i][2]) * tg_len[0],
      B[i].y + sin(ugao + tu[i][2]) * tg_len[0]
    );

    ugao = v0.angleBetween(p5.Vector.sub(D[i], C[i]));
    tangente[i][5] = createVector(
      C[i].x + cos(ugao + tu[i][5]) * tg_len[2],
      C[i].y + sin(ugao + tu[i][5]) * tg_len[2]
    );
    tangente[i][6] = createVector(
      D[i].x + cos(ugao - PI + tu[i][6]) * tg_len[2],
      D[i].y + sin(ugao - PI + tu[i][6]) * tg_len[2]
    );

    if (traka_br[i] != traka_br[i + 1] && i >= 1) {
      tangente[i][1].x = tangente[i - 1][5].x;
      tangente[i][1].y = tangente[i - 1][5].y;
      tangente[i][2].x = tangente[i - 1][6].x;
      tangente[i][2].y = tangente[i - 1][6].y;
    }

    if (flow != 0) {
      if (i >= 1 && traka_br[i] == traka_br[i + 1]) {
        tangente[i][0] = p5.Vector.sub(tangente[i - 1][7], A[i])
          .rotate(PI)
          .add(A[i]);
        tangente[i][3] = p5.Vector.sub(tangente[i - 1][4], B[i])
          .rotate(PI)
          .add(B[i]);
      }
      // else if (i>1 && traka_br[i]!=traka_br[i+1]) {
      //   tangente[i][0] = tangente[i-1][4] ;
      //   tangente[i][3] = tangente[i-1][7] ;
      // }
    }

    // debug tangente
    // stroke(0); strokeWeight(1);
    // line(tangente[i][0].x*size, tangente[i ][0].y*size, A[i].x*size, A[i].y*size);
    // stroke(255, 0, 0);
    // line(tangente[i][3].x*size, tangente[i][3].y*size, B[i].x*size, B[i].y*size);
    // stroke(0); strokeWeight(1);
    // line(tangente[i][4].x*size, tangente[i ][4].y*size, C[i].x*size, C[i].y*size);
    // stroke(255, 0, 0);
    // line(tangente[i][7].x*size, tangente[i][7].y*size, D[i].x*size, D[i].y*size);
  }
}

// ****************************
// *  ako su random putanje   *
// ****************************
function random_tacke(len, poc, wmin, wmax, start_angle, granice, paths = 0) {
  let t = 0;

  if (paths > 0) {
    let ps = [];
    let ps_1 = [];
    tacke = [];

    ps = split(points[abs(paths) - 1], " ");

    for (let i = 0; i < ps.length - 1; i++) {
      ps_1[i] = split(ps[i], ",");
      tacke[i] = createVector(int(ps_1[i][0]) / 100, int(ps_1[i][1]) / 100);
    }
  } else {
    tacke = [];
    tacke[0] = poc;

    let tmp_len = get_random(wmin, wmax);
    let tmpu = start_angle; //3*PI/2  +get_random(-0.2, 0.2);   // get_random(0,TAU);
    let tmp_direction = createVector(cos(tmpu), sin(tmpu));

    for (let i = 1; i < len; i++) {
      tacke[i] = p5.Vector.add(
        tacke[i - 1],
        p5.Vector.mult(tmp_direction, tmp_len)
      );

      if (tacke[i].y > granice[3] || tacke[i].y < granice[2]) {
        tmpu = 2 * PI - tmpu;
        tmp_direction = createVector(cos(tmpu), sin(tmpu));
        tacke[i] = p5.Vector.add(
          tacke[i - 1],
          p5.Vector.mult(tmp_direction, tmp_len)
        );
      }

      if (tacke[i].x > granice[1] || tacke[i].x < granice[0]) {
        tmpu = PI - tmpu;
        tmp_direction = createVector(cos(tmpu), sin(tmpu));
        tacke[i] = p5.Vector.add(
          tacke[i - 1],
          p5.Vector.mult(tmp_direction, tmp_len)
        );
      }

      tmpu = tmpu + get_random(-1.5, 1.5); //+ //+get_random(  -0.3 , 0.3)

      // zig zag
      // if (i%2 == 0) {
      //   tmpu =  tmpu -get_random(PI+1.55, PI-1.55) //  + map(noise(t),0,1, -2.0, 2.0); t+=0.1;
      // } else {
      //   tmpu =  tmpu    + map(noise(t),0,1, -2.0, 2.0); t+=0.1;
      // }

      tmp_direction = createVector(cos(tmpu), sin(tmpu));
      tmp_len = get_random(wmin, wmax); // 0.03 - 0.0005 *i/len ;
    }
  }

  return tacke;
}

// **************************
// *          DRAW          *
// **************************

function draw() {
  blendMode(BLEND);
  background(bg);

  push();
  beginClip();

  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      push();
      translate(
        floor(i * dimx + 2 * mar) + 0.5,
        floor(j * dimy + 2 * mar) + 0.5
      );
      rect(mar / 4 - 1, -1, dimx - mar / 2 + 2, dimy - mar / 2 + 2);
      pop();
    }
  }
  endClip();

  drawingContext.clip();
  for (let i = 0; i < linija.length; i += 2) {
    linija[i].grafikon();
  }
  grid_back_f();
  pop();

  fill(90);
  noStroke();
  textSize(size * 0.01);
  textAlign(CENTER, CENTER);
  text("R E T U R N S", width / 2, height - 3 * mar);
  textAlign(LEFT, CENTER);
  text("Page " + $bootloader.hash[0], 2.5 * mar, height - 3 * mar);
  textAlign(RIGHT, CENTER);
  text(ispis.slice(0, -1), width - 2.5 * mar, height - 3 * mar);

  for (let i = 0; i < linija.length; i++) {
    linija[i].display();
    linija[i].move();
  }

  grid_front();

  if (frameCount === 11 && $bootloader.isCapture) {
    // Set features before capture
    $bootloader.setFeatures({
      'Page': $bootloader.hash[0].toUpperCase(),
      'Bands': linija.length,
      'Background': back === 1 ? 'Filled' : 'Transparent',
      'Layout': cols + 'x' + rows
    });
    $bootloader.capture();
  }

  // if (frameCount < 361) {
  //   save("retrns_07_"+frameCount+".png");
  // }
}

// **************************
// *         UTILS          *
// **************************

function romanize(num) {
  if (isNaN(num)) return NaN;
  var digits = String(+num).split(""),
    key = [
      "",
      "C",
      "CC",
      "CCC",
      "CD",
      "D",
      "DC",
      "DCC",
      "DCCC",
      "CM",
      "",
      "X",
      "XX",
      "XXX",
      "XL",
      "L",
      "LX",
      "LXX",
      "LXXX",
      "XC",
      "",
      "I",
      "II",
      "III",
      "IV",
      "V",
      "VI",
      "VII",
      "VIII",
      "IX",
    ],
    roman = "",
    i = 3;
  while (i--) roman = (key[+digits.pop() + i * 10] || "") + roman;
  return Array(+digits.join("") + 1).join("M") + roman;
}

function keyPressed() {
  if (key == "s" || key == "S") {
    save("returns_" + formatSeed($bootloader.hash) + ".png");
    // exportCanvas('image/png')
  }
}

function mouseReleased() {
  if (paused == 0) {
    paused = 1;
    noLoop();
  } else {
    paused = 0;
    loop();
  }
}

// **************************
// *        RESIZE          *
// **************************

function windowResized() {
  if (paused) {
    loop();
  }
  size = min(windowWidth, windowHeight);
  resizeCanvas(windowWidth, windowHeight);

  rowscols();

  if (paused) {
    noLoop();
  }
}

function rowscols() {
  mar = 0.015 * height;
  if (width / height <= 0.7) {
    rows = 6;
    cols = 2;
  } else if (width / height <= 1) {
    rows = 4;
    cols = 3;
  } else if (width / height <= 2) {
    rows = 3;
    cols = 4;
  } else {
    cols = 12;
    rows = 1;
  }

  dimx = (width - 4 * mar) / cols;
  dimy = (height - 7 * mar) / rows;
}

function centerCanvas() {
  var s = document.body.style;
  s.display = "flex";
  s.overflow = "hidden";
  s.height = "100vh";
  s.alignItems = "center";
  s.justifyContent = "center";
}

function get_random(min, max) {
  return min + $bootloader.rnd() * (max - min);
}

// let timeout;
// let requestId;
// function cancel() {
//   if (timeout) clearTimeout(timeout);
//   if (requestId) cancelAnimationFrame(requestId);
// }
// function reset() {
//   cancel();
//   draw();
// }

// Animation handled by the sandbox when animation.mode="auto"
// No need for manual GIF export or registerExport functions
