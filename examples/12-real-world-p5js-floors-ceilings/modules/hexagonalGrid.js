//  Hexagonal Grid
//  (q,r)
//          ___       ___       ___     
//         /   \     /   \     /   \     /
//     ___/     \___/     \___/     \___/
//    /   \ 1,0 /   \ 3,0 /   \ 5,0 /   \
//   /     \___/     \___/     \___/     \
//   \ 0,0 /   \ 2,0 /   \ 4,0 /   \ 6,0 /
//    \___/     \___/     \___/     \___/
//    /   \ 1,1 /   \ 3,1 /   \ 5,1 /   \
//   /     \___/     \___/     \___/     \
//   \ 0,1 /   \ 2,1 /   \ 4,1 /   \ 6,1 /
//    \___/     \___/     \___/     \___/
//

export class HexagonalGrid {
    constructor(width, height, tileWidth, tileHeight, dx=false, dy=false, isScrolling = false) {
        this.width = width;
        this.height = height;
        this.tileWidth = tileWidth;
        this.tileHeight = tileHeight;
        this.dx = dx;
        this.dy = dy;
        this.grid = new Map();
        this.offset = {w: 0, h: 0};
        this.isScrolling = isScrolling;
        this.reverseFill = false;
        this._borders = {top: !isScrolling, right: true, bottom: !isScrolling, left: true};
    }
    
    coordToKey(q, r) {
        return `${q},${r}`;
    }

    keyToCoord(key) {
        let coord = key.split(',').map(a => parseInt(a));
        return {q:coord[0], r: coord[1]};
    }
    
    setTile(q, r, tile) {
        this.grid.set(this.coordToKey(q,r), tile);
    }

    getTile(q, r) {
        return this.grid.get(this.coordToKey(q, r));
    }

    removeTile(q, r) {
        this.grid.delete(this.coordToKey(q, r));
    }

    copyTile(qs, rs, qd, rd) {
        const tile = this.getTile(qs, rs);
        this.setTile(qd, rd, tile);
    }

    setOffset() {
        if (this.isScrolling) {
            const w =  (this.width-1) * this.dx + this.tileWidth;
            const h = (this.height + 0.5) * this.dy;
            this.offset = {w, h};
            return this.offset;
        }

        let emptyLeft = 0, emptyRight = 0, emptyTop = 0, emptyBottom = 0;

        const isColumnEmpty = q => {
            for (let r = 0; r < this.height; r++) {
                const tile = this.getTile(q, r);
                if (!tile || !tile.isEmpty()) return false;
            }
            return true;
        };

        const isRowEmpty = r => {
            for (let q = 0; q < this.width; q++) {
                const tile = this.getTile(q, r);
                if (!tile || !tile.isEmpty()) return false;
            }
            return true;
        };

        while (emptyLeft < this.width && isColumnEmpty(emptyLeft)) emptyLeft++;
        while (emptyRight < this.width && isColumnEmpty(this.width - 1 - emptyRight)) emptyRight++;
        while (emptyTop < this.height && isRowEmpty(emptyTop)) emptyTop++;
        while (emptyBottom < this.height && isRowEmpty(this.height - 1 - emptyBottom)) emptyBottom++;
        
        let adjustY = (emptyBottom - emptyTop);
        let adjustX = (emptyRight - emptyLeft);
    
        const topRowOdd = [];
        for (let q = emptyLeft; q < this.width; q++) {
            if (q % 2 === 1) topRowOdd.push(this.getTile(q, emptyTop));
        }
        const bottomRowEven = [];
        for (let q = 0; q < this.width; q++) {
            if (q % 2 === 0) bottomRowEven.push(this.getTile(q, this.height - 1 - emptyBottom));
        }

        adjustY += topRowOdd.length > 0 && topRowOdd.every(tile => tile && tile.isEmpty()) ? -.5 : 0;
        adjustY += bottomRowEven.length > 0 && bottomRowEven.every(tile => tile && tile.isEmpty()) ? .5 : 0;

        const w =  (this.width-1 - adjustX) * this.dx + this.tileWidth;
        const h = (this.height + .5 - adjustY) * this.dy;
        this.offset = { w, h };
        return this.offset;
    }

