
exports.modinfo = {
    name: "ll-elements-example",
    version: "0.3.0",
    dependencies: [],
    modauthor: "TomTheFurry",
};

// ==== Headers / Class Defs ====
// #region Headers / Class Defs

class PhysicBinding {
    /** @type {(global, posX: number, posY: number, value: Cell)=>void} */
    setCell;
    /** @type {(global, posOrElement: {x: number, y: number})=>void} */
    clearCell;
    /** @type {(global, elm: Element, posX: number, posY: number)=>void} */
    setElementToPos; // doesn't check for what's there in the target pos
    /** @type {(global, elmA: Element, elmB: Element)=>void} */
    swapTwoElementPosition;
    /** @type {(global, elm: Element, velocity: {x: number, y: number})=>Particle} */
    launchElementAsParticle;

    /** @type {(cell: Cell)=>boolean} */
    cellIsSolidSoil; // note that fog soils are not solid, but they are soil types
    /** @type {(cell: Cell)=>boolean} */
    cellIsSoilType; // note that fog soils are not solid, but they are soil types
    /** @type {(cell: Cell)=>boolean} */
    cellIsElement;

    /** @type {(cell: Cell, elementTypes: number|number[])=>boolean} */
    cellIsElementTypeOf;
    /** @type {(cell: Cell, cellType: number)=>boolean} */
    cellIsType;
    /** @type {(cell: Cell, cellTypes: number|number[])=>boolean} */
    cellIsTypeOf;
    /** @type {(cell: Cell)=>boolean} */
    cellIsEmpty;

    /** @type {(cell: Cell, elementTypes: number|number[])=>boolean} */
    cellIsEmptyOrElementTypeOf;

    /** @type {(global, posX: number, posY: number)=>boolean} */
    isCellAtPosEmpty;
    /** @type {(global, element: Element, targetPosX: number, targetPosY: number, expectToSwapWith?: Element)=>void} */
    moveOrSwapElementToPos;
    /** @type {(global, posX: number, posY: number, opts?: {defer: boolean})=>void} */
    markChunkActive;

    /** @type {(global, targetPosX: number, targetPosY: number)=>number} */
    getElementTypeAtPos;
    /** @type {(global, targetPosX: number, targetPosY: number)=>Cell} */
    getCellAtPos;

    /** @type {(store, targetPosX: number, targetPosY: number)=>Cell} */
    getCellAtPosFromStore;

    /** @type {(elementType: number, posX: number, posY: number, extraProperties?: object)=>Element} */
    newElementInstance;

    // ==== Custom added functions ====
    /**
     *  @type {(global, posX: number, posY: number, elementsToSpawn: ElementType[],
     *          area: [[minX:number, minY:number],[maxX:number, maxY:number]],
     *          opts?: {
     *              condition?: (posX: number, posY: number)=>boolean?,
     *              spawner?: (posX: number, posY: number, elmType: number, idx: number)=>Element?,
     *               weakBatching?: boolean,
     *              allowNonTouching?: boolean,
     *          }) => boolean}
    */
    trySpawnElementsAroundPos;

    /**
     *  @type {(global, posX: number, posY: number, cellsToSpawn: number[],
     *          area: [[minX:number, minY:number],[maxX:number, maxY:number]],
     *          opts?: {
     *              condition?: (posX: number, posY: number)=>boolean?,
     *              spawner?: (posX: number, posY: number, cellType: number, idx: number)=>Cell?,
     *               weakBatching?: boolean,
     *              allowNonTouching?: boolean,
     *          }) => boolean}
    */
    trySpawnCellsAroundPos;

    /**
     *  @type {(posX: number, posY: number, count: number,
     *          area: [[minX:number, minY:number],[maxX:number, maxY:number]],
     *          condition: (posX: number, posY: number)=>boolean?,
     *          action: (posX: number, posY: number, idx: number)=>void,
     *          opts?: {
     *               weakBatching?: boolean,
     *               allowNonTouching?: boolean,
     *          }) => boolean}
    */
    tryAroundPos;
}

/**
 * @import {} from "./libloader"
 */

