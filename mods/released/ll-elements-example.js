
exports.modinfo = {
    name: "ll-elements-example",
    version: "0.1.0",
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

    /** @type {(elementType: number, posX: number, posY: number, extraProperties?: object)=>Element} */
    newElementInstance;

    // ==== Custom added functions ====
    /**
     *  @type {(global, posX: number, posY: number, elementsToSpawn: ElementType[],
     *          area: [[minX:number, minY:number],[maxX:number, maxY:number]],
     *          opts?: {
     *              condition?: (posX: number, posY: number)=>boolean,
     *              spawner?: (posX: number, posY: number, elmType: number, idx: number)=>Element,
     *               weakBatching?: boolean,
     *              allowNonTouching?: boolean,
     *          }) => boolean}
    */
    trySpawnElementsAroundPos;
}

/**
 * @import {} from "./libloader"
 */

/**
 * @typedef {string} CellTypeIdent
 * @typedef {[number, number, number, number]} Rgba
 * @typedef {[number, number, number]} Hsl
 * @typedef {{type: number} | number} Cell
 * @typedef {{type: number, x: number, y: number}} Element
 * @typedef {{x:number, y:number}} Vec2
 * @typedef {{api: PhysicBinding, global, cell: Element}} PhysicCtx
 * @typedef {PhysicCtx & {otherCell: Element}} InteractionCtx
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

/**
 * @template {PhysicCtx} TCtx
 * @typedef {{key: CellTypeIdent, result: RecipeResult | (ctx:TCtx)=>RuntimeRecipeResult}} Recipe<TCtx>
 */
/**
 * @template {PhysicCtx} TCtx
 * @typedef {{key: CellTypeIdent, result: RuntimeRecipeResult | (ctx:TCtx)=>RuntimeRecipeResult}} RuntimeRecipe<TCtx>
 */

class CellTypeDefinition {
    /** @type {CellMetaType} */
    metaType; // CellMetaType
    /** @type {string} */
    id; // type identifier
    /** @type {number} */
    runtimeIdx = -1; // runtime index, propulated by loaders. Either cell type id or element type id, depending on metaType    
    /** @type {number | Hsl | Hsl[] | Rgba[] | (ctx:PhysicCtx)=>Rgba} */
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
    /** @type {{elementType: CellTypeIdent, chance: number}?} */
    soilOutput = undefined;
    /** @type {{fg: Rgba, bg: Rgba} | {fg: Hsl, bg: Hsl}} */ //todo: add patternSprite
    soilColorWithBackground = undefined;

    /** @type {boolean} */
    // Whether this soil can be broken by bouncers. If not, bouncers with proper upgrades will bounce off this soil
    soilBouncerBreakable = false;
    soilDamagableFunction = undefined; // todo

    soilIsFog = false;
    soilBackgroundElementType = undefined;
    soilFogUncoverFunc = undefined;

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
        console.log(result);
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
                return [elmTypes.BurntSlag]
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

        llElms.registerComplexInteractionRecipe({key: "Basalt", constraint: "BurntWetSlag", result: [{type: "Sandium", amount: [15, 20]}]});

        ct = new CellTypeDefinition();
        ct.id = "BurntWetSlagSoilFog"; 
        ct.metaType = "Soil";
        ct.hintInteractions = ["Fog!"];
        ct.soilHp = 1; // not sure why
        ct.soilBackgroundElementType = "BurntWetSlag";
        ct.soilIsFog = true;
        llElms.registerCellType(ct);
    }
}