    getOffset(){
        return this.offset;
    }

    getNeighborsTiles(q, r) {
        return {
            N: this.getTile(q, r - 1),
            NE: q % 2 == 0 ? this.getTile(q + 1, r)   : this.getTile(q + 1, r - 1),
            SE: q % 2 == 0 ? this.getTile(q + 1, r + 1) : this.getTile(q + 1, r),
            S: this.getTile(q, r + 1),
            SW: q % 2 == 0 ? this.getTile(q - 1, r + 1) : this.getTile(q - 1, r),
            NW: q % 2 == 0 ? this.getTile(q - 1, r)   : this.getTile(q - 1, r - 1)
        };
    }

    getNeighborsCoord(q, r) {
        return {
            N: { q: q, r: r - 1 },
            NE: q % 2 === 0
                ? { q: q + 1, r: r }
                : { q: q + 1, r: r - 1 },
            SE: q % 2 === 0
                ? { q: q + 1, r: r + 1 }
                : { q: q + 1, r: r },
            S: { q: q, r: r + 1 },
            SW: q % 2 === 0
                ? { q: q - 1, r: r + 1 }
                : { q: q - 1, r: r },
            NW: q % 2 === 0
                ? { q: q - 1, r: r }
                : { q: q - 1, r: r - 1 }
        };
    }

    draw(ctx, f = 0) {
        for (const [key, tile] of this.grid) {
            if (tile  && tile.sprite) {
                let { q, r } = this.keyToCoord(key);
                let x = q * this.dx;
                let y = (q % 2 == 0 ? r + .5 : r) * this.dy;
                tile.sprite.draw(ctx, x, y, f);
            }
        }
    }

    setBoundaries(empty) {
        let NX = this.width, NY = this.height;
        if (this._borders.left) {
            for (let r = - 1; r < NY + 1; r++) {
                this.setTile(-1, r, empty);
            }
        }
        if (this._borders.right) {
            for (let r = - 1; r < NY + 1; r++) {
                this.setTile(NX, r, empty);
            }
        }
        if (this._borders.top) {
            for (let q = -1; q < NX + 1; q++) {
                this.setTile(q, -1, empty);
            }
        }
        if (this._borders.bottom) {
            for (let q = -1; q < NX + 1; q++) {
                this.setTile(q, NY, empty);
            }
        }
    }

    fill(tiles, R, r1 = 0, r2 = this.height) {
        const empty = tiles[0];
        const w0 = empty.weight;
        this.setBoundaries(empty);

        for (let r = r1; r < r2; r++) {
            let maxEmpty = this.width * 0.45;
            let emptyLeft = R.randomUniform(0, maxEmpty) | 0;
            let emptyRight = R.randomUniform(0, maxEmpty) | 0;

            for (let q_ = 0; q_ < this.width; q_++) {
                // Fill from right to left or left to right
                const q = this.reverseFill ? q_ : this.width - 1 - q_;
                const neighbours = this.getNeighborsTiles(q, r);

                if ( q < emptyLeft || q >= this.width - emptyRight ) {
                    empty.setWeight(100);
                } else {
                    empty.setWeight(w0);
                }

                let options = new Set(tiles.map((_, index) => index));
                Object.entries(neighbours).forEach(([dir, neighbour]) => {
                    if (neighbour) {
                        const dirOptions = neighbour.possibleNeighbours[oppositeDir(dir)];
                        options = options.intersection(dirOptions);
                    }
                });

                options = [...options];

                if (options.length == 0) {
                    // No valid tile can be placed here
                    return false;
                } 

                const W = options.map(i => tiles[i].weight);
                const tileIndex = R.randomPick(options, W);
                this.setTile(q, r, tiles[tileIndex]);
            }

            this.reverseFill = !this.reverseFill;
        }

        empty.setWeight(w0);
        this.setOffset();
        return true;
    }
    