/**
 * @typedef {string} CellTypeIdent
 * @typedef {[number, number, number, number]} Rgba
 * @typedef {[number, number, number]} Hsl
 * @typedef {Element | DamagedSoil | number} Cell
 * @typedef {{cellType: number, hp: number}} DamagedSoil
 * @typedef {{
 *  type: number,
 *  x: number,
 *  y: number,
 *  velocity: {x: number, y: number},
 *  minVelocity: {x: number, y: number},
 *  data: object?,
 *  density: number,
 *  threshold: {x: number, y: number},
 *  isFreeFalling: boolean,
 *  duration: {max: number | -1, left: number},
 * }} Element
 * @typedef {{element: Element} & Element} Particle
 * @typedef {{x:number, y:number}} Vec2
 * @typedef {{api: PhysicBinding, global}} GameCtx
 * @typedef {GameCtx & {cell: Element}} ElementCtx
 * @typedef {ElementCtx & {otherCell: Element}} InteractionCtx
 * @typedef {GameCtx & {cell: Cell, x: number, y: number}} CellCtx
 * @typedef {CellTypeIdent | {type: CellTypeIdent, amount: (Number | [Number, Number])}} RecipeResultEntry
 * @typedef {(RecipeResultEntry | RecipeResultEntry[])} RecipeResult
 * @typedef {number | {type: number, amount: (Number | [Number, Number])}} RuntimeRecipeResultEntry
 * @typedef {RuntimeRecipeResultEntry[]} RuntimeRecipeResult
 */

/**
 * @typedef {"Soil" | "Element" | "Particle"} CellMetaType
 */
/** @type {CellMetaType[]} */
const CellMetaTypes = ["Soil", "Element", "Particle"]

/**
 * @typedef {"Solid" | "Liquid" | "Particle" | "Gas" | "Static" | "Slushy" | "Wisp"} MatterType
 * @type {MatterType[]}
 */
const MatterTypes = ["Solid", "Liquid", "Particle", "Gas", "Static", "Slushy", "Wisp"]

/** @template {GameCtx} TCtx @typedef {(ctx:TCtx)=>(RuntimeRecipeResult|boolean)} RuntimeRecipeCallback<TCtx> */
/** @template {GameCtx} TCtx @typedef {(ctx:TCtx)=>boolean|void} Event<TCtx> */
/** @template {GameCtx} TCtx @typedef {{key: CellTypeIdent, result: RecipeResult | (ctx:TCtx)=>(RuntimeRecipeResult|boolean)}} Recipe<TCtx> */
/** @template {GameCtx} TCtx @typedef {{key: CellTypeIdent, result: RuntimeRecipeResult | (ctx:TCtx)=>RuntimeRecipeResult}} RuntimeRecipe<TCtx> */

class CellTypeDefinition {
    /** @type {CellMetaType} */
    metaType; // CellMetaType
    /** @type {string} */
    id; // type identifier
    /** @type {number} */
    runtimeIdx = -1; // runtime index, propulated by loaders. Either cell type id or element type id, depending on metaType    
    /** @type {number | Hsl | Hsl[] | Rgba[] | (ctx:ElementCtx)=>Rgba} */
    //pixelColors = [[255, 0, 0, 255]]; // pixel colors, mapped by varients
    /** @type {string?} */
    displayName; // display name. If null, use id

    /** @type {string[]} */
    hintInteractions = [""]; // hint interactions

    /** @type {number?} */
    soilHp = undefined;
    // For non-fog soils colors, either of following must be defined:
    // - soilColorHsl: Directly defining the soil color in hsl,
    //       which makes a soil with the foreground color
    // - soilOutput: if none above is defined, the soil will use the output element's
    //       base hue (the element hue hint) to generate the soil color
    // hsl color, or the hue color, or, if soil output is defined, can be null
    /** @type {Hsl?} */
    soilColorHsl = undefined;
    // Soil Output: This is for vanilla on dug handling and what can be done is more limited.
    // If you want complex stuff, register soilOnDug recipes instead to have more control.
    /** @type {{elementType: CellTypeIdent, chance: number}?} */
    soilOutput = undefined;
    /** @type {{fg: Rgba, bg: Rgba} | {fg: Hsl, bg: Hsl}} */ //todo: add patternSprite
    soilColorWithBackground = undefined;

