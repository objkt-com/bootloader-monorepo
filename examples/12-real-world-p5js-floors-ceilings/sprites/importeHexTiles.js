import { Sprite, loadImage } from '../modules/sprite.js';
import { Canvas2D } from '../modules/canvas2d.js';
import { HexagonalTile } from '../modules/hexagonalGrid.js';
import { compress, loadCachedOrDecompress, saveUncompressed } from '../modules/gzip.js';

const w = 36, h = 30;
const url = `./sprites/spritesheet.png`;
const hexTiles = [
    { x:0,   y:0,   edges: { N:'BR', NE:'00', SE:'00', S:'00', SW:'00', NW:'00' } },
    { x:36,  y:0,   edges: { N:'00', NE:'YR', SE:'00', S:'00', SW:'00', NW:'00' } },
    { x:72,  y:0,   edges: { N:'00', NE:'00', SE:'YB', S:'00', SW:'00', NW:'00' } },
    { x:108, y:0,   edges: { N:'00', NE:'00', SE:'00', S:'RB', SW:'00', NW:'00' } },
    { x:144, y:0,   edges: { N:'00', NE:'00', SE:'00', S:'00', SW:'RY', NW:'00' } },
    { x:180, y:0,   edges: { N:'00', NE:'00', SE:'00', S:'00', SW:'00', NW:'BY' } },
    { x:216, y:0,   edges: { N:'BR', NE:'YR', SE:'00', S:'00', SW:'00', NW:'00' } },
    { x:252, y:0,   edges: { N:'00', NE:'YR', SE:'YB', S:'00', SW:'00', NW:'00' } },
    { x:288, y:0,   edges: { N:'00', NE:'00', SE:'YB', S:'RB', SW:'00', NW:'00' } },
    { x:324, y:0,   edges: { N:'00', NE:'00', SE:'00', S:'RB', SW:'RY', NW:'00' } },
    { x:360, y:0,   edges: { N:'00', NE:'00', SE:'00', S:'00', SW:'RY', NW:'BY' } },
    { x:396, y:0,   edges: { N:'BR', NE:'00', SE:'00', S:'00', SW:'00', NW:'BY' } },
    { x:432, y:0,   edges: { N:'BR', NE:'00', SE:'YB', S:'00', SW:'00', NW:'00' } },
    { x:468, y:0,   edges: { N:'00', NE:'YR', SE:'00', S:'RB', SW:'00', NW:'00' } },
    { x:504, y:0,   edges: { N:'00', NE:'00', SE:'YB', S:'00', SW:'RY', NW:'00' } },
    { x:540, y:0,   edges: { N:'00', NE:'00', SE:'00', S:'RB', SW:'00', NW:'BY' } },
    { x:576, y:0,   edges: { N:'BR', NE:'00', SE:'00', S:'00', SW:'RY', NW:'00' } },
    { x:612, y:0,   edges: { N:'00', NE:'YR', SE:'00', S:'00', SW:'00', NW:'BY' } },
    { x:0,   y:30,  edges: { N:'BR', NE:'YR', SE:'YB', S:'00', SW:'00', NW:'00' } },
    { x:36,  y:30,  edges: { N:'00', NE:'YR', SE:'YB', S:'RB', SW:'00', NW:'00' } },
    { x:72,  y:30,  edges: { N:'00', NE:'00', SE:'YB', S:'RB', SW:'RY', NW:'00' } },
    { x:108, y:30,  edges: { N:'00', NE:'00', SE:'00', S:'RB', SW:'RY', NW:'BY' } },
    { x:144, y:30,  edges: { N:'BR', NE:'00', SE:'00', S:'00', SW:'RY', NW:'BY' } },
    { x:180, y:30,  edges: { N:'BR', NE:'YR', SE:'00', S:'00', SW:'00', NW:'BY' } },
    { x:216, y:30,  edges: { N:'BR', NE:'YR', SE:'00', S:'RB', SW:'00', NW:'00' } },
    { x:252, y:30,  edges: { N:'00', NE:'YR', SE:'YB', S:'00', SW:'RY', NW:'00' } },
    { x:288, y:30,  edges: { N:'00', NE:'00', SE:'YB', S:'RB', SW:'00', NW:'BY' } },
    { x:324, y:30,  edges: { N:'BR', NE:'00', SE:'00', S:'RB', SW:'RY', NW:'00' } },
    { x:360, y:30,  edges: { N:'00', NE:'YR', SE:'00', S:'00', SW:'RY', NW:'BY' } },
    { x:396, y:30,  edges: { N:'BR', NE:'00', SE:'YB', S:'00', SW:'00', NW:'BY' } },
    { x:432, y:30,  edges: { N:'BR', NE:'00', SE:'00', S:'RB', SW:'00', NW:'BY' } },
    { x:468, y:30,  edges: { N:'BR', NE:'YR', SE:'00', S:'00', SW:'RY', NW:'00' } },
    { x:504, y:30,  edges: { N:'00', NE:'YR', SE:'YB', S:'00', SW:'00', NW:'BY' } },
    { x:540, y:30,  edges: { N:'BR', NE:'00', SE:'YB', S:'RB', SW:'00', NW:'00' } },
    { x:576, y:30,  edges: { N:'00', NE:'YR', SE:'00', S:'RB', SW:'RY', NW:'00' } },
    { x:612, y:30,  edges: { N:'00', NE:'00', SE:'YB', S:'00', SW:'RY', NW:'BY' } },
    { x:0,   y:60,  edges: { N:'BR', NE:'YR', SE:'00', S:'RB', SW:'RY', NW:'00' } },
    { x:36,  y:60,  edges: { N:'00', NE:'YR', SE:'YB', S:'00', SW:'RY', NW:'BY' } },
    { x:72,  y:60,  edges: { N:'BR', NE:'00', SE:'YB', S:'RB', SW:'00', NW:'BY' } },
    { x:108, y:60,  edges: { N:'BR', NE:'YR', SE:'00', S:'RB', SW:'RY', NW:'00' } },
    { x:144, y:60,  edges: { N:'BR', NE:'YR', SE:'00', S:'RB', SW:'RY', NW:'00' } },
    { x:180, y:60,  edges: { N:'00', NE:'YR', SE:'YB', S:'00', SW:'RY', NW:'BY' } },
    { x:216, y:60,  edges: { N:'00', NE:'YR', SE:'YB', S:'00', SW:'RY', NW:'BY' } },
    { x:252, y:60,  edges: { N:'BR', NE:'00', SE:'YB', S:'RB', SW:'00', NW:'BY' } },
    { x:288, y:60,  edges: { N:'BR', NE:'00', SE:'YB', S:'RB', SW:'00', NW:'BY' } },
    { x:324, y:60,  edges: { N:'BR', NE:'00', SE:'00', S:'RB', SW:'00', NW:'00' } },
    { x:360, y:60,  edges: { N:'00', NE:'YR', SE:'00', S:'00', SW:'RY', NW:'00' } },
    { x:396, y:60,  edges: { N:'00', NE:'00', SE:'YB', S:'00', SW:'00', NW:'BY' } },
    { x:432, y:60,  edges: { N:'00', NE:'YR', SE:'00', S:'RB', SW:'00', NW:'BY' } },
    { x:468, y:60,  edges: { N:'BR', NE:'00', SE:'YB', S:'00', SW:'RY', NW:'00' } },
    { x:0,   y:90,  edges: { N:'BR', NE:'YR', SE:'YB', S:'RB', SW:'00', NW:'00' } },
    { x:36,  y:90,  edges: { N:'00', NE:'YR', SE:'YB', S:'RB', SW:'RY', NW:'00' } },
    { x:72,  y:90,  edges: { N:'00', NE:'00', SE:'YB', S:'RB', SW:'RY', NW:'BY' } },
    { x:108, y:90,  edges: { N:'BR', NE:'00', SE:'00', S:'RB', SW:'RY', NW:'BY' } },
    { x:144, y:90,  edges: { N:'BR', NE:'YR', SE:'00', S:'00', SW:'RY', NW:'BY' } },
    { x:180, y:90,  edges: { N:'BR', NE:'YR', SE:'YB', S:'00', SW:'00', NW:'BY' } },
    { x:216, y:90,  edges: { N:'BR', NE:'YR', SE:'YB', S:'RB', SW:'00', NW:'00' } },
    { x:252, y:90,  edges: { N:'00', NE:'YR', SE:'YB', S:'RB', SW:'RY', NW:'00' } },
    { x:288, y:90,  edges: { N:'00', NE:'00', SE:'YB', S:'RB', SW:'RY', NW:'BY' } },
    { x:324, y:90,  edges: { N:'BR', NE:'00', SE:'00', S:'RB', SW:'RY', NW:'BY' } },
    { x:360, y:90,  edges: { N:'BR', NE:'YR', SE:'00', S:'00', SW:'RY', NW:'BY' } },
    { x:396, y:90,  edges: { N:'BR', NE:'YR', SE:'YB', S:'00', SW:'00', NW:'BY' } },
    { x:432, y:90,  edges: { N:'BR', NE:'YR', SE:'YB', S:'RB', SW:'00', NW:'00' } },
    { x:468, y:90,  edges: { N:'00', NE:'YR', SE:'YB', S:'RB', SW:'RY', NW:'00' } },
    { x:504, y:90,  edges: { N:'00', NE:'00', SE:'YB', S:'RB', SW:'RY', NW:'BY' } },
    { x:540, y:90,  edges: { N:'BR', NE:'00', SE:'00', S:'RB', SW:'RY', NW:'BY' } },
    { x:576, y:90,  edges: { N:'BR', NE:'YR', SE:'00', S:'00', SW:'RY', NW:'BY' } },
    { x:612, y:90,  edges: { N:'BR', NE:'YR', SE:'YB', S:'00', SW:'00', NW:'BY' } },
    { x:0,   y:120, edges: { N:'BR', NE:'YR', SE:'YB', S:'00', SW:'RY', NW:'00' } },
    { x:36,  y:120, edges: { N:'00', NE:'YR', SE:'YB', S:'RB', SW:'00', NW:'BY' } },
    { x:72,  y:120, edges: { N:'BR', NE:'00', SE:'YB', S:'RB', SW:'RY', NW:'00' } },
    { x:108, y:120, edges: { N:'00', NE:'YR', SE:'00', S:'RB', SW:'RY', NW:'BY' } },
    { x:144, y:120, edges: { N:'BR', NE:'00', SE:'YB', S:'00', SW:'RY', NW:'BY' } },
    { x:180, y:120, edges: { N:'BR', NE:'YR', SE:'00', S:'RB', SW:'00', NW:'BY' } },
    { x:216, y:120, edges: { N:'BR', NE:'YR', SE:'YB', S:'00', SW:'RY', NW:'00' } },
    { x:252, y:120, edges: { N:'BR', NE:'00', SE:'YB', S:'RB', SW:'RY', NW:'00' } },
    { x:288, y:120, edges: { N:'BR', NE:'00', SE:'YB', S:'00', SW:'RY', NW:'BY' } },
    { x:324, y:120, edges: { N:'BR', NE:'YR', SE:'YB', S:'00', SW:'RY', NW:'00' } },
    { x:360, y:120, edges: { N:'00', NE:'YR', SE:'YB', S:'RB', SW:'00', NW:'BY' } },
    { x:396, y:120, edges: { N:'BR', NE:'00', SE:'YB', S:'RB', SW:'RY', NW:'00' } },
    { x:432, y:120, edges: { N:'00', NE:'YR', SE:'00', S:'RB', SW:'RY', NW:'BY' } },
    { x:468, y:120, edges: { N:'BR', NE:'00', SE:'YB', S:'00', SW:'RY', NW:'BY' } },
    { x:504, y:120, edges: { N:'BR', NE:'YR', SE:'00', S:'RB', SW:'00', NW:'BY' } },
    { x:0,   y:150, edges: { N:'BR', NE:'YR', SE:'YB', S:'RB', SW:'RY', NW:'00' } },
    { x:36,  y:150, edges: { N:'00', NE:'YR', SE:'YB', S:'RB', SW:'RY', NW:'BY' } },
    { x:72,  y:150, edges: { N:'BR', NE:'00', SE:'YB', S:'RB', SW:'RY', NW:'BY' } },
    { x:108, y:150, edges: { N:'BR', NE:'YR', SE:'00', S:'RB', SW:'RY', NW:'BY' } },
    { x:144, y:150, edges: { N:'BR', NE:'YR', SE:'YB', S:'00', SW:'RY', NW:'BY' } },
    { x:180, y:150, edges: { N:'BR', NE:'YR', SE:'YB', S:'RB', SW:'00', NW:'BY' } },
    { x:216, y:150, edges: { N:'BR', NE:'YR', SE:'YB', S:'RB', SW:'RY', NW:'00' } },
    { x:252, y:150, edges: { N:'BR', NE:'00', SE:'YB', S:'RB', SW:'RY', NW:'BY' } },
    { x:288, y:150, edges: { N:'BR', NE:'YR', SE:'00', S:'RB', SW:'RY', NW:'BY' } },
    { x:324, y:150, edges: { N:'BR', NE:'YR', SE:'YB', S:'RB', SW:'00', NW:'BY' } },
    { x:360, y:150, edges: { N:'BR', NE:'YR', SE:'YB', S:'RB', SW:'RY', NW:'00' } },
    { x:396, y:150, edges: { N:'BR', NE:'00', SE:'YB', S:'RB', SW:'RY', NW:'BY' } },
    { x:432, y:150, edges: { N:'BR', NE:'YR', SE:'00', S:'RB', SW:'RY', NW:'BY' } },
    { x:468, y:150, edges: { N:'BR', NE:'YR', SE:'YB', S:'RB', SW:'00', NW:'BY' } },
    { x:0,   y:180, edges: { N:'BR', NE:'YR', SE:'YB', S:'RB', SW:'RY', NW:'BY' } },
    { x:36,  y:180, edges: { N:'BR', NE:'YR', SE:'YB', S:'RB', SW:'RY', NW:'BY' } },
    { x:72,  y:180, edges: { N:'BR', NE:'YR', SE:'YB', S:'RB', SW:'RY', NW:'BY' } },
    { x:108, y:180, edges: { N:'BR', NE:'YR', SE:'YB', S:'RB', SW:'RY', NW:'BY' } },
    { x:144, y:180, edges: { N:'BR', NE:'YR', SE:'YB', S:'RB', SW:'RY', NW:'BY' } },
    { x:180, y:180, edges: { N:'BR', NE:'YR', SE:'YB', S:'RB', SW:'RY', NW:'BY' } },
];