    wfc(tiles, R, maxSteps = 10000) {
        this.setBoundaries(tiles[0]);
        const k2c = this.keyToCoord;
        const c2k = this.coordToKey;

        const wave = {};
        const borders = [];
        for (let r = -1; r <= this.height; r++) {
            for (let q = -1; q <= this.width; q++) {
                const tile = this.getTile(q, r);
                if (tile) {
                    const tileIndex = tiles.indexOf(tile);
                    wave[c2k(q, r)] = new Set([tileIndex]);
                    borders.push({q, r});
                } else {
                    wave[c2k(q, r)] = new Set(tiles.map((_, index) => index));
                }
            }
        }

        const propagate = (initialStack) => {
            const stack = initialStack.slice();
            while (stack.length > 0) {
                const {q, r} = stack.pop();
                const qrKey = c2k(q, r);
                const neighborsCoord = this.getNeighborsCoord(q, r);
                for (const dir in neighborsCoord) {
                    const {q: nq, r: nr} = neighborsCoord[dir];
                    const nqnrWave = wave[c2k(nq, nr)];
                    if (nq < -1 || nq > this.width || nr < -1 || nr > this.height) continue; // Out of bounds: skip
                    if (nqnrWave.size <= 1) continue; // Already collapsed or no options

                    let changed = false;
                    const tilesToCheck = [...nqnrWave];
                    for (const tileBIndex of tilesToCheck) {
                        let compatible = false;
                        for (const tileAIndex of wave[qrKey]) {
                            if (tiles[tileAIndex].possibleNeighbours[dir].has(tileBIndex)) {
                                compatible = true;
                                break;
                            }
                        }
                        if (!compatible) {
                            nqnrWave.delete(tileBIndex);
                            changed = true;
                        }
                    }
                    if (nqnrWave.size === 0) return false;
                    if (changed) stack.push({ q: nq, r: nr });
                }
            }
            return true;
        }

        propagate(borders);

        for (let step = 0; step < maxSteps; step++) {
            let minEntropy = Infinity, minCells = [];
            for (const key in wave) {
                if (wave[key].size <= 1) continue;
                const options = wave[key];
                if (options.size > 1 && options.size < minEntropy) {
                    minEntropy = options.size;
                    minCells = [key];
                } else if (options.size === minEntropy) {
                    minCells.push(key);
                }
            }

            if (minEntropy === Infinity) break; // All cells collapsed

            const key = R.randomPick(minCells);
            const options = Array.from(wave[key]);
            if (options.length === 0) {
                // Contradiction: no valid tiles for this cell
                return false;
            }
            const weights = options.map(i => tiles[i].weight);
            const chosenIndex = R.randomPick(options, weights);
            wave[key] = new Set([chosenIndex]);
            const ok = propagate([k2c(key)]);
            if (!ok) return false;
        }

        for (let r = 0; r < this.height; r++) {
            for (let q = 0; q < this.width; q++) {
                const options = Array.from(wave[c2k(q, r)]);
                const tile = tiles[options[0]] || tiles[0];
                this.setTile(q, r, tile);
            }
        }

        this.setOffset();
        return true;
    }

    addRows(rowsToAdd, hexTiles, R) {
        const oldHeight = this.height;
        this.height += rowsToAdd;
        this.setBoundaries(hexTiles[0]);
        this.fill(hexTiles, R, oldHeight, this.height);
    }

    update(tiles, R) {
        let NX = this.width, NY = this.height;
        for (let r = 0; r < NY - 1; r++) {
            for (let q = 0; q < NX; q++) {
                this.copyTile(q, r + 1, q, r);
            }
        }
        for (let q = 0; q < NX; q++) {
            this.removeTile(q, NY - 1);
        }
        this.fill(tiles, R, NY - 1, NY);
    }
}