    /** @type {boolean} */
    // Whether this soil can be broken by bouncers. If not, bouncers with proper upgrades will bounce off this soil
    soilBouncerBreakable = false; // todo

    soilIsFog = false;
    soilFogPreventTriggerUncover = false;
    // This is the element type that this soil will output when unfog.
    // If you want more complex control on unfog, use the soilOnUnfog recipe instead
    /** @type {CellTypeIdent?} */
    soilFogBackgroundElementType = undefined;

    /** @type {(cell: Element, elmColorMap: {[ElmId: number]: ([Rgba] | [Rgba, Rgba, Rgba, Rgba])})=>Rgba} */
    elementColorVarientSelectionFunction = undefined;

    /** @type {Hsl | [Hsl, Hsl, Hsl, Hsl] | Rgba | [Rgba, Rgba, Rgba, Rgba] | null} */
    // the color(s) of the element, optionally with up to 4 varients
    // Note: Hsl is [H, S, L] where H is 0-360, S is 0-100, L is 0-100
    elementColor = undefined;

    /** @type {number | null} */
    // hue color.
    // You may optionally define this if you want soil that output this element to get atuomatically colored
    // This can be different from the elementColor, and will be used to generate the elementColor if it is null
    // If not defined, lib will attempt to find a hue from the elementColor to be this element's hue
    // for use when other stuff wants to know the hue of this element
    elementHueHint = undefined;

    /** @type {number} */
    elementDensity = 150;
    /** @type {MatterType} */
    elementMatterState = "Solid";
    /** @type {number?} */
    elementLifeDuration = undefined;

    /** @type {Event<ElementCtx>?} */
    // If defined, this function will be called when the element's 'duration' countdown is done
    // Return false to cancel the element's duration end event letting it tick normally,
    // Return true to complete duration end event skipping usual actions (normally deleting the element),
    // or return nothing to continue the end event with usual actions (like deleting the element)
    elementDurationEndEvent = undefined;
    /** @type {(()=>{data: any})?} */
    elementGetExtraProps = undefined;
    /** @type {boolean} */
    elementCanBeSelectedInFilter = false;

    /** @param {number} hue @param {number?} sat @param {number?} val @returns {[Hsl, Hsl, Hsl, Hsl]} */
    static MakeDefaultColorVarients(hue, sat, val) {
        sat ??= 60; // based on vu_makeBaseSoilColorVarientsByHue
        val ??= 63; // based on vu_makeBaseSoilColorVarientsByHue
        var cmp = (v) => v < 0 ? 0 : v > 100 ? 100 : v;
        var result = [
            [hue, cmp(sat-6), cmp(val-1)],
            [hue, cmp(sat-1), cmp(val-2)],
            [hue, cmp(sat+2), cmp(val+1)],
            [hue, cmp(sat+8), cmp(val+4)]
        ];
        return result;
    }
}

// #endregion Headers / Class Defs

// === Actual using the stuff ===