const compressedAnalysis = {
    v: 2.0,
    'bottom-up': 'H4sIAAAAAAAAE+2aIZPcMAyF/4vxAtmyIyW89EhBQafAli1YVHZz/72zd7xbsOdTHHHPTl6i9+lJ3tfwOxwR8i30+qeG4+dreAlHoC5KJUmpLIggGTmmBAAQbuHlWzhC00FY45a6YBTeaiwcY87vJ77fT3QljF0abwTQBAtwBk4J0v1EOMLQtvPYSkEWLltE3ipkiB8/8SMcQamIUMO0C0pCAIHCNQLE+2PcT1BrY2DnPRNsJTJvmHJhBghvt4laIuSN4l6rEFLdh9BetOlQNaclActImGln1YxSlZpS79qtfZcMkaWMvSeUgbSXUWmM1j5eqqUa44TAtWMthCKKTWj0rvr+pO6Xz9HCOccoibbGutdBtEtvlUjVmhbgishZ+oaCXVRRK5WhOqx53wzHHnvfCscee9855t7/h/etaHns/Ukce4JfJnHsGX6xwrHT5LH/8IsRjpnp+1P8MoljT/CLGY5ZyWPPyDBWOHaaPLYSx1bKMFY4NimPTckwPld+gvencMxMjXmG+QomT5nFVqoxM5l/CpMn1ZiVzD+FyWYyv5HdhRWOTWLyafLYSt63ksdO1Cut1NhKWlbyy0paruX9lbQYmSutZH7PYzZ75YnuLKzsYabcWZiZxXxvedZZzO8svkLLFO+byWPOMeeYc8w55hxzjjnHnGPOsQv8r8/KjGxmD7PS7sLITsnKrm8Sx4zcJTnHbN6/nGc3fq2+b6bGvFd6r7yK91fqlafZXazEsfP0/Wv55Tx930yNOcdscsy9735xv7hf3C9L+eVa38W1uBbX8hwtv97+Aq13P+TyUgAA',
    'top-down': 'H4sIAAAAAAAAE+2ZsW4kIQyG34V6C4Nh7Nn+2jQprohSgMHlVddFeffTZh9gdNJqZDP0aLW/PN9nY77Cn3CPkG+h17813D++wlu4h6Ft57GVgixctoi8VcgQAcItvP0K99CVMHZpvBFAEyzAGTglSOEW3h8nmg7CGrfUBaPwVmPhGHP++Y33cA/URakkKZUFESQjx5QAngd+P060NgZ23jPBViLzhikX5uffeJxQKiLUMO2CkhBAoHCNADF8355ZIuSN4l6rEFLdh9BetOlQ9ZfluC4JWEbCTDurZpSq1JR61+4vy3FdMkSWMvaeUAbSXkalMVr7qa2zLId14YTAtWMthCKKTWj0rvoM6yvLcV045xgl0dZY9zqIdumtEj2x9ZXluC7AFZGz9A0Fu6iiVipDdfyHx2Zi/zjLTOwfZpmJ/eMsM7F/nOUl7M/ksZn6/guc7Ij9F9TFD/uvqIsf9k+qi5EZ5qR5bCaPzTTDvCDLTB6baYY5Kcu1POZnhjnFyWbYP8XJVtg34+RT2Dfj5FNmGD/fmB8nm/GYkTnZCi+OeqUfJxvZXVhh30xdjMxjM7F/sW9spiwz8TJTlmuxf60sM+0u/Mz8fu6VRuZkM7xY2Y+d8v7iiP2Z3ixOyeKnv/i5V5qZx2baKS2PLY8tjy2PLY8tjy2PLY8tj7n3mJk9jBEnW9ldmHGykTcLK3Vx5DE/uz4/HpuJ/cWLzW9s9UqbvKxeOS/7l+qVjniZ6b7vJ8tMHjPS961kWR6zOSc74uVS7C9eFi+Ll8XL/HVZWVaWleWsLJ/f/wDTo+7t8lIAAA==',
    'dual-perspective': 'H4sIAAAAAAAAE+2du5LbOBBF/4XxBHgRD+WbOnHgYMsBnuFGm7n871uwZEdLe1SwxW72VcqixDlq3nsASTVftn+2m1HhbWv537zd/v6yfdhuWx8lxe733cYad69t9Fk5pZUqvQebtTetep2iz9oprZVSanvbPvy13bY2gtWtluiDUqXaXUWnojHK3I/EkrzXqs8juX47Ms/9OM8t48ezW13ns+9Ra+eU+n5FzpY4r8hEZ5TTWul57nbbQqsj7KbuOVZrVXU26vnUSo2w1xqKMan6aqzS1e7RPC7546d5bim92xaTC8rvOkZvjdtjVCqUPI+k5Lz2eh5RjyPzz53nPp7dmlTtfHZV1R6zVkrb1kbQvrpcojXzilIyZv4x29e3O2etnA865VyDDTn1GtI+yuhjOK1j3XtqxqbuQ9p7Gb2PEQY4P895ZZ6NirUb60KKYzhb8whlhNZGU4cPcH5tbjj1426p3c67JYfeSxnj5+8ROL8sN6KxKuZm8x5srcOWGnprY4yhYrY2uta8TbbV0W3NoT2iDpxfmBvROa2rCb7EkXIPIdVWcgi/uI3A+YW58bhbavO2zrtl2JHD3sfoP3mPfodvoAfp+wZ6kLxvoAfp+wZ6kL5vnNaDDDmz9A2sB+n7BtaD5H0D60H6viEunxn6hrR8FucbWHfTn2esu8n7Btbd9H0D6276vsGyB+Eb5DmL60GGXieuBxl6nbQeFOd1DHuQpW8w3BdFbtD3DWleJ843GHody3kW5nUs5xleR36dIs7rMM/0cwPzjB6k5hvIjdf8fhCckc/U8hmc0YMHnMX1IDjT58xwX5RlD2Jf9NL7G6flBsN5Rj7Tn2dx60GGvsGyB/G9XPI9iO/l0vdnlpyF+TNLztL8mSFn+AZ9zvAN+pzhGxfnDN+gzxm+QZ4zfIM+Z/gGfc7wjYtzhm/Q5wzfuDRnlj3I0DdYzrMw32A5z/AN8vMM36A/zyzzGb5B//8uSetBhpyRz8gNcl6HdQr53GCZz1in0M9n9CD9HsQ6hbxvIJ+vzVlaPovjzDCfxXGGb5DnDN+gzxn7dfQ5s5xn9OClcwP5TD83kM/Ijf9lhXy+fG4gn5Eb4AzO4AzO4AzOl+Us7P9psvyd5grn4xH4foeV6sK8w1oobcyL6Sf/Dug0zses7okSnE+pDz0TZbczUe6DdeLv2k7jzPB3miw5M8zn034/ePioxqjYky27C7XNxvC+tVLCkMr5mFV0+zQR70vqqU8TGd9M5H77sp3nhR4U5xsrPbjAmWU+r/TgCmeG+QzfQA9S43zM6tc9KI3zSg+ucGbZg9L2N87K5+P36Jq+wXCeWfagMN9gmc8Me1Cc152Uzyzn+fii/+i6W5xvnMSZpW9gfwO+Qcw3ljgL8w1xnI8v+o/24Apnaetulr7B0OvE9eAKZ4Y9yDI3sO4m34PivO74hcnu869wRm4w4MwwN8Tl80puLHAW5xsrnBn6Bst8PmmexeUGw3XKEmeG84wefGKeFziLm+cVztL8GblBf78OnN/PGfn8eFx0H0kaZ/Tguzlj3X1xzgz3RVl+Dov9jceDcA8y3N9gmRsnzfNpnBnOM8t1CsPv5bLsQYacWfYgQ38Wtx5k6M+ncWboz+I4H78w2R5c4SytB+Ebr+EM33iCM3wDvkGtB+Ebr+F8/MJke3CFs7QehG+8hjN84wnO8A34BrUehG+8hvPxC5PtwRXOLD+3OomzuB5c4Mzyc1iGviFunoV9r2CJs7DvFZzGmeE8wzeemOeTOLPM5xXO0noQ+fx4XLQHj89FbmCdgnXKlecZ65T3c0YPvoYzw3lmuU5h2IPi8vkkzizzWZhvsOQsLJ+XOAtbD57GmWE+wzfocxbnG+hB9CA1zscvTDY3Vjgjn5HPyGfkMxvOxy9MNjdWOCOfMc/gDM7gDM7gDM40OX/++h9gCWtoKiMBAA==',
};