export class HexagonalTile {
    constructor(sprite, edges) {
        this.sprite = sprite;
        this.edges = edges;  // {N,NE,SE,S,SW,NW}
        this.weight = 1;
        this.possibleNeighbours = {
            N: new Set(),
            NE: new Set(),
            SE: new Set(),
            S: new Set(),
            SW: new Set(),
            NW: new Set()
        };
    }

    isEmpty() {
        return this.sprite === false || this.sprite == null;
    }

    flippedVertically() {
        // Swap N <-> S, NE <-> SE, NW <-> SW and reverse edge strings
        const flippedEdges = {
            N: reverseString(this.edges.S),
            NE: reverseString(this.edges.SE),
            SE: reverseString(this.edges.NE),
            S: reverseString(this.edges.N),
            SW: reverseString(this.edges.NW),
            NW: reverseString(this.edges.SW)
        };
        let flippedSprite = this.sprite ? this.sprite.flippedVertically() : false;
        return new HexagonalTile(flippedSprite, flippedEdges);
    }

    setWeight(w) {
        this.weight = w;
    }

    adjustWeight(f) {
        this.weight *= f;
    }

    analyze(tiles) {
        tiles.forEach((tile, index) => {
            Object.keys(this.possibleNeighbours).forEach(dir => {
                if (compareEdge(this.edges[dir], tile.edges[oppositeDir(dir)]))
                    this.possibleNeighbours[dir].add(index);
            })
        })      
    }

    static async saveAnalysis(tiles) {
        const N = tiles.length;
        
        const analysisData = tiles.map(tile => {
            const neighbors = {};
            Object.keys(tile.possibleNeighbours).forEach(dir => {
                const neighborIndices = Array.from(tile.possibleNeighbours[dir])
                if (neighborIndices.length > 0) {
                    neighbors[dir] = encodeBitSet(neighborIndices, N);
                }
            });
            return neighbors;
        });
        
        return JSON.stringify({
            n: N,  // total number of tiles
            data: analysisData
        });
    }

    static async loadAnalysis(analysisData, tiles) {
        const data = JSON.parse(analysisData);   
        // Clear existing relationships
        tiles.forEach(tile => {
            Object.keys(tile.possibleNeighbours).forEach(dir => {
                tile.possibleNeighbours[dir].clear();
            });
        });
        // Bitset format
        data.data.forEach((neighbors, index) => {
            const tile = tiles[index];
            if (tile) {
                Object.entries(neighbors).forEach(([dir, bitsetData]) => {
                    const neighborIndices = decodeBitSet(bitsetData, data.n);
                    tile.possibleNeighbours[dir] = new Set(neighborIndices);
                });
            }
            });
    }
}

function oppositeDir(dir) {
    return dir.replace(/[NESW]/g, x => ({ N: 'S', E: 'W', S: 'N', W: 'E' })[x]);
}

function reverseString(s) {
  let arr = s.split("");
  arr = arr.reverse();
  return arr.join("");
}

function compareEdge(A, B){
    return A === reverseString(B);
}

function encodeBitSet(numbers, N) {
    const numBytes = Math.ceil(N / 8);
    const bytes = new Uint8Array(numBytes);
    
    numbers.forEach(num => {
        const byteIndex = Math.floor(num / 8);
        const bitIndex = num % 8;
        bytes[byteIndex] |= (1 << bitIndex);
    });
    
    return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

function decodeBitSet(hexString, N) {
    if (!hexString) return [];
    
    const numbers = [];
    const bytes = hexString.match(/.{2}/g) || [];
    
    bytes.forEach((hexByte, byteIndex) => {
        const byte = parseInt(hexByte, 16);
        for (let bitIndex = 0; bitIndex < 8; bitIndex++) {
            if (byte & (1 << bitIndex)) {
                const number = byteIndex * 8 + bitIndex;
                if (number < N) {
                    numbers.push(number);
                }
            }
        }
    });
    
    return numbers;
}