/** @type {LibLoaderEvents} */
exports.LibLoaderEvents = {
    // ran after all apiInit is done, and all basic mod info is available
    modInit(libloader) {
        /** @type {LibElementsApi} */
        var llElms = libloader.TryGetApi("LibElementsApi");
        var ct = new CellTypeDefinition();
        ct.id = "BurntWetSlag";
        ct.metaType = "Element";
        ct.elementColor = CellTypeDefinition.MakeDefaultColorVarients(200, 25, 50);
        ct.hintInteractions = ["Hey mom I'm here!"];
        ct.elementDensity = 50;
        ct.elementMatterState = "Solid";
        ct.elementGetExtraProps = function () {
            return { data: { counter: 5 } };
        }
        llElms.registerCellType(ct);

        var ct = new CellTypeDefinition();
        ct.id = "BurntWetSlagWater";
        ct.displayName = "Burnt Wet Slag Water";
        ct.metaType = "Element";
        ct.elementColor = CellTypeDefinition.MakeDefaultColorVarients(185, 25, 20);
        ct.hintInteractions = ["Burnt Wet Slag Water"];
        ct.elementDensity = 200;
        ct.elementMatterState = "Liquid";
        ct.elementGetExtraProps = function () {
            return { data: { counter: 5 } };
        }
        llElms.registerCellType(ct);

        var ct = new CellTypeDefinition();
        ct.id = "BurntWetSlagGas";
        ct.displayName = "Burnt Wet Slag Gas";
        ct.metaType = "Element";
        ct.elementColor = CellTypeDefinition.MakeDefaultColorVarients(195, 25, 80);
        ct.hintInteractions = ["Burnt Wet Slag Gas"];
        ct.elementDensity = 20;
        ct.elementMatterState = "Gas";
        ct.elementGetExtraProps = function () {
            return { data: { counter: 5 } };
        }
        llElms.registerCellType(ct);

        var ct = new CellTypeDefinition();
        ct.id = "BurntWetSlagSlush";
        ct.displayName = "Burnt Wet Slag Slush";
        ct.metaType = "Element";
        ct.elementColor = CellTypeDefinition.MakeDefaultColorVarients(190, 15, 10);
        ct.hintInteractions = ["Burnt Wet Slag Slush"];
        ct.elementDensity = 150;
        ct.elementMatterState = "Slushy";
        ct.elementGetExtraProps = function () {
            return { data: { counter: 5 } };
        }
        
        llElms.registerCellType(ct);
        var ct = new CellTypeDefinition();
        ct.id = "BurntWetSlagWisp";
        ct.displayName = "Burnt Wet Slag Wisp";
        ct.metaType = "Element";
        ct.elementColor = CellTypeDefinition.MakeDefaultColorVarients(195, 45, 90);
        ct.hintInteractions = ["Burnt Wet Slag Wisp"];
        ct.elementDensity = 10;
        ct.elementMatterState = "Wisp";
        ct.elementGetExtraProps = function () {
            return { data: { counter: 5 } };
        }
        llElms.registerCellType(ct);


        var ct = new CellTypeDefinition();
        ct.id = "BurnTest";
        ct.displayName = "Burn Test";
        ct.metaType = "Element";
        ct.elementColor = CellTypeDefinition.MakeDefaultColorVarients(159, 25, 50);
        ct.hintInteractions = ["Burn Test"];
        ct.elementDensity = 50;
        ct.elementMatterState = "Solid";
        ct.elementGetExtraProps = function () {
            return { data: { counter: 5 } };
        }
        llElms.registerCellType(ct);

        llElms.registerBurnableRecipe({key: "BurntWetSlag", result: "BurntSlag"})
        llElms.registerBurnableRecipe({key: "BurnTest", result: [
            {type: "Gold", amount: [2, 8]},
            {type: "Sandium", amount: 0.8}]});
        
        llElms.registerBurnableRecipe({key: "BurntSlag", result: (ctx) => {
            var api = ctx.api;
            var cellTypes = globalThis.Hook_CellType;
            var elm = ctx.cell;
            //api.setCell(ctx.global, elm.x, elm.y, cellTypes.BurntWetSlagSoil);
            var elmTypes = globalThis.Hook_ElementType;
            var fires = [];
            var count = 10 + Math.floor(Math.random() * 30);
            for (var i = 0; i < count; i++) {
                fires.push(elmTypes.Fire);
            }
            api.trySpawnElementsAroundPos(ctx.global, elm.x, elm.y, fires, [elm.x-5, elm.y-2, elm.x+5, elm.y+8],
                {
                    spawner: (x, y, et) => {
                        var elm = api.newElementInstance(et, x, y);
                        var dx = x-elm.x;
                        var dy = y-elm.y;
                        var len = Math.sqrt(dx * dx + dy * dy);
                        dx /= len;
                        dy /= len;
                        dy += 0.5; // so it bias upwards
                        var vel = Math.random() * 100 + 10;
                        elm.velocity.x = dx * vel;
                        elm.velocity.y = dy * vel;
                        return elm;
                    },
                    allowNonTouching: false,
                    weakBatching: true,
                }
            )
            if (Math.random() < 0.9) {
                return [-elmTypes.BurntSlag] // negative as this is an element, not soil
            };
            return []
        }});

        ct = new CellTypeDefinition();
        ct.id = "BurntWetSlagSoil";
        ct.metaType = "Soil";
        ct.hintInteractions = ["Break me!"];
        ct.soilOutput = { elementType: "BurntWetSlag", chance: 1 };
        ct.soilHp = 1;
        llElms.registerCellType(ct);
        llElms.registerBasicInteractionRecipe("Water", "BurntSlag", "BurntWetSlag");
        llElms.registerKineticRecipe({key: "BurntWetSlag", result: ["Sandium", "Gold"]})

        llElms.registerBasicInteractionRecipe("WetSand", "Basalt", "Sandium");
        llElms.registerBasicInteractionRecipe("Sandium", "Water", "Basalt");

        llElms.registerBasicInteractionRecipe("Water", "BurntWetSlagWater", "BurntWetSlagSlush");
        llElms.registerBasicInteractionRecipe("Slag", "BurntWetSlagSlush", "BurntWetSlagGas");
        llElms.registerBasicInteractionRecipe("Steam", "BurntWetSlagGas", "BurntWetSlagWisp");
        llElms.registerBasicInteractionRecipe("Petalium", "BurntWetSlagWisp", "BurntWetSlagWater");


        llElms.registerComplexInteractionRecipe({key: "Basalt", constraint: "BurntWetSlag", result: [{type: "SandSoil", amount: [15, 20]}]});

        ct = new CellTypeDefinition();
        ct.id = "BurntWetSlagSoilFog"; 
        ct.metaType = "Soil";
        ct.hintInteractions = ["Fog!"];
        ct.soilHp = 1; // not sure why
        ct.soilBackgroundElementType = "BurntWetSlag";
        ct.soilIsFog = true;
        llElms.registerCellType(ct);

        ct = new CellTypeDefinition();
        ct.id = "BurntWetSlagJumpy";
        ct.metaType = "Element";
        ct.hintInteractions = ["Jump!"];
        ct.elementColor = CellTypeDefinition.MakeDefaultColorVarients(200, 80, 50);
        ct.elementDensity = 100;
        ct.elementMatterState = "Solid";
        ct.elementLifeDuration = 1; // 1 second
        ct.elementDurationEndEvent = function (ctx) {
            var api = ctx.api;
            var elm = ctx.cell;
            elm.duration.left = (Math.random() * 0.5 + 0.75) * elm.duration.max; // reset the duration
            elm.density = Math.random() * 200 + 10;
            var founds = 0;
            for (var oy = 0; oy > -8; oy--) {
                if (api.isCellAtPosEmpty(ctx.global, elm.x-1, elm.y+oy) &&
                    api.isCellAtPosEmpty(ctx.global, elm.x, elm.y+oy) &&
                    api.isCellAtPosEmpty(ctx.global, elm.x+1, elm.y+oy)) {
                    founds++;
                    if (founds >= 3) {
                        oy += 1;
                        break;
                    }
                }
                else {
                    founds = 0;
                }
            }
            //if (founds < 3) {
                api.setCell(ctx.global, elm.x, elm.y, elm); // update the element
                return true; // handled the event
            //}
            //api.clearCell(ctx.global, elm);
            //elm.y += oy;
            //api.launchElementAsParticle(ctx.global, elm, {x: (Math.random()-0.5)*50, y: -50 + Math.random()*-50});
            return true; // handled the event

            // if (api.trySpawnElementsAroundPos(ctx.global, elm.x, elm.y-10, [elm.type],
            //     [elm.x-1, elm.y-10, elm.x+1, elm.y-8], {allowNonTouching: true})) {
            //     api.clearCell(ctx.global, elm);
            //     return true; // handled the event
            // }
            // else {
            //     elm.duration.left = elm.duration.max; // reset the duration
            //     return false; // cancel the event, let the ticking happen
            // }
        }
        llElms.registerCellType(ct);
    }
}