const VALID_TILESET_TYPES = new Set(['top-down', 'bottom-up', 'dual-perspective']);

export async function getTileset(type = 'top-down', verbose = false) {
    if (!VALID_TILESET_TYPES.has(type)) {
        console.warn(`Unknown tileset type "${type}", falling back to top-down`);
        type = 'top-down';
    }

    let tiles = await importHexTiles();
    const empty = new HexagonalTile(false,{ N:'00', NE:'00', SE:'00', S:'00', SW:'00', NW:'00'});
    
    if (type == 'top-down') {
        tiles = [empty, ...tiles];
    } else {
        const flippedTiles = tiles.map(t => t.flippedVertically())
        if (type == 'bottom-up') {
            tiles = [empty, ...flippedTiles];
        } else if (type == 'dual-perspective') {
            tiles = [empty, ...tiles, ...flippedTiles];
        }
    }

    tiles.tileWidth = w;
    tiles.tileHeight = h;
    tiles.dx = h;
    tiles.dy = h;

    const key = `analysis-${type}`;

    try {
        const jsonString = await loadCachedOrDecompress({
            key,
            version: compressedAnalysis.v,
            compressed: compressedAnalysis[type] || null
        }, verbose);

        if (jsonString) {
            await HexagonalTile.loadAnalysis(jsonString, tiles);
            return tiles;
        }
    } catch (e) {
        console.warn(`Analysis load failed (${type}):`, e);
    }

    // Fallback: compute and cache
    tiles.forEach(t => { t.analyze(tiles) });
    const analysis = await HexagonalTile.saveAnalysis(tiles);
    saveUncompressed({
        key,
        version: compressedAnalysis.v,
        jsonString: analysis
    });

    if (verbose) {
        console.log(`Compressed analysis for ${type}`);
        const compressed = await compress(analysis);
        console.log(compressed);
    }

    return tiles;
}

export async function importHexTiles() {
    const spritesheet = await loadImage(url);
    let tiles = hexTiles.map(t => {
        const C = new Canvas2D(w, h);
        C.ctx.drawImage(spritesheet, t.x, t.y, w, h, 0, 0, w, h);
        const sprite = new Sprite(C.canvas, w, h);
        return new HexagonalTile(sprite, t.edges);
    })
    return tiles;
}