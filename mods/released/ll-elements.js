
exports.modinfo = {
    name: "ll-elements",
    version: "0.3.1",
    dependencies: [],
    modauthor: "TomTheFurry",
};

// v.2 updates:
// - Addexd color conflict resolution
//   No longer need to worry about color value conflicts with adding stuff!
//   The lib will now auto-nudge the color values for the conflicting elements/soils
// - Added Save Data Enhancement
//   This additional data will be used to help the game load the save data correctly
//   even if the mod list is changed and ids got shuffled around. Yes, this mean saves
//   are much more resilient to mod changes, including removals and reorders of mods!
// - Added Patch Color Overflow
//   The game engine has an issue where color ids are maxed out at 255, and since each
//   soil type contains roughly 11 color ids, this would mean that game runs out of ids
//   really quickly, and will cause corruptions and etc. This patch fixes the issue by
//   increasing the color id space to a 16 bit space, which is 65536 ids. This means
//   you can now add more than just 3 to 4 soil types now!
// - Added hook: launchElementAsParticle(...) - Launch an element as a particle
// - Bug fixes:
//   - Fixed physics-crash on vanilla burnable soils getting burned
//   - Fixed physics-crash on vanilla fog discovery
// v.2.1 updates:
// - Made fogs uncoverable by default, but can be changed to vanilla behavior
// - Fixed incorrect handling of the various callback results in phyiscs crafting
// v.2.2 hotfix:
// - Add missing patch to handle vanilla bug with damagable soil colors
// v.3 updates:
// - Added shaker recipes via `registerShakerRecipe(...)`
// - Added ability to add stuff into shaker filter via `registerShakerFilterAllow(...)`
// - Updated how basic interaction recipes works, such that it can output soil types
// - Updated all recipes to support soil type outputs as well, as element type output
//   is denoted by being negative
// - Added soil on dug recipes via `registerSoilDugRecipe(...)`
// - fixed binding `getCellAtPos` to accept the `global` instead of `store`
// - added binding `trySpawnCellsAroundPos` that supports both soils and elements
// - added binding `tryAroundPos` for your custom logic for scnaning around a position
// - impl refactor, to make callbacks handling more uniform
// v.3.1 Bugfix:
// - Fixed incorrect vanilla burn result spawning soils instead of elements
// - Fixed save id remapping to handle damaged soils correctly

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

// ==== Implementation ====
// #region Implementation

const BaseEndOfCellId = 31 + 5; // 5 as buffer
const BaseEndOfElementId = 21 + 5; // 5 as buffer
// if true, will apply color conflict resolution
// to prevent different elements mapping to the same color
// Such cases will causes weird game issues like wrong element behaviors,
// but atm would not cause crashes or anything like that.
// Note: This config WILL effect save data, as in save must use the same setting to load correctly
const ApplyColorConflictResolution = true;

// if true, mod will store the different id mappings to the save data,
// and leave enough info for later recovery when mod list is changed
// Note: Nothing is perfect and this is only gonna improve the chance of successful loading of saves
const AddSaveDataEnhancement = true;
 // if true, will patch the color id overflow issue in the game 
const PatchColorIdOverflow = true;

class LibElementsApi /** @implements {LibApi} */ {
    id = "LibElementsApi";
    version = "3.0.0";
    /** @type {Recipe<ElementCtx>[]} */
    KineticRecipes = [];
    /** @type {Recipe<InteractionCtx>[]} */
    BurnableRecipes = [];
    /** @type {Recipe<ElementCtx[]>} */
    ShakerRecipes = [];

    /** @type {CellTypeIdent[]} */
    ShakerFilterAllows = [];

    /** @type {{[top: CellTypeIdent]: {[bottom: CellTypeIdent]: [top: CellTypeIdent, bottom?: CellTypeIdent]}}} */
    BasicInteractionRecipes = {};
    /** @type {Recipe<InteractionCtx>[]} */
    ComplexInteractionRecipes = [];

    /** @type {Recipe<CellCtx>[]} */
    DigRecipes = [];
    /** @type {Recipe<CellCtx>[]} */
    SoilDugRecipes = [];
    /** @type {Recipe<CellCtx>[]} */
    SoilUnfogRecipes = [];

    /** @type {CellTypeDefinition[]} */
    CellTypeDefinitions = [];

    /** @param {CellTypeDefinition} cellType */
    registerCellType(cellType) {
        this.CellTypeDefinitions.push(cellType);
    };
    /** @param {Recipe<ElementCtx>} recipe */
    registerKineticRecipe(recipe) {
        this.KineticRecipes.push(recipe);
    };
    /** @param {Recipe<InteractionCtx>} recipe */
    registerBurnableRecipe(recipe) {
        this.BurnableRecipes.push(recipe);
    };
    /** @param {Recipe<ElementCtx[]>} recipe */
    registerShakerRecipe(recipe) {
        this.ShakerRecipes.push(recipe);
    };

    /** @param {CellTypeIdent} cellType */
    registerShakerFilterAllow(cellType) {
        this.ShakerFilterAllows.push(cellType);
    };

    /** @param {Recipe<InteractionCtx>} recipe */
    registerComplexInteractionRecipe(recipe) {
        this.ComplexInteractionRecipes.push(recipe);
    }
    /** @param {CellTypeIdent} elmOnTop @param {CellTypeIdent} elmOnBottom @param {CellTypeIdent} resultOnTop @param {CellTypeIdent} resultOnBottom */
    registerBasicInteractionRecipe(elmOnTop, elmOnBottom, resultOnTop, resultOnBottom = undefined) {
        if (resultOnBottom === true) {
            // legacy api support, this means double amount of the top element
            resultOnBottom = resultOnTop;
        }
        if (resultOnBottom === false) {
            // legacy api support, this means no bottom element
            resultOnBottom = undefined;
        }
        if (!this.BasicInteractionRecipes[elmOnTop]) this.BasicInteractionRecipes[elmOnTop] = {};
        this.BasicInteractionRecipes[elmOnTop][elmOnBottom] = [resultOnTop, resultOnBottom];
    }

    /** @param {Recipe<CellCtx>} recipe */
    registerDigRecipe(recipe) {
        this.DigRecipes.push(recipe);
    };
    /** @param {Recipe<CellCtx>} recipe */
    registerSoilDugRecipe(recipe) {
        this.SoilDugRecipes.push(recipe);
    };
    /** @param {Recipe<CellCtx>} recipe */
    registerSoilUnfogRecipe(recipe) {
        this.SoilUnfogRecipes.push(recipe);
    };

    impl = {
        /** @param {LibAccess} ll */
        makePhysicsBindingHook(ll) {
            var nameTable = {
                setCell:                   ["Od", "Jx", "Jx"],
                clearCell:                 ["Ud", "Nz", "Nz"],
                setElementToPos:           ["zd", "L3", "L3"],
                swapTwoElementPos:         ["jd", "Hc", "Hc"],
                launchElementAsParticle:   ["oe", ["J","i"], ["J", "o"]],
                cellIsSolidSoil:           ["Wd", "Br", "Br"],
                cellIsSoilType:            ["Xd", "ez", "ez"],
                cellIsElement:             ["$d", "Bp", "Bp"],
                cellIsElementTypeOf:       ["qd", "af", "af"],
                cellIsType:                ["Kd", ["W","z"], ["W","M"]],
                cellIsTypeOf:              ["Zd", "kw", "kw"],
                cellIsEmpty:               ["Qd", "Ol", "Ol"],
                cellIsEmptyOrElementTypeOf:["Jd", "sT", "sT"],
                isCellAtPosEmpty:          ["tf", "lV", "lV"],
                moveOrSwapElementToPos:    ["nf", "Hs", "Hs"],
                getElementTypeAtPos:       ["rf", "QC", "QC"],
                getCellAtPosFromStore:              ["Bd", "tT", "tT"],
                markChunkActive:           ["Hd", "Y$", "Y$"],
                newElementInstance:        ["Fh", ["n","S"], ["n","g"]],
            }
            var bindingMake = (bindName) => {
                var params = {};
                {// Main:
                    var name = nameTable[bindName][0];
                    if (name) {
                        ll.AddPatternPatches({main: [name]},
                            (f)=>`${f}=function(`,
                            (f)=>`${f}=globalThis.callPostAssign(f=>globalThis.physicsBindingBind("${
                                bindName}",f)).trigger=function(`);
                    }
                }
                {// other scripts:
                    var bindTargets = ["336", "546"];
                    var params = {};
                    for (var i=0; i < bindTargets.length; i++) {
                        var name = nameTable[bindName][i+1];
                        if (!name) continue;
                        params[bindTargets[i]] = Array.isArray(name) ? name : [name];
                    }
                    ll.AddPatternPatches(params,
                        (f,ext)=>`${f}:()=>${ext??""}`,
                        (f,ext)=>`${f}:globalThis.callPostAssign(f=>globalThis.physicsBindingIndirectBind("${
                            bindName}",f)).trigger=()=>${ext??""}`);
                }
            };
            bindingMake("setCell");
            bindingMake("clearCell");
            bindingMake("setElementToPos");
            bindingMake("swapTwoElementPos");
            bindingMake("launchElementAsParticle");
            bindingMake("cellIsSolidSoil");
            bindingMake("cellIsSoilType");
            bindingMake("cellIsElement");
            bindingMake("cellIsElementTypeOf");
            bindingMake("cellIsType");
            bindingMake("cellIsTypeOf");
            bindingMake("cellIsEmpty");
            bindingMake("cellIsEmptyOrElementTypeOf");
            bindingMake("isCellAtPosEmpty");
            bindingMake("moveOrSwapElementToPos");
            bindingMake("getElementTypeAtPos");
            bindingMake("getCellAtPosFromStore");
            bindingMake("markChunkActive");
            bindingMake("newElementInstance");
        }
    }

    /** @param {LibAccess} ll */
    finalize(ll) {
        /** @type {LibAccess} */
        ll ??= globalThis.LibLoader; // for backwards compat, old finalize doesn't provide ll param
        globalThis.logInfo("ll-elements: Finalizing");

        this.impl.makePhysicsBindingHook(ll);
        
        // first, manage all of the elements
        this.CellTypeDefinitions.sort((a, b) => a.displayName > b.displayName ? 1 : -1);
        var soilCellTypes = this.CellTypeDefinitions.filter(x => x.metaType == "Soil");
        var elementCellTypes = this.CellTypeDefinitions.filter(x => x.metaType == "Element");
        var particleCellTypes = this.CellTypeDefinitions.filter(x => x.metaType == "Particle");
        if (particleCellTypes.Length > 0) {
            globalThis.logError("ll-elements: Particles are not yet supported!");
            throw new Error("Particles are not yet supported!");
        }
        //console.log("ll-elements: Soil Cell Types:", soilCellTypes);
        //console.log("ll-elements: Element Cell Types:", elementCellTypes);
        // for soils, they are directly in cell type id list. use cell type id
        for (var i = 0; i < soilCellTypes.length; i++) {
            var ct = soilCellTypes[i];
            ct.runtimeIdx = BaseEndOfCellId + i;
        }
        // for elements, they are in element list. use element id
        for (var i = 0; i < elementCellTypes.length; i++) {
            var ct = elementCellTypes[i];
            ct.runtimeIdx = BaseEndOfElementId + i;
        }
        ll.AddInjectionToScriptHeading(globalThis.llElementsPreHook);
        // first patches, add the id enum mapping
        {
            var newCellTypeIds = [];
            var newElementTypeIds = [];

            for (var i = 0; i < soilCellTypes.length; i++) {
                newCellTypeIds.push([soilCellTypes[i].id, soilCellTypes[i].runtimeIdx]);
            }
            for (var i = 0; i < elementCellTypes.length; i++) {
                newElementTypeIds.push([elementCellTypes[i].id, elementCellTypes[i].runtimeIdx]);
            }
            var jsonNewCellTypeIds = JSON.stringify(newCellTypeIds);
            var jsonNewElementTypeIds = JSON.stringify(newElementTypeIds);
            ll.AddPatternPatches(
                {"main": ["Y"], "336": ["e"], "546": ["e"]},
                (l) => `${l}[${l}.Crackstone=30]="Crackstone"`,
                (l) => `${l}[${l}.Crackstone=30]="Crackstone",globalThis.patchCellTypeIds(${l},${jsonNewCellTypeIds})`
            );
            ll.AddPatternPatches(
                {"main": ["$"], "336": ["e"], "546": ["e"]},
                (l) => `${l}[${l}.Basalt=20]="Basalt"`,
                (l) => `${l}[${l}.Basalt=20]="Basalt",globalThis.patchElementTypeIds(${l},${jsonNewElementTypeIds})`
            );
        }
        // next, elm defs
        {
            var specialColorVarientFuncsMap = {}; // id => function
            var elmColorsMap = {}; // id => colors
            var elmBaseHuesMap = {}; // id => hue (0-360)
            var elmFluidsIds = []; // id list
            var elmOnTimerEndCallbacks = {}; // id => function
            { // Validate and patch in the base element configs
                var configCopy = [];
                for (var i = 0; i < elementCellTypes.length; i++) {
                    /** @type {CellTypeDefinition} */
                    var ct = elementCellTypes[i];
                    if (!ct.elementDensity) throw new Error(`ll-elements: Element ${ct.id} density is not defined!`);
                    if (!ct.elementMatterState) throw new Error(`ll-elements: Element ${ct.id} matter state is not defined!`);
                    if (ct.elementColorVarientSelectionFunction) {
                        var func = ct.elementColorVarientSelectionFunction;
                        if (!(func instanceof Function)) {
                            globalThis.logError(`ll-elements: Element ${ct.id} color selection function is not a function!`);
                            throw new Error(`Element ${ct.id} color selection function is not a function!`);
                        }
                        specialColorVarientFuncsMap[ct.id] = func;
                    }
                    if (!ct.elementColor) {
                        if (ct.elementHueHint) {
                            ct.elementColor = CellTypeDefinition.MakeDefaultColorVarients(ct.elementHueHint);
                        }
                        else {
                            globalThis.logError(`ll-elements: Element ${ct.id} colors are not defined!`);
                            throw new Error(`Element ${ct.id} colors are not defined!`);
                        }
                    }
                    if (ct.elementColor.length != 1 && ct.elementColor.length != 4) {
                        globalThis.logError(`ll-elements: Element ${ct.id} colors [${ct.elementColor}] is not valid!`);
                        throw new Error(`Element ${ct.id} colors [${ct.elementColor}] is not valid!`);
                    }
                    elmColorsMap[ct.id] = ct.elementColor;
                    if (!ct.elementHueHint) {
                        // find a hue from the color
                        if (ct.elementColor[0].length == 3) {
                            // hsl
                            ct.elementHueHint = ct.elementColor[0][0]; // grab the hue
                        }
                        else if (ct.elementColor[0].length == 4) {
                            // rgba. We need to cal the hue
                            var color = ct.elementColor[0];
                            ct.elementHueHint = rgb2hue(color);
                        }
                    }
                    elmBaseHuesMap[ct.id] = ct.elementHueHint;
                    if (ct.elementMatterState == "Liquid" || ct.elementMatterState == "Gas") {
                        elmFluidsIds.push(ct.id);
                    }
                    if (ct.elementDurationEndEvent) {
                        elmOnTimerEndCallbacks[ct.id] = ct.elementDurationEndEvent;
                    }

                    var elmDef = {
                        name: ct.displayName ?? ct.id,
                        ident: ct.id,
                        idx: ct.runtimeIdx + 0,
                        interactions: ct.hintInteractions ?? undefined,
                        density: ct.elementDensity,
                        matterTypeName: ct.elementMatterState,
                        duration: ct.elementLifeDuration ?? undefined,
                        getExtraProps: ct.elementGetExtraProps ?? undefined,
                    };
                    if (!!(elmDef.getExtraProps) && !(elmDef.getExtraProps instanceof Function)) {
                        globalThis.logError(`ll-elements: Element ${ct.id} getExtraProps is not a function!`);
                        throw new Error(`Element ${ct.id} getExtraProps is not a function!`);
                    }
                    if (elmDef.getExtraProps) {
                        var funcStr = elmDef.getExtraProps.toString();
                        funcStr = `(${funcStr})()`; // example:
                        // for () => {}, tostring turns into "function () {}"
                        // this then turns into "(function () {})", which is equivalent to "() => {}"
                        ct.elementGetExtraProps = funcStr; // store the stringified function
                    }
                    configCopy.push(elmDef);
                }
                var jsonConfigCopy = JSON.stringify(configCopy);
                ll.AddPatternPatches(
                    {"main":["Mh"],"336":["a"],"546":["r"]},
                    (l) => `.Solid},${l})`,
                    (l) => `.Solid},globalThis.patchElementTypeConfig(${l},${jsonConfigCopy}),${l})`
                );
                // ensure matter type thing is hooked
                ll.AddPatternPatches(
                    {"main":["e"],"336":["e"],"546":["e"]},
                    (l) => `${l}[${l}.Wisp`,
                    (l) => `(globalThis.Hook_MatterType??=${l}),${l}[${l}.Wisp`
                );
                // add to the fluid list
                ll.AddPatternPatches(
                    {"main": ["n", "ne"], "336": ["a.RJ", "d"], "546": ["r.RJ", "u"]},
                    (elmType, l) => `${l}=[${elmType}.Water,`,
                    (elmType, l) => `${l}=[${elmFluidsIds.map(v=>`${elmType}.${v},`).join("")}${elmType}.Water,`,
                );
            }
            { // patch in color fields
                // patch to fix (simplify) the get pixel color function first
                {
                    var particleFunc = (cell, elmClrMap) => {
                        var elmColors = elmClrMap[cell.element.type];
                        return elmColors.length > 1 ? elmColors[cell.element.variantIndex] : elmColors[0];
                    }
                    var fireFunc = (cell, elmClrMap) => {
                        var elmColors = elmClrMap[cell.type];
                        return elmColors.length > 1
                            ? elmColors[Math.floor((cell.duration.max - cell.duration.left) / cell.duration.max * 4)]
                            : elmColors[0];
                    }
                    specialColorVarientFuncsMap["Particle"] = particleFunc;
                    specialColorVarientFuncsMap["Fire"] = fireFunc;
                    ll.AddPatternPatches(
                        {"main": ["n", "o", "r"], "336": ["n.RJ", "s", "e"], "546": ["a.RJ", "s", "e"]},
                        (elmType, cell, _) => `if(${cell}.type===${elmType}.Sand)return(`,
                        (elmType, cell, glb) => `
                            var isSpecialType = [${Object.keys(specialColorVarientFuncsMap).map(v => `${elmType}.${v}`).join(`,`)}]
                                .includes(${cell}.type);
                            if (!isSpecialType) {
                                var elmColors = ${glb}.session.colors.scheme.element[${cell}.type];
                                return elmColors.length > 1 ? elmColors[${cell}.variantIndex] : elmColors[0]
                            }
                            ${Object.entries(specialColorVarientFuncsMap).map(([elmId, func]) =>
                                `if(${cell}.type===${elmType}.${elmId}) return (${func.toString()})(${cell}, ${glb}.session.colors.scheme.element);\n`
                            ).join("")}
                            throw new Error("ll-elements: speical color variant function not found for " + ${cell}.type);
                            if(${cell}.type===${elmType}.Sand)return(`
                    );
                }
                // then patch to add the color definitions in getColorScheme
                {
                    // This only exist in main, and the other scripts all doesn't define it
                    //console.log(elmColorsMap);
                    ll.AddPatternPatches(
                        {"main": ["e", "n", "pu"]},
                        (l,elmType,hsl2rgba) => `,${l}[${elmType}.Basalt]=[${hsl2rgba}(`,
                        (l,elmType,hsl2rgba) => `,
                            ${Object.entries(elmColorsMap).map(([elmId, colors]) => {
                                if (colors.length != 1 && colors.length != 4)
                                    throw new Error(`ll-elements: Element ${elmId} colors [${colors}] is not a valid color!`);
                                var colorStrs = [];
                                for (var i = 0; i < colors.length; i++) {
                                    var color = colors[i];
                                    if (color.length == 3)
                                        colorStrs.push(`${hsl2rgba}(${color[0]},${color[1]},${color[2]})`);
                                    else if (color.length == 4)
                                        colorStrs.push(`[${color[0]},${color[1]},${color[2]},${color[3]}]`);
                                    else throw new Error(`ll-elements: Element ${elmId} color varient ${i} [${color}] is not a valid color!`);
                                }
                                return `${l}[${elmType}.${elmId}]=[${colorStrs.join(",")}],\n`;
                            }).join("")}
                            ${l}[${elmType}.Basalt]=[${hsl2rgba}(`
                    );
                }
                // Also need to patch the baseHue function to use the hue hint, as some code could use it
                {
                    // This only exist in main, and the other scripts all doesn't define it.
                    // console.log("Base Hue Hint:", elmBaseHuesMap);
                    ll.AddPatternPatches(
                        {"main": ["t", "n"]},
                        (l,elmType) => `,${l}[${elmType}.Sandium]=6`,
                        (l,elmType) => `,${Object.entries(elmBaseHuesMap)
                            .map(([elmId, hue]) => `${l}[${elmType}.${elmId}]=${hue},\n`).join("")
                            }${l}[${elmType}.Sandium]=6`
                    );
                }
            }

            { // patch in the timer callbacks
                var callbacksFormatted = [];
                for (var [elmId, func] of Object.entries(elmOnTimerEndCallbacks)) {
                    if (!(func instanceof Function)) throw new Error(`ll-elements: Element ${elmId} duration end callback is not a function!`);
                    callbacksFormatted.push({key: elmId, func: `return ${func.toString()}`});
                }
                var jsonCallbacks = JSON.stringify(callbacksFormatted);
                ll.AddInjectionToScriptHeading(`globalThis.ElementDurationEndCallbacksSource = ${jsonCallbacks};`);
                // patch the updateCellTimer code to the hook
                ll.AddPatternPatches(
                    {"336":["e","t","r"]},
                    (glb,elm,dt) => `){return!(-1===${elm}.duration.max||(${elm}.duration.left-=${dt},`,
                    (glb,elm,dt) => `){
                        if (${elm}.duration.max == -1) return;
                        ${elm}.duration.left -= ${dt};
                        if (${elm}.duration.left <= 0) {
                            var bVal = globalThis.hookOnElementDurationEndCallback(${glb},${elm},${dt});
                            if (bVal) return bVal;
                        }
                        return!((`,
                );
            }
        }
        // then, soil defs
        {
            var soilIds = [];
            var soilSolidIds = [];
            var soilFogIds = [];
            var soilFogToResultMapping = {};
            // validate and patch in the base soil configs
            {
                var configCopy = [];
                for (var i = 0; i < soilCellTypes.length; i++) {
                    /** @type {CellTypeDefinition} */
                    var ct = soilCellTypes[i];
                    if (ct.soilColorWithBackground) {
                        var fg = ct.soilColorWithBackground.fg;
                        var bg = ct.soilColorWithBackground.bg;
                        var type;
                        if (fg.length == 3) {
                            type = "hsl";
                            if (bg.length != 3) throw new Error(`ll-elements: Soil ${ct.id} colors fg '${fg}' and bg '${gb}' must have the same format!`);
                        }
                        else if (fg.length == 4) {
                            type = "rgb"; // yeah actually rgba, but not sure why the it checks for "rgb" in the code...
                            if (bg.length != 4) throw new Error(`ll-elements: Soil ${ct.id} colors fg '${fg}' and bg '${gb}' must have the same format!`);
                        }
                        else throw new Error(`ll-elements: Soil ${ct.id} colors fg '${fg}' and bg '${gb}' must be either in hsl or rgba!`);
                        ct.soilColorWithBackground.model = type;
                    }
                    if (ct.soilFogBackgroundElementType) {
                        if (!ct.soilIsFog) throw new Error(`ll-elements: Soil ${ct.id} background element type '${ct.soilFogBackgroundElementType}' only valid if soilIsFog is true!`);
                        if (!(typeof ct.soilFogBackgroundElementType === "string"))
                            throw new Error(`ll-elements: Soil ${ct.id} background element type '${ct.soilFogBackgroundElementType}' must be a string!`);
                    }
                    if (ct.soilOutput) {
                        if (!(typeof ct.soilOutput.elementType === "string") || !(typeof ct.soilOutput.chance === "number"))
                            throw new Error(`ll-elements: Soil ${ct.id} output '${ct.soilOutput}' must have 'elementType: string' and 'chance: number' defined!`);
                    }

                    // varify color can be found
                    if (!ct.soilIsFog && !ct.soilColorHsl && !ct.soilOutput) {
                        globalThis.logError(`ll-elements: Soil ${ct.id} no colors are defined!`);
                        throw new Error(`Soil ${ct.id} no colors are defined!`);
                    }

                    soilIds.push(ct.id);
                    if (ct.soilIsFog) soilFogIds.push(ct.id);
                    // fog unfogs only if is solid... So.
                    if (!ct.soilIsFog || !ct.soilFogPreventTriggerUncover) soilSolidIds.push(ct.id);
                    if (ct.soilIsFog && ct.soilFogUncoverFunc) {
                        throw new Error(`ll-elements: Soil ${ct.id} fog uncover function is not supported!`);
                    }
                    else if (ct.soilIsFog && ct.soilFogBackgroundElementType) {
                        soilFogToResultMapping[ct.id] = ct.soilFogBackgroundElementType;
                    }

                    var soilDef = {
                        name: ct.displayName ?? ct.id,
                        ident: ct.id,
                        idx: ct.runtimeIdx + 0,
                        interactions: ct.hintInteractions ?? undefined,
                        hp: ct.soilHp ?? undefined,
                        output: (ct.soilOutput) ? {
                            elementType: ct.soilOutput.elementType,
                            chance: ct.soilOutput.chance} : undefined,
                        backgroundElementType: ct.soilFogBackgroundElementType ?? undefined,
                        background: (ct.soilColorWithBackground) ? {
                            model: ct.soilColorWithBackground.model,
                            fg: ct.soilColorWithBackground.fg,
                            bg: ct.soilColorWithBackground.bg} : undefined,
                        colorHSL: ct.soilColorHsl ?? undefined,
                        isFog: ct.soilIsFog ?? false,
                    };
                    configCopy.push(soilDef);
                }
                var jsonConfigCopy = JSON.stringify(configCopy);
                // main: Jl t, 515: i n.vZ
                ll.AddPatternPatches({"main":["Jl","t"],"515":["i","n.vZ"]},
                    (l, cType) => `${l}[${cType}.Crackstone]={name:"`,
                    (l, cType) => `globalThis.patchSoilTypeConfig(${l},${jsonConfigCopy}),${l}[${cType}.Crackstone]={name:"`
                );
            }
            { // patch into the various split up list
                // patch in the color getter to see that our new soil types are in fact, soil
                ll.AddPatternPatches(
                    { "main": ["t", "o"], "336": ["n.vZ", "s"], "546": ["a.vZ", "s"] },
                    (cType, c) => `${cType}.Crackstone].includes(${c})`,
                    (cType, c) => `${cType}.Crackstone${soilIds.map(v=>`,${cType}.${v}`).join("")}].includes(${c})`
                );
                // patch in the 'solid' list to make game see, yes, it's soild. Also patch the fog list while at it.
                // Due to the formatting of the solid list, we instead patch the code right after it. (just so happens to be the fog list too)
                ll.AddPatternPatches(
                    { "main": ["J", "t"], "336": ["i", "a.vZ"], "546": ["o", "r.vZ"] },
                    (fogL, cType) => `${cType}.Crackstone]),${fogL}=[${cType}.`,
                    (fogL, cType) => `${cType}.Crackstone,
                        ${soilSolidIds.map(v=>`${cType}.${v}`).join(",")}]),
                        ${fogL}=[${soilFogIds.map(v=>`${cType}.${v},`).join("")}
                        ${cType}.`
                );
                // patch in the fog unfog to get basic unfogging working
                ll.AddPatternPatches(
                    { "main": ["t", "n", "e", "r", "i", "Fh"], "515": ["a.vZ", "a.RJ", "e", "t", "r", "(0,l.n)"] },
                    (cType,eType,fog,x,y,ne) => `return ${fog}===${cType}.FogWater?${ne}(${eType}.Water,${x},${y})`,
                    (cType,eType,fog,x,y,ne) => `return ${
                    Object.entries(soilFogToResultMapping).map(([fogId, elmType]) =>
                        `${fog}===${cType}.${fogId}?${ne}(${eType}.${elmType},${x},${y}):\n`).join("")}${fog}===${cType}.FogWater?${ne}(${eType}.Water,${x},${y})`
                );
                // patch the color for damaged soil to just check if cell has hp, instead of the type
                ll.AddPatternPatches(
                    { "main": ["t", "o"], "336": ["n.vZ", "s"], "546": ["a.vZ", "s"] },
                    (cType, c) => `${cType}.Petal].includes(${c}.cellType)`,
                    (cType, c) => `${cType}.Petal].includes(${c}.cellType) || ${c}.hp !== undefined`
                );
            }
        }

        // next, the recipes
        {
            { // first, the burnable recipes
                // update the flame counter end so that flames can have more than one output
                ll.AddPatternPatches(
                    {"336":["e","t"]},
                    (_,elm) => `${elm}.y,${elm}),!0;var `,
                    (glb,elm) => `${elm}.y,${elm}),!0;
                        globalThis.hookOnFlameEndSpawnOutput(${glb},${elm});
                        return true;var `
                ); // only exist in 336
                helper_injectRecipes(ll, "Burnable", this.BurnableRecipes,
                    (global, cell, hotElm) => {
                        /** @type {PhysicBinding} */
                        var binding = globalThis.physicsBindingApi;
                        /** @type {{[id:number]:RuntimeRecipe<ElementCtx>}} */
                        var burnRecipes = globalThis.BurnableRecipes;
                        if (!binding.cellIsElement(cell)) return false; // not a element
                        /** @type {Element} */
                        var elm = cell;
                        var recipe = burnRecipes[-elm.type];
                        if (!recipe) return false; // no mapped recipe for this element
                        var result = globalThis.recipeEvalAndProcess("Burnable", recipe, {api:binding, global:global, cell:elm, otherCell: hotElm});
                        if (typeof result === "boolean") return result;
                        var newFlame = binding.newElementInstance(globalThis.Hook_ElementType.Flame, cell.x, cell.y);
                        newFlame.data = {output: result};
                        binding.setCell(global, cell.x, cell.y, newFlame);
                        return true;
                    }
                )
                /** @type {(global, flame: Element)=>void} */
                var hookOnFlameEndSpawnOutput = (global, flameElm) => {
                    /** @type {PhysicBinding} */
                    var binding = globalThis.physicsBindingApi;
                    /** @type {{elementType: number, chance: number} | number[] | null} */
                    var elmDataOutput = flameElm.data?.output;
                    var x = flameElm.x;
                    var y = flameElm.y;
                    if (elmDataOutput) {
                        var result;
                        if (!Array.isArray(elmDataOutput)) {
                                result = elmDataOutput.elementType !== false
                                    && Math.random() < (elmDataOutput.chance ?? 1) ? [-elmDataOutput.elementType] : [];
                        }
                        else {
                            result = elmDataOutput;
                            globalThis.llLogVerbose("ll-elements: Flame end result:", result);
                        }
                        if (result.length > 1) {
                            var findAllSpot = binding.trySpawnCellsAroundPos(global, x, y,
                                result.slice(1), [[x-3,y-3],[x+3,y+3]]);
                            if (!findAllSpot) {
                                // let it live
                                var newElm = binding.newElementInstance(flameElm.type, x, y);
                                newElm.data = flameElm.data;
                                binding.setCell(global, x, y, newElm);
                                return;
                            }
                            // let the ==1 case deal with spawning the first one
                        }
                        if (result.length == 1) {
                            var newCell = result[0] >= 0 ? result[0] : binding.newElementInstance(-result[0], x, y);
                            binding.setCell(global, x, y, newCell);
                            return;
                        }
                    }
                    // otherwise, set it to 'fire'
                    var deadElm = binding.newElementInstance(globalThis.Hook_ElementType.Fire, x, y);
                    binding.setCell(global, x, y, deadElm);
                }
                ll.AddInjectionToScriptHeading(`globalThis.hookOnFlameEndSpawnOutput = ${hookOnFlameEndSpawnOutput.toString()};`);
                // patch in the hook call where burn stuff happens (sparkFlameAtPos func)
                // expects 2, because one is flamethrower, and the other is the normal fire by lava/flame
                ll.AddPatternPatches(
                    {"336":["e","n","i.RJ","a","(0,c.af)"]},
                    (glb,elm,elmType,hotElm,v1) => `}if(${v1}(${elm},${elmType}.Slag))`,
                    (glb,elm,elmType,hotElm,v1) => `}
                        if (globalThis.hookOnBurnableRecipe(${glb},${elm},${hotElm})) return;
                        if(${v1}(${elm},${elmType}.Slag))`,
                2);
            }
            { // next, the kinetic press recipes
                helper_injectRecipes(ll, "KineticPress", this.KineticRecipes,
                    (global, elm) => {
                        if (elm.velocity.y < 200) return false;
                        /** @type {PhysicBinding} */
                        var binding = globalThis.physicsBindingApi;
                        /** @type {RuntimeRecipe<ElementCtx>} */
                        var recipe = globalThis.KineticPressRecipes[-elm.type];
                        if (!recipe) return false; // no mapped recipe for this element
                        var result = globalThis.recipeEvalAndProcess("KineticPress", recipe, {api:binding, global:global, cell:elm});
                        if (typeof result === "boolean") return result;
                        if (result.length == 0) return true;
                        var snapGridFloor = v => Math.floor(v / 4) * 4;
                        var snapGridCeil = v => Math.ceil(v / 4) * 4;
                        if (binding.trySpawnCellsAroundPos(global, elm.x, elm.y+2, result,
                            [[snapGridFloor(elm.x), elm.y+2], [snapGridCeil(elm.x), elm.y+4]], {allowNonTouching: true})) {
                            binding.clearCell(global, elm);
                            return true;
                        }
                        return false;
                    }
                );
                // patch in the hook call where kinetic stuff happens (checkKineticPress func)
                ll.AddPatternPatches(
                    {"main":["r","i","s","t"], "515":["e","t","r","n.vZ"]},
                    (glb,elm,cb,cType) => `=function(${glb},${elm},${cb}){return!(${cb}!==${cType}.VelocitySoaker||`,
                    (glb,elm,cb,cType) => `=function(${glb},${elm},${cb}){
                        if (${cb}!==${cType}.VelocitySoaker) return false;
                        if (globalThis.hookOnKineticPressRecipe(${glb},${elm})) return true;
                    return!(`
                );
            }
            { // next, the shaker recipes
                // patch in the hook call
                ll.AddPatternPatches(
                    {"main":["s","r","t"], "336":["v","t","e"], "546":["f","t","e"]},
                    (s,elm,glb) => `.ShakerRight].includes(${s})&&${elm}.type===`,
                    (s,elm,glb) => `.ShakerRight].includes(${s}))
                        var isShake = true;
                    if (!!isShake) {
                        if (globalThis.hookOnShakerRecipe(${glb},${elm})) return;
                    }
                    if ((!!isShake) &&${elm}.type===`
                );
                // also patch the filter stuff
                ll.AddPatternPatches(
                    {"main":["n"]},
                    (eType) => `.filter={elementType:${eType}.Gold,`,
                    (eType) => `.filter={elementType:[${eType}.Gold${
                        this.ShakerFilterAllows.map(v => `,${eType}.${v}`).join("")
                    }],`
                );

                helper_injectRecipes(ll, "Shaker", this.ShakerRecipes,
                    (global, elm) => {
                        /** @type {PhysicBinding} */
                        var binding = globalThis.physicsBindingApi;
                        /** @type {RuntimeRecipe<ElementCtx>} */
                        var recipe = globalThis.ShakerRecipes[-elm.type];
                        if (!recipe) return false; // no mapped recipe for this element
                        var result = globalThis.recipeEvalAndProcess("Shaker", recipe, {api:binding, global:global, cell:elm});
                        if (typeof result === "boolean") return result;
                        if (result.length == 0) return true;
                        var snapGridFloor = v => Math.floor(v / 4) * 4;
                        var snapGridCeil = v => Math.ceil(v / 4) * 4;
                        if (binding.trySpawnCellsAroundPos(global, elm.x, elm.y, result.slice(1),
                            [[snapGridFloor(elm.x), elm.y-4], [snapGridCeil(elm.x), elm.y]], {allowNonTouching: true})) {
                            var newVal = result[0];
                            if (newVal < 0) {
                                newVal = binding.newElementInstance(-newVal, elm.x, elm.y);
                                newVal.isFreeFalling = false;
                            }
                            binding.setCell(global, elm.x, elm.y, newVal);
                            return true;
                        }
                        return false;
                    }
                );
            }
            { // next, the interaction recipes
                var table = this.BasicInteractionRecipes;
                var fixBasicInteractionRecipes = () => {
                    globalThis.llLogVerbose(`ll-elements: Evaluating BasicInteractionRecipes...`);
                    /** @type {{[top: string]: {[bottom: string]: [top: string, bottom?: string]}}} */
                    var source = globalThis.BasicInteractionRecipesSource;
                    if (!source) throw new Error(`ll-elements: BasicInteractionRecipesSource not found!`);
                    var elmIds = globalThis.Hook_ElementType;
                    var soilIds = globalThis.Hook_CellType;
                    /** @type {{(ident: string)=>number}} */
                    var fixer = (id) => {
                        var newId = elmIds[id];
                        newId = newId !== undefined ? -newId : soilIds[id];
                        if (newId === undefined) throw new Error(`ll-elements: type ${id} not found!`);
                        return newId;
                    }
                    var lookup = [];
                    for (var [key, dict] of Object.entries(source)) {
                        var keyId = fixer(key);
                        if (keyId >= 0) throw new Error(`ll-elements: BasicInteractionRecipesSource key ${key} is not an element type!`);
                        var newDict = [];
                        for (var [bottomKey, to] of Object.entries(dict)) {
                            var bottomId = fixer(bottomKey);
                            if (bottomId >= 0) throw new Error(`ll-elements: BasicInteractionRecipesSource bottom ${bottomKey} is not an element type!`);
                            var toTopId = to[0] != null ? fixer(to[0]) : undefined;
                            var toBottomId = to[1] != null ? fixer(to[1]) : undefined;
                            newDict[-bottomId] = [toTopId, toBottomId];
                        }
                        lookup[-keyId] = newDict;
                    }
                    globalThis.llLogVerbose(`ll-elements: BasicInteractionRecipes evaluated:`, lookup);
                    return lookup;
                };
                ll.AddInjectionToScriptHeading(`
                    globalThis.BasicInteractionRecipesSource = ${JSON.stringify(table)};
                    globalThis.lazyPropSet(globalThis, "BasicInteractionRecipes", ${fixBasicInteractionRecipes.toString()});
                `);
                var hookOnBasicInteractionRecipe = (global, elmA, elmB) => {
                    var table = globalThis.BasicInteractionRecipes;
                    var result = table[elmA.type]?.[elmB.type];
                    if (!result) return false; // no mapped recipe for this element
                    /** @type {PhysicBinding} */
                    var api = globalThis.physicsBindingApi;
                    var topCell = result[0] === undefined ? undefined : result[0] >= 0 ? result[0]
                        : api.newElementInstance(-result[0], elmA.x, elmA.y);
                    var bottomCell = result[1] === undefined ? undefined : result[1] >= 0 ? result[1]
                        : api.newElementInstance(-result[1], elmA.x, elmA.y);
                    topCell === undefined ? api.clearCell(global, elmA)
                        : api.setCell(global, elmA.x, elmA.y, topCell);
                    bottomCell === undefined ? api.clearCell(global, elmB)
                        : api.setCell(global, elmB.x, elmB.y, bottomCell);
                    return true;
                };
                ll.AddInjectionToScriptHeading(`globalThis.hookOnBasicInteractionRecipe = ${hookOnBasicInteractionRecipe.toString()};`);
                ll.AddPatternPatches(
                    {"main":["Kc","r","i","s","o"], "515":["c","e","t","r","i"]},
                    (tb,glb,elmA,elmB,v1) => `,!0;var ${v1}=${tb}[${elmB}.type];return!!`,
                    (tb,glb,elmA,elmB,v1) => `,!0;
                        if (globalThis.hookOnComplexInteractionRecipe(${glb},${elmA},${elmB})) return true;
                        if (globalThis.hookOnBasicInteractionRecipe(${glb},${elmA},${elmB})) return true;
                        var ${v1}=${tb}[${elmB}.type];return!!`
                );
                // the complex interaction recipes
                helper_injectRecipes(ll, "ComplexInteraction", this.ComplexInteractionRecipes,
                    (global, elm, elmB) => {
                        /** @type {PhysicBinding} */
                        var binding = globalThis.physicsBindingApi;
                        var recipes = globalThis.ComplexInteractionRecipes;
                        var recipe = recipes[elm.type];
                        if (!recipe) return false; // no mapped recipe for this element
                        if (recipe.constraint && recipe.constraint !== elmB.type) return false;
                        var result = globalThis.recipeEvalAndProcess("ComplexInteraction", recipe, {api:binding, global:global, cell:elm, otherCell: elmB});
                        if (typeof result === "boolean") return result;
                        var x = elm.x;
                        var y = elm.y;
                        if (result.length == 1 || binding.trySpawnCellsAroundPos(global, x, y, result.slice(1), [[x-3,y-3],[x+3,y+3]])) {
                            binding.setCell(global, x, y, result[0] >= 0 ? result[0] : binding.newElementInstance(-result[0], x, y));
                            return true;
                        }
                        return false;
                    }, (v) => {
                        if (v.key >= 0) throw new Error(`ll-elements: ComplexInteractionRecipes key ${v.key} is not a element type!`);
                        v.key = -v.key;
                        // also patch the 'constraint' property
                        if (v.constraint) {
                            var id = globalThis.Hook_ElementType[v.constraint];
                            if (id === undefined) throw new Error(`ll-elements: Element type ${v.constraint} not found!`);
                            v.constraint = id;
                        }
                    }    
                );
            }
            { // next, soil dig & dug recipes
                ll.AddPatternPatches(
                    {
                        "main":["e","a","n","r","s","o","s"],
                        "336":["e","d","t","r","a","i","o"],
                        "546":["e","u","t","n","r","o","i"]
                    },
                    (glb,cell,x,y,v,dSrc,dmg) => `(${cell})){if(Number.isInteger(${cell})){if(${cell}===`,
                    (glb,cell,x,y,v,dSrc,dmg) => `(${cell})){
                    if (globalThis.hookOnDigRecipe(${glb},${cell},${x},${y},${v},${dSrc},${dmg})) return;
                    if(Number.isInteger(${cell})){if(${cell}===`,
                )
                ll.AddPatternPatches(
                    {
                        "main":["e","r","i","s","o"],
                        "336":["e","r","l","d","u"],
                        "546":["e","n","l","u","c"]
                    },
                    (glb,cell,x,y,v) => `(${glb},${x},${y});else if(${cell}===`,
                    (glb,cell,x,y,v) => `(${glb},${x},${y});
                    else var noReturn = true;
                    if (noReturn === undefined) return;
                    if (globalThis.hookOnSoilDugRecipe(${glb},${cell},${x},${y},${v})) return;
                    else if(${cell}===`,
                )
                helper_injectRecipes(ll, "Dig", this.DigRecipes,
                    (global, cell, x, y, v, dSrc, dmg) => {
                        /** @type {PhysicBinding} */
                        var binding = globalThis.physicsBindingApi;
                        var recipe;
                        if (binding.cellIsElement(cell)) {
                            recipe = globalThis.DigRecipes[-cell.type];
                        }
                        else {
                            recipe = globalThis.DigRecipes[cell.cellType ?? cell];
                        }
                        if (!recipe) return false; // no mapped recipe for this element
                        var result = globalThis.recipeEvalAndProcess("Dig", recipe, {api:binding, global:global, cell:cell, x:x, y:y, velocity: v, digSource: dSrc, damage: dmg});
                        if (typeof result === "boolean") return result;
                        // Note default handling here is flipped compared to others,
                        // Thats cause we want to cancel if it fails, not if it succeeds.
                        if (result.length == 0) return false;
                        if (!binding.trySpawnCellsAroundPos(global, x, y, result, [[x-3,y-3],[x+3,y+3]])) {
                            return true;
                        }
                        return false;
                    },
                );
                helper_injectRecipes(ll, "SoilDug", this.SoilDugRecipes,
                    (global, cellType, posX, posY, vel) => {
                        /** @type {PhysicBinding} */
                        var binding = globalThis.physicsBindingApi;
                        var recipe = globalThis.SoilDugRecipes[cellType];
                        if (!recipe) return false; // no mapped recipe for this element
                        var result = globalThis.recipeEvalAndProcess("SoilDug", recipe, {api:binding, global:global, cell:cellType, x:posX, y:posY, velocity: vel});
                        if (typeof result === "boolean") return result;
                        if (result.length == 0) return true;
                        var spawnerWithVel = (x,y,t,_) => {
                            if (t >= 0) return t;
                            var elmType = -t;
                            var elm = binding.newElementInstance(elmType, x, y);
                            var newVel = {
                                x: Math.random() * -vel.x/2 - vel.x/2,
                                y: -Math.abs(vel.y) * (1+Math.random()*0.3)
                            }
                            binding.launchElementAsParticle(global, elm, newVel);
                        }
                        var allowSkips = new Set(result);
                        allowSkips.add(cellType);
                        if (result.length > 1
                        && !binding.trySpawnCellsAroundPos(global, posX, posY, result.slice(1), [[posX-10,posY-10],[posX+10,posY+10]],
                            {
                                spawner: spawnerWithVel,
                                condition: (x,y) => {
                                    var dx = x - posX;
                                    var dy = y - posY;
                                    if (dx*dx + dy*dy > 100) return false; // outside the range
                                    var c = binding.getCellAtPos(global, x, y);
                                    if (binding.cellIsEmpty(c)) return true;
                                    if (c.element !== undefined) c = c.element;
                                    var cType = binding.cellIsElement(c) ? -c.type : (c.cellType ?? null);
                                    return allowSkips.has(cType) ? null : false;
                                }
                            })) {
                            binding.setCell(global, posX, posY, {cellType: cellType, hp: 1});
                            return true; // cancel the default handling either way here
                        }
                        spawnerWithVel(posX, posY, result[0], 0);
                        return true;
                    },
                );
            }
        }
        
        if (PatchColorIdOverflow) {
            // patch the overflow (1 byte per colorId) by using a 16 byte (ushort) instead
            // Fist patch the alloc size
            ll.AddPatternPatches(
                {"main": ["u"]},
                (mapData) => `${mapData}=new SharedArrayBuffer(`,
                (mapData) => `${mapData}=new SharedArrayBuffer(2*`,
            );
            // Next, patch the 'view' array constructor
            ll.AddPatternPatches(
                {"main": [], "336": []},
                () => `mapData:{data:new Uint8Array(`,
                () => `mapData:{data:new Uint16Array(`,
            );
            // Then, patch the color id generation such that instead of counting down from 252(or something),
            // it counts from leftover of elm used color ids, and skip over special ids.
            ll.AddPatternPatches(
                {"main": ["a","i"]},
                (v,t) => `.elementColorByColorId,${v}=(`,
                // note: >100 is needed as shader hardcoded solid grounds to be 100+
                (v,t) => `.elementColorByColorId, _startingColorId=Math.max(${t}.colorId,100),${v}=(`
            );
            ll.AddPatternPatches(
                {"main": ["M","o"]},
                (clrIds,clrId) => `${clrId}=${clrIds}.ObstacleStart;`,
                (clrIds,clrId) => `${clrId}=_startingColorId+1;` // leave 1 gap just in case.
            );
            ll.AddPatternPatches(
                {"main": ["M","o"]},
                (clrIds,clrId) => `,${clrId}--`,
                (clrIds,clrId) => `,(()=>{do {${clrId}++} while (Object.keys(${clrIds}).includes(""+${clrId}))})(),${clrId}`,
                5
            );
            // Also need to update GL texture type to be 8 bit RG
            ll.AddPatches([
                { // Make the texture type to be 8 bit RG instead of 8 bit R, and update buf size
                    type: "replace",
                    from: "R=new Uint8Array(P.width*P.height),I=Rr.fromBuffer(R,P.width,P.height,{format:fe.RED,type:me.UNSIGNED_BYTE})",
                    to: "R=new Uint8Array(P.width*P.height*2),I=Rr.fromBuffer(R,P.width,P.height,{format:fe.RG,type:me.UNSIGNED_BYTE})",
                    expectedMatches: 1,
                },
                { // Have the setter cast the buffer to byte array
                    type: "replace",
                    from: "r.pixi.tilemap.set(c)",
                    to: `r.pixi.tilemap.set(new Uint8Array(c.buffer))`,
                    expectedMatches: 1,
                },
                { // Update the clrIdLookup texture func to go though all color ids
                    type: "replace",
                    from: "(e,t,n){var r=M.Darkness+1,",
                    to: `(e,t,n){var r = Math.max(M.Darkness,...Object.keys(n).map(Number))+1,`,
                    expectedMatches: 1,
                },
                { // update the shader to use both r and g channel, combining them to 16 bit val
                    type: "replace",
                    from: "float getTileValue(vec2 coord, sampler2D texture)",
                    to: `${JSON.stringify(`
                        float getTileValue(vec2 coord, sampler2D texture)
                        {
                            // Normalizing to [0, 1] and flipping y-coordinate
                            vec2 relativeCoord = vec2(coord.x / uResolution.x, (uResolution.y - coord.y) / uResolution.y);
                            // Scaling to tilemap size
                            vec2 tilemapCoord = relativeCoord * uTilemapSize;
                            // Adjust the tilemap coordinates by the camera position offset
                            vec2 cameraOffset = mod(uCameraPosition, vec2(4.0));
                            tilemapCoord += cameraOffset / uResolution * uTilemapSize;
                            vec2 tileCoord = floor(tilemapCoord);

                            vec4 tileClr = texture2D(texture, (tileCoord + vec2(0.5)) / uTilemapSize);
                            float tileLow = tileClr.r;
                            float tileHigh = tileClr.g;
                            float tileValueLow = tileLow * 255.0;
                            float tileValueHigh = tileHigh * 255.0 * 256.0;
                            return tileValueLow + tileValueHigh;
                        }`).slice(1,-1)}\\nfloat getTileValueOld(vec2 coord, sampler2D texture)`,
                    expectedMatches: 1,
                },
                { // have the wall tilemap use old func instead of the new one, as that aren't changed
                    type: "replace",
                    from: "getTileValue(gl_FragCoord.xy, uWallTilemapTexture)",
                    to: `getTileValueOld(gl_FragCoord.xy, uWallTilemapTexture)`,
                    expectedMatches: 1,
                },
                { // insert the runtime-shader-compile-time replace tag for setting thee lookup count
                    type: "replace",
                    from: "(tileValue + 0.5) / 255.0;",
                    to: `(tileValue + 0.5) / ##COLORID_LOOKUP_TEXTURE_WIDTH##;`,
                    expectedMatches: 1,
                },
                { // apply the runtime-shader-compile-time replacement to the shader string
                    type: "replace",
                    from: `;\\n}",{uResolution:[o.width,o.height],minLightAmount`,
                    to: `;\\n}"
                    .replace("##COLORID_LOOKUP_TEXTURE_WIDTH##", \`\${N.baseTexture.width}.0\`)
                    ,{uResolution:[o.width,o.height],minLightAmount`,
                    expectedMatches: 1,
                },
                { // update the blitting func to have a 16 bit varient
                    type: "replace",
                    from: `function Pf(e,t,n,r,i,s){`,
                    to: `
                    function Pf_16Bit(e_buff, t_ox, n_oy, r_w, i_h, s_stride) {
                        for (var o = new Uint16Array(r_w * i_h),
                            a_row = 0; a_row < i_h; a_row++) {
                            var l_rowStartIdx = (n_oy + a_row) * s_stride + t_ox,
                                u_rowEndIdx = l_rowStartIdx + r_w;
                            o.set(e_buff.subarray(l_rowStartIdx, u_rowEndIdx), a_row * r_w)
                        }
                        return o
                    }
                    function Pf(e,t,n,r,i,s){`,
                    expectedMatches: 1,
                },
                { // and have the map data tilemap use the 16 bit version
                    type: "replace",
                    from: "c=Pf(n.shared.mapData.data,",
                    to: `c=Pf_16Bit(n.shared.mapData.data,`,
                    expectedMatches: 1,
                },
            ]);
        }

        if (ApplyColorConflictResolution) {
            // patch the color conflict resolution code to dynamically shift color values in color scheme if config is enabled
            ll.AddPatternPatches(
                {"main": ["pu", "wu"]},
                (h,d) => `={element:(`,
                (h,d) => `=globalThis.callPostAssign(s=>globalThis.patchResolveColorConflicts(s, ${h}, ${d})).trigger={element:(`
            );
        }
        else {
            // todo throw warn on game screen if color id overflow is detected
        }

        if (AddSaveDataEnhancement)
        {
            // First, add the hook call on end of loading a save, which dumps out needed data
            // for future recoveries
            ll.AddPatternPatches(
                {"main": ["f", "QT", "s"]},
                (v1,f1,glb) => `${v1}=${f1}(${glb},`,
                (v1,f1,glb) => `globalThis.hookOnLoadSaveEndInjectEnhancement(${glb}),${v1}=${f1}(${glb},`,
            );
            // Alternative
            ll.AddPatternPatches(
                {"main": ["e","r.data"]}, // note: not using 't' cause that got shadowed.
                (cell,store) => `{return Array.isArray(${cell})?{cellType:${cell}[0],hp:${cell}[1]}`,
                (cell,store) => `{${cell}=globalThis.hookSaveEnhancementPatchValue(${store},${cell});return Array.isArray(${cell})?{cellType:${cell}[0],hp:${cell}[1]}`,
            );
        }
    };
}

globalThis.llElementsPreHook = function () {
    // helper funcs for stuff
    /** @type {PhysicBinding} */
    globalThis.physicsBindingApi = {};

    // Conditional, as this func is added in libloader v0.1.1
    globalThis.llLogVerbose ??= (...args) => {
        var inWorker = (globalThis.scriptId);
        if (inWorker) {
            console.debug(...args);
        }
        else {
            console.log(...args);
        }
    }

    globalThis.lazyPropSet = (obj, propName, func) => {
        Object.defineProperty(obj, propName, {
            get: function () {
                var value = func();
                Object.defineProperty(obj, propName, {
                    value: value,
                    writable: true,
                    configurable: false,
                    enumerable: true
                });
                return value;
            },
            configurable: true,
            enumerable: true
        });
    }

    globalThis.physicsBindingBind = (bindName, funcToBind) => {
        globalThis.physicsBindingApi[bindName] ??= funcToBind;
    }
    globalThis.physicsBindingIndirectBind = (bindName, bindFuncGetter) => {
        if (Object.hasOwn(globalThis.physicsBindingApi, bindName)) return;
        globalThis.lazyPropSet(globalThis.physicsBindingApi, bindName, () => bindFuncGetter());
    }
    globalThis.callPostAssign = func => {
        var obj = {}
        Object.defineProperty(obj, "trigger", {
            set: function (v) {func(v); return v;},
            configurable: false,
            enumerable: false
        });
        return obj;
    }

    /** @type {(recipeType: string, additionalFixer?: (obj: RuntimeRecipe)=>void)=>(()=>void)} */
    globalThis.genericFixRecipe = (recipeType, additionalFixer) => {
        return () => {
            globalThis.llLogVerbose(`ll-elements: Evaluating ${recipeType}Recipes...`);
            var source = globalThis[`${recipeType}RecipesSource`];
            if (!source) throw new Error(`ll-elements: ${recipeType}RecipesSource not found!`);
            var elmIds = globalThis.Hook_ElementType;
            var soilIds = globalThis.Hook_CellType;
            var computed = {};
            for (var recipe of source) {
                var keyId = elmIds[recipe.key];
                keyId = keyId !== undefined ? -keyId : soilIds[recipe.key];
                if (keyId === undefined) throw new Error(`ll-elements: type ${recipe.key} not found!`);
                if (computed[keyId]) throw new Error(`ll-elements: Multiple ${recipeType} recipe for ${recipe.key} exists!`);
                recipe.key = keyId;
                if (recipe.resultFunc) { // as func in string
                    recipe.result = new Function(recipe.resultFunc)(); // should return a func
                    delete recipe.resultFunc;
                }
                else {
                    // else resolve it to a runtime recipe result
                    recipe.result = globalThis.recipeResultResolveToRuntime(recipe.result);
                }
                additionalFixer?.(recipe);
                computed[recipe.key] = recipe;
            }
            globalThis.llLogVerbose(`ll-elements: ${recipeType}Recipes computed:`, computed);
            return computed;
        }
    }

    var genericFixCallbacks = (callbacksType, additionalFixer) => {
        return () => {
            globalThis.llLogVerbose(`ll-elements: Evaluating ${callbacksType}...`);
            var source = globalThis[`${callbacksType}Source`];
            if (!source) throw new Error(`ll-elements: ${callbacksType}Source not found!`);
            var elmIds = globalThis.Hook_ElementType;
            var soilIds = globalThis.Hook_CellType;
            var computed = {};
            for (var callback of source) {
                var keyId = elmIds[callback.key];
                keyId = keyId !== undefined ? -keyId : soilIds[callback.key];
                if (keyId === undefined) throw new Error(`ll-elements: Type ${callback.key} not found!`);
                if (computed[keyId]) throw new Error(`ll-elements: Multiple ${callbacksType} for ${callback.key} exists!`);
                callback.key = keyId;
                callback.func = new Function(callback.func)(); // should return a func 
                additionalFixer?.(callback);
                computed[callback.keyId] = callback;
            }
            globalThis.llLogVerbose(`ll-elements: ${callbacksType} computed:`, computed);
            return computed;
        }
    }

    globalThis.physicsBindingApi.getCellAtPos = (global, x, y) =>
        globalThis.physicsBindingApi.getCellAtPosFromStore(global.store, x, y);

    /**
     *  @type {(global, posX: number, posY: number, elementsToSpawn: ElementType[],
     *          area: [[minX:number, minY:number],[maxX:number, maxY:number]],
    *          opts?: {
    *              condition?: (posX: number, posY: number)=>boolean,
    *              spawner?: (posX: number, posY: number, elmType: number, idx: number)=>Element,
    *              weakBatching?: boolean,
    *              allowNonTouching?: boolean,
    *          }) => boolean}
     */
    globalThis.physicsBindingApi.trySpawnElementsAroundPos = (global, posX, posY, elmTypes, area, opts) => {
        /** @type {PhysicBinding} */
        var bindApi = globalThis.physicsBindingApi;
        var condition = opts?.condition ?? ((x,y) => bindApi.isCellAtPosEmpty(global,x,y));
        var spawner = opts?.spawner ?? ((x,y,eType,_) => bindApi.newElementInstance(eType, x, y));
        return globalThis.physicsBindingApi.tryAroundPos(posX, posY, elmTypes.length, area,
            condition, (x,y,idx) => {
                var elm = spawner(x,y,elmTypes[idx],idx);
                if (elm) bindApi.setCell(global, x, y, elm);
            }, {
                weakBatching: opts?.weakBatching,
                allowNonTouching: opts?.allowNonTouching,
            }
        )
    };

    
    /**
     *  @type {(global, posX: number, posY: number, cellsToSpawn: number[],
     *          area: [[minX:number, minY:number],[maxX:number, maxY:number]],
     *          opts?: {
     *              condition?: (posX: number, posY: number)=>boolean,
     *              spawner?: (posX: number, posY: number, cellType: number, idx: number)=>Cell,
     *               weakBatching?: boolean,
     *              allowNonTouching?: boolean,
     *          }) => boolean}
    */
    globalThis.physicsBindingApi.trySpawnCellsAroundPos = (global, posX, posY, cellTypes, area, opts) => {
        /** @type {PhysicBinding} */
        var bindApi = globalThis.physicsBindingApi;
        var condition = opts?.condition ?? ((x,y) => bindApi.isCellAtPosEmpty(global,x,y));
        var spawner = opts?.spawner ?? ((x,y,eType,_) => {
            if (eType >= 0) return eType;
            else return bindApi.newElementInstance(-eType, x, y);
        });
        return globalThis.physicsBindingApi.tryAroundPos(posX, posY, cellTypes.length, area,
            condition, (x,y,idx) => {
                var cell = spawner(x,y,cellTypes[idx],idx);
                if (cell) bindApi.setCell(global, x, y, cell);
            }, {
                weakBatching: opts?.weakBatching,
                allowNonTouching: opts?.allowNonTouching,
            }
        )
    }

    /**
        *  @type {(posX: number, posY: number, count: number,
        *          area: [[minX:number, minY:number],[maxX:number, maxY:number]],
        *          condition: (posX: number, posY: number)=>boolean,
        *          action: (posX: number, posY: number, idx: number)=>void,
        *          opts?: {
        *               weakBatching?: boolean,
        *              allowNonTouching?: boolean,
        *          }) => boolean}
    */
    globalThis.physicsBindingApi.tryAroundPos = (posX, posY, count, area, condition, action, opts) => {
        if (count <= 0) return true; // nothing to spawn, so return true
        var weakBatching = opts?.weakBatching ?? false;
        var allowNonTouching = opts?.allowNonTouching ?? false;
        var spaces = [];
        var minX = Math.min(area[0][0], area[1][0]);
        var minY = Math.min(area[0][1], area[1][1]);
        var maxX = Math.max(area[0][0], area[1][0]);
        var maxY = Math.max(area[0][1], area[1][1]);
        var fronts = [[posX, posY]];
        var done = {};
        var dirs = [[1, 0], [0, 1], [-1, 0], [0, -1]];
        // It would be better to use trees for the frontier sorted list, but that brings a whole class,
        // so instead just use sorted array. Js arrays likely get turned into lists so it aren't too slow.
        function dist2(p) { 
            var dx = p[0] - posX;
            var dy = p[1] - posY;
            return dx * dx + dy * dy;
        }
        function insertSortedDist(item) {
            var min = 0;
            var max = fronts.length;
            var index = Math.floor((min + max) / 2);
            while (max > min) {
                if (dist2(item) > dist2(fronts[index])) {
                    max = index;
                } else {
                    min = index + 1;
                }
                index = Math.floor((min + max) / 2);
            }
            fronts.splice(index, 0, item);
        };
        done[posX + "," + posY] = true;
        var isFirst = true;
        while (fronts.length > 0) {
            var front = fronts.pop();
            var cdPass = condition(front[0], front[1]);
            if (cdPass === true) spaces.push(front);
            if (spaces.length >= count) break;
            if (!isFirst && (cdPass === false) && !allowNonTouching) continue;
            isFirst = false;
            for (var i = 0; i < dirs.length; i++) {
                var dir = dirs[i];
                var newX = front[0] + dir[0];
                var newY = front[1] + dir[1];
                if (newX < minX || newX > maxX || newY < minY || newY > maxY) continue;
                if (done[newX + "," + newY]) continue;
                done[newX + "," + newY] = true;
                insertSortedDist([newX, newY]);
            }
        }
        if (spaces.length >= count) {
            for (var i = 0; i < count; i++) {
                var pos = spaces[i];
                action(pos[0], pos[1], i);
            }
            return true;
        }
        if (!weakBatching) return false; // not enough space
        var randIds = Array.from(Array(count).keys()).sort(() => Math.random() - 0.5);
        for (var i = 0; i < spaces.length; i++) {
            var pos = spaces[i];
            var idx = randIds[i];
            action(pos[0], pos[1], idx);
        }
        return true;
    };

    /** @type {(RecipeResult: RecipeResult)=>RuntimeRecipeResult} */
    globalThis.recipeResultResolveToRuntime = (RecipeResult) => {
        var elmIds = globalThis.Hook_ElementType;
        var soilIds = globalThis.Hook_CellType;
        if (!elmIds || !soilIds) throw new Error("ll-elements: Type Ids Not Loaded! How!");
        var resultEntries = Array.isArray(RecipeResult) ? RecipeResult : [RecipeResult];
        /** @type {RuntimeRecipeResultEntry[]} */
        var runtimeEntries = [];
        for (var i = 0; i < resultEntries.length; i++) {
            var entry = resultEntries[i];
            if (!entry.type) {
                var id = elmIds[entry];
                id = id !== undefined ? -id : soilIds[entry];
                if (id === undefined) throw new Error(`ll-elements: type ${entry} not found!`);
                runtimeEntries.push(id);
                continue;
            }
            var id = elmIds[entry.type];
            id = id !== undefined ? -id : soilIds[entry.type];
            if (id === undefined) throw new Error(`ll-elements: type ${entry.type} not found!`);
            runtimeEntries.push({type: id, amount: entry.amount});
        }
        return runtimeEntries;
    }

    /** @type {(result: RuntimeRecipeResult)=>number[]} */
    globalThis.runtimeRecipeResultGenerate = (result) => {
        var list = [];
        for (var i = 0; i < result.length; i++) {
            var entry = result[i];
            if (typeof entry === "number") {
                list.push(entry);
                continue;
            }
            var id = entry.type;
            var amount = entry.amount;
            if (typeof amount !== "number") {
                amount = amount[0] + Math.floor(Math.random() * (amount[1] - amount[0] + 1));
            }
            if (amount < 1) amount = Math.random() < amount ? 1 : 0;
            for (var j = 0; j < amount; j++) {
                list.push(id);
            }
        }
        return list;
    }

    /** @template {GameCtx} TCtx @type {(recipeType: string, recipe: RuntimeRecipe<TCtx>, ctx: TCtx)=>(number[]|boolean)} */
    globalThis.recipeEvalAndProcess = (recipeType, recipe, ctx) => {
        var result;
        if (recipe.result instanceof Function) {
            // if it's a function, call it to get the recipe
            /** @type {(ctx:TCtx)=>RuntimeRecipeResult} */
            result = recipe.result(ctx);
        }
        else result = recipe.result;
        result ??= []; // empty array if null
        globalThis.llLogVerbose(`ll-elements: ${recipeType} recipe result:`, result);
        if (typeof result === "boolean") return result;
        return globalThis.runtimeRecipeResultGenerate(result);
    }

    globalThis.lazyPropSet(globalThis, "ElementDurationEndCallbacks", genericFixCallbacks("ElementDurationEndCallbacks"));

    globalThis.hookOnElementDurationEndCallback = (global, elm, dt) => {
        /** @type {PhysicBinding} */
        var binding = globalThis.physicsBindingApi;
        var durationCallbacks = globalThis.ElementDurationEndCallbacks;
        var callback = durationCallbacks[elm.type];
        if (!callback) return; // no mapped callback for this element. continue as normal
        var result = callback.func({api:binding, global:global, cell:elm, dt:dt});
        return result; // maps perfectly to the injection handling,
        // where true/false terminates the func, while 'undefined' continues the func
    };

    // setup global functions for use in patches
    globalThis.patchCellTypeIds = (list, newIds) => {
        globalThis.Hook_CellType ??= list;
        var modded = globalThis.ModdedCellTypes = [];
        globalThis.llLogVerbose("patching cell type ids, adding newIds:", newIds);
        for (var i = 0; i < newIds.length; i++) {
            modded[newIds[i][0]] = list[newIds[i][0]] = newIds[i][1];
            modded[newIds[i][1]] = list[newIds[i][1]] = newIds[i][0];
        }
        globalThis.llLogVerbose("patched cell type ids, result:", list);
    }

    globalThis.patchElementTypeIds = (list, newIds) => {
        globalThis.Hook_ElementType ??= list;
        var modded = globalThis.ModdedElementTypes = [];
        globalThis.llLogVerbose("patching element type ids, adding newIds:", newIds);
        for (var i = 0; i < newIds.length; i++) {
            modded[newIds[i][0]] = list[newIds[i][0]] = newIds[i][1];
            modded[newIds[i][1]] = list[newIds[i][1]] = newIds[i][0];
        }
        globalThis.llLogVerbose("patched element type ids, result:", list);
    }

    globalThis.patchElementTypeConfig = (list, newConfig) => {
        globalThis.Hook_ElementTypeConfig ??= list;
        globalThis.llLogVerbose("patching element type config, adding newConfig:", newConfig);
        var elmTypeIds = globalThis.Hook_ElementType;
        var matterTypeIds = globalThis.Hook_MatterType;
        if (!elmTypeIds) throw new Error("ll-Elements: ElementTypeIds Not Loaded! How!");
        if (!matterTypeIds) throw new Error("ll-Elements: MatterTypeIds Not Loaded! How!");
        for (var i = 0; i < newConfig.length; i++) {
            var rawCfg = newConfig[i];
            if (elmTypeIds[rawCfg.ident] !== rawCfg.idx) {
                throw new Error(`ll-Elements: Element ${rawCfg.name} id mismatch with the idx mapping!`);
            }
            var matterTypeId = matterTypeIds[rawCfg.matterTypeName];
            if (!matterTypeId) {
                throw new Error(`ll-Elements: Element ${rawCfg.name} matter type ${rawCfg.materTypeName} not found!`);
            }
            var cfg = {
                name: rawCfg.name,
                interactions: rawCfg.interactions, // can be undefined
                density: rawCfg.density ?? 150,
                matterType: matterTypeId,
                duration: rawCfg.duration, // can be undefined
            };
            if (rawCfg.getExtraProps) {
                cfg.getExtraProps = new Function(rawCfg.getExtraProps)();
            }
            list[rawCfg.idx] = cfg;
        }
        globalThis.llLogVerbose("patched element type config, result:", list);
    }
    globalThis.patchSoilTypeConfig = (list, newConfig) => {
        globalThis.Hook_SoilTypeConfig ??= list;
        globalThis.llLogVerbose("patching soil type config, adding newConfig:", newConfig);
        var cellTypeIds = globalThis.Hook_CellType;
        var elmTypeIds = globalThis.Hook_ElementType;
        if (!cellTypeIds) throw new Error("ll-Elements: CellTypeIds Not Loaded! How!");
        if (!elmTypeIds) throw new Error("ll-Elements: ElementTypeIds Not Loaded! How!");
        for (var i = 0; i < newConfig.length; i++) {
            var rawCfg = newConfig[i];
            if (cellTypeIds[rawCfg.ident] !== rawCfg.idx) {
                throw new Error(`ll-Elements: Soil ${rawCfg.name} id mismatch with the idx mapping!`);
            }
            if (rawCfg.output) {
                var elmTypeId = elmTypeIds[rawCfg.output.elementType];
                if (!elmTypeId) {
                    throw new Error(`ll-Elements: Soil ${rawCfg.name} output element type ${rawCfg.output.elementType} not found!`);
                }
                rawCfg.output.elementType = elmTypeId;
            }
            if (rawCfg.backgroundElementType) {
                var elmTypeId = elmTypeIds[rawCfg.backgroundElementType];
                if (!elmTypeId) {
                    throw new Error(`ll-Elements: Soil ${rawCfg.name} background element type ${rawCfg.backgroundElementType} not found!`);
                }
                rawCfg.backgroundElementType = elmTypeId;
            }
            var cfg = {
                name: rawCfg.name,
                interactions: rawCfg.interactions, // can be undefined
                hp: rawCfg.hp, // can be undefined
                output: rawCfg.output, // can be undefined
                backgroundElementType: rawCfg.backgroundElementType, // can be undefined
                background: rawCfg.background, // can be undefined
                colorHSL: rawCfg.colorHSL, // can be undefined
                fog: rawCfg.isFog,
            };
            list[rawCfg.idx] = cfg;
        }
        globalThis.llLogVerbose("patched soil type config, result:", list);
    }

    globalThis.patchResolveColorConflicts = (originalColorScheme, hslFunc, soilDarkeningLevels) => {
        /**
         * @type {{
         *  element: {[elmId: number]: [Rgba] | [Rgba, Rgba, Rgba, Rgba]},
         *  soil: {[soilId: number]: [Hsl, Rgba, Rgba]},
         * }}
         * 
         */
        var r_colorScheme = originalColorScheme;
        /** @type {(hue:number, sat:number, light:number)=>Rgba} */
        var hsl2rgb = hslFunc;
        var hardcodedSoilHsl = {
            "Bedrock": [0, 0, 66],
            "Ice": [199, 99, 90],
            "Divider": [30, 100, 50],
            "GoldSoil": [60, 100, 50]
        }
        var hardcodedDontFix = {};
        // {
        //     // These two are conflicting in vanilla,
        //     // so we need to hardcode them to not fix 
        //     "Gold": false,
        //     "GoldSoil": true,
        // }

        /** @type {number[]} */
        var darkenList = soilDarkeningLevels.slice();
        darkenList.splice(0, 0, 1) // add '1' to the start of the list

        /**
         *  @typedef {{
         *  isElm: boolean,
         *  id: number,
         *  ident: string,
         *  colorVarientId: number,
         *  soilDarkening?: number,
         * }} Entry
         * */
        /** @type {{[key: string]: Entry[]}}} */
        var mappings = {};
        var elmTypes = globalThis.Hook_ElementType;
        var soilTypes = globalThis.Hook_CellType;
        /** @type {(Rgba) => string} */
        const colorToStr = (color) => `${color[0]} ${color[1]} ${color[2]} ${color[3]}`;
        /** @type {(string) => Rgba} */
        const strToColor = (colorStr) => colorStr.split(" ").map(Number);
        const isValidRgba = (color) => !isNaN(color[0]) && !isNaN(color[1]) && !isNaN(color[2]) && !isNaN(color[3]);

        /** @type {(startArray: number[], limits: number[] validCondition: (array: number[]) => boolean) => number[]} */
        const valueShift = (startArray, limits, validCondition) => {
            var frontLists = [startArray];
            var checked = {};
            checked[startArray.join(",")] = true;
            while (frontLists.length > 0) {
                var front = frontLists.splice(0, 1)[0]; // pop the first element
                if (validCondition(front)) {
                    return front;
                }
                var len = front.length;
                for (var i = 0; i < len; i++) {
                    var key;
                    var newFront = front.slice();
                    newFront[i] = (newFront[i] + 1);
                    if (newFront[i] <= limits[i] && (key = newFront.join(","), !checked[key])) {
                        checked[key] = true;
                        frontLists.push(newFront);
                    }
                    var newFront = front.slice();
                    newFront[i] = (newFront[i] - 1);
                    if (newFront[i] >= 0 && (key = newFront.join(","), !checked[key])) {
                        checked[key] = true;
                        frontLists.push(newFront);
                    }
                }
            } // else return undefined
        }

        for (var [elmId, elmColors] of Object.entries(r_colorScheme.element)) {
            var ident = elmTypes[elmId];
            if (ident === undefined) throw new Error(`ll-elements: ElementType Id ${elmId} not found!`);
            for (var i = 0; i < elmColors.length; i++) {
                var rgba = elmColors[i];
                var isValid = isValidRgba(rgba);
                if (!isValid) {
                    globalThis.llLogVerbose(`ll-elements: Element ${ident} varient #${i} color is not valid!`, rgba);
                    continue;
                }
                var color = colorToStr(rgba);
                var entries = mappings[color] ??= (mappings[color] = []);
                entries.push({isElm: true, id: elmId, ident: ident, colorVarientId: i});
            }
        }
        for (var [id, soilColors] of Object.entries(r_colorScheme.soil)) {
            var ident = soilTypes[id];
            if (ident === undefined) throw new Error(`ll-elements: SoilType Id ${id} not found!`);
            if (globalThis.Hook_SoilTypeConfig[id].fog) {
                continue;
            }
            for (var i = 0; i < soilColors.length; i++) {
                var values = soilColors[i];
                var hslOverride;
                if ((hslOverride = hardcodedSoilHsl[ident])) {
                    values = hslOverride;
                    if (i != 0) {
                        continue; // hardcoded soil only has 1 color varient
                    }
                }
                if (values.some(isNaN)) {
                    globalThis.llLogVerbose(`ll-elements: Soil ${ident} varient #${i} color is not valid!`, values);
                    continue;
                }
                if (values.length == 3) {
                    for (var darkening of darkenList) {
                        var rgb = hsl2rgb(values[0], values[1], values[2] * darkening);
                        var color = colorToStr(rgb);
                        var entries = mappings[color] ??= (mappings[color] = []);
                        entries.push({isElm: false, id: id, ident: ident, colorVarientId: i, soilDarkening: darkening});
                    }
                }
                else if (values.length == 4) {
                    var color = colorToStr(rgb);
                    var entries = mappings[color] ??= [];
                    entries.push({isElm: false, id: id, ident: ident, colorVarientId: i});
                }
                else {
                    globalThis.llLogVerbose(`ll-elements: Soil ${ident} varient #${i} color is not valid!`, values);
                    continue;
                }
            }
        }
        // scan for list with more than 1 entry
        var colorUniqueConflictCount = 0;
        var colorTotalConflictCount = 0;
        var totalColorCount = 0;
        var uniqueColorCount = 0;
        var changedEntriesCount = 0;

        /**
         *  @type {{[colorKey: string]: {
         *  bySoil: [keyNumber: string, Entry[]][],
         *  byElm: [keyNumber: string, Entry[]][],
         * }}}
         * */
        var grouppedMappingsWithConflicts = {};

        /** @type {{[key: number]: {[vId: number]: true}}} */
        var soilsWithDarkeningToFix = {};

        // Note: Sort is needed to ensure consistent order of entries.
        for (var [color, entries] of Object.entries(mappings).sort((a, b) => a.displayName > b.displayName ? 1 : -1)) {
            totalColorCount += entries.length;
            uniqueColorCount++;
            //assert(entries.length > 0, "ll-elements: unexpected error in resolveColorConflicts");
            if (entries.length == 1) continue; // no conflict here
            /** @type {{[key: number]: Entry[]}} */
            var entriesBySoilType = {};
            /** @type {{[key: number]: Entry[]}} */
            var entriesByElmType = {};
            for (var i = 0; i < entries.length; i++) {
                var entry = entries[i];
                if (entry.isElm) {
                    var elmEntries = entriesByElmType[entry.id] ??= (entriesByElmType[entry.id] = []);
                    elmEntries.push(entry);
                }
                else {
                    var soilEntries = entriesBySoilType[entry.id] ??= (entriesBySoilType[entry.id] = []);
                    soilEntries.push(entry);
                }
            }
            var uniqueMappingCount = Object.keys(entriesBySoilType).length + Object.keys(entriesByElmType).length;
            if (uniqueMappingCount == 1) continue; // no conflict here, just a single mapping
            // conflict here, so we need to resolve it
            globalThis.llLogVerbose("ll-elements: Color conflict detected for color:", color, "Following entries mapped to it:");
            colorUniqueConflictCount++;
            // print the entries
            var entriesSoilType = Object.entries(entriesBySoilType).sort((a, b) => +a[0] - +b[0]);
            var entriesElmType = Object.entries(entriesByElmType).sort((a, b) => +a[0] - +b[0]);

            var combined = entriesSoilType.concat(entriesElmType);
            for (var [id, entries] of combined) {
                for (var i = 0; i < entries.length; i++) {
                    var entry = entries[i];
                    if (entry.isElm) {
                        var elmEntry = entry;
                        globalThis.llLogVerbose(`Element#${elmEntry.id} (${elmEntry.ident}), color varient #${elmEntry.colorVarientId}`);
                    }
                    else {
                        var soilEntry = entry;
                        globalThis.llLogVerbose(`Soil#${soilEntry.id} (${soilEntry.ident}), color varient #${soilEntry.colorVarientId} ${ soilEntry.soilDarkening ? `, darkening #${soilEntry.soilDarkening}` : ""}`);
                    }
                }
                colorTotalConflictCount++;
            }
            // now, select the one that get to keep this color
            // Soil has priority over elements, as changing soil color is very difficult
            var done = false;
            if (entriesSoilType.length > 0) {
                // find the vanilla soil type that is not modded
                for (var [id, entries] of entriesSoilType) {
                    if (!globalThis.ModdedCellTypes[+id]) {
                        var idx = entriesSoilType.findIndex(e => e[0] == +id);
                        entriesSoilType.splice(idx, 1); // remove the entry from the list
                        done = true;
                        break;
                    }
                }
                if (!done) {
                    // else, just use the first one
                    entriesSoilType.splice(0, 1); // remove the entry from the list
                }
            }
            else {
                // Prioritize keeping the vanilla element color over modded ones
                for (var [id, entries] of entriesElmType) {
                    if (!globalThis.ModdedElementTypes[+id]) {
                        var idx = entriesElmType.findIndex(e => e[0] == +id);
                        entriesElmType.splice(idx, 1); // remove the entry from the list
                        done = true;
                        break;
                    }
                }
                if (!done) {
                    // else, just use the first one
                    entriesElmType.splice(0, 1); // remove the entry from the list
                }
            }
            if (entriesSoilType.length > 0) {
                var idVarsRemoved = [];
                var d = entriesSoilType.map(e => [e[0], e[1].filter(e => !!e.soilDarkening)]).filter(e => e[1].length > 0);
                for (var [id, entries] of d) {
                    var cVarients = {};
                    var _ = entries.map(e => cVarients[e.colorVarientId] = true);
                    var uniqueVars = Object.keys(cVarients).map(Number);
                    _ = uniqueVars.map(e => (soilsWithDarkeningToFix[+id] ??= [])[e] = true);
                    idVarsRemoved.push([+id, uniqueVars]);
                }
                for (var [id, vars] of idVarsRemoved) {
                    var toUpdateIdx = entriesSoilType.findIndex(e => e[0] == id);
                    if (toUpdateIdx < 0) throw new Error(`ll-elements: Unexpected error in resolveColorConflicts`);
                    var remIdx;
                    while ((remIdx = entriesSoilType[toUpdateIdx][1].findIndex(e => vars.includes(e.colorVarientId))) >= 0) {
                        entriesSoilType[toUpdateIdx][1].splice(remIdx, 1); // remove the entry
                    }
                    if (entriesSoilType[toUpdateIdx][1].length == 0) {
                        entriesSoilType.splice(toUpdateIdx, 1); // remove the entry
                    }
                }
            }
            if (entriesElmType.length + entriesSoilType.length == 0) continue;
            grouppedMappingsWithConflicts[color] = {
                bySoil: entriesSoilType,
                byElm: entriesElmType,
            }
        }

        // Now, first, unlist all the darkening entries
        for (var [keyId, vars] of Object.entries(soilsWithDarkeningToFix)) {
            if (hardcodedDontFix[soilTypes[keyId]]) continue; // don't fix this one
            for (var varId of Object.keys(vars).map(Number)) {
                var originalHsl = r_colorScheme.soil[+keyId][varId];
                if (originalHsl.length != 3) throw new Error(`ll-elements: Unexpected error in resolveColorConflicts`);
                //  we need to update the list of mappings and such to free up the color
                var oldColorStrs = darkenList.map(darken => [colorToStr(hsl2rgb(originalHsl[0], originalHsl[1], originalHsl[2] * darken)), darken]);
                for (var i = 0; i < oldColorStrs.length; i++) {
                    changedEntriesCount++;
                    var oldColorStr = oldColorStrs[i][0];
                    var oldMappingEntries = mappings[oldColorStr];
                    if (!oldMappingEntries) throw new Error(`ll-elements: Unexpected error in resolveColorConflicts`);
                    var idx = oldMappingEntries.findIndex(e => e.id == +keyId && e.colorVarientId == varId && e.soilDarkening == oldColorStrs[i][1] && e.isElm == false);
                    if (idx < 0) throw new Error(`ll-elements: Unexpected error in resolveColorConflicts`);
                    if (oldMappingEntries.length == 1) {
                        delete mappings[oldColorStr]; // remove the mapping
                    }
                    else {
                        oldMappingEntries.splice(idx, 1); // remove the entry
                    }
                    // also fix the grouppedMappingsWithConflicts
                    // note: That list never contains darkening entries, so we know we are not in there
                    var pair = grouppedMappingsWithConflicts[oldColorStr];
                    if (!pair) continue; // no need to fix this one (it only contained darkening entries)
                    if (pair.bySoil.length + pair.byElm.length != 1) continue; // can't do anything here
                    // otherwise, just remove the conflict entry as we resolved it
                    delete grouppedMappingsWithConflicts[oldColorStr]; // remove the entry as its resolved
                }
            }
        }
        
        // Then, assign back new colors to the darkening entries
        for (var [keyId, vars] of Object.entries(soilsWithDarkeningToFix)) {
            if (hardcodedDontFix[soilTypes[keyId]]) continue; // don't fix this one
            for (var varId of Object.keys(vars).map(Number)) {
                var originalHsl = r_colorScheme.soil[+keyId][varId];
                if (originalHsl.length != 3) throw new Error(`ll-elements: Unexpected error in resolveColorConflicts`);

                var newHsl = valueShift(originalHsl, [360, 100, 100], (hsl) => {
                    var rgbs = darkenList.map(darken => hsl2rgb(hsl[0], hsl[1], hsl[2] * darken));
                    var colorStrs = rgbs.map(color => colorToStr(color));
                    return colorStrs.every(colorStr => !mappings[colorStr]);
                });
                if (!newHsl) throw new Error(`ll-elements: Color conflict resolution failed! No remaining unused color found!`);

                globalThis.llLogVerbose(`ll-elements: Color conflict resolution for soil ${soilTypes[keyId]} primary hsl:`, originalHsl, `->`, newHsl);

                // actually update the color
                for (var darken of darkenList) {
                    var rgb = hsl2rgb(newHsl[0], newHsl[1], newHsl[2] * darken);
                    var newColorStr = colorToStr(rgb);
                    if (mappings[newColorStr]) throw new Error(`ll-elements: Color conflict resolution failed! Color already exists!`);
                    mappings[newColorStr] = [{isElm: false, id: keyId, ident: soilTypes[keyId], colorVarientId: varId, soilDarkening: darken}];
                }
                r_colorScheme.soil[+keyId][varId] = newHsl; // update the color
            }
        }

        // now, fix the easier rgba conflicts
        for (var [color, conflictEntries] of Object.entries(grouppedMappingsWithConflicts).sort((a, b) => (+a[0]) - (+b[0]))) {
            var currentColor = strToColor(color);
            for (var [soilId, soilEntries] of conflictEntries.bySoil) {
                if (hardcodedDontFix[soilTypes[soilId]]) continue; // don't fix this one
                var toShift = [currentColor[0], currentColor[1], currentColor[2]]; // don't want to change alpha
                var result = valueShift(toShift, [255, 255, 255], (rgb) => {
                    var colorStr = colorToStr([rgb[0], rgb[1], rgb[2], 255]);
                    if (mappings[colorStr]) return false;
                    return true; 
                });
                if (!result) {
                    throw new Error(`ll-elements: Color conflict resolution failed! No remaining unused color found!`);
                }
                globalThis.llLogVerbose(`ll-elements: Color conflict resolution for soil ${soilTypes[soilId]} color:`, toShift, `->`, result);
                var newRgba = [result[0], result[1], result[2], 255];
                for (var j = 0; j < soilEntries.length; j++) {
                    var elmEntry = soilEntries[j];
                    r_colorScheme.soil[elmEntry.id][elmEntry.colorVarientId] = newRgba;
                    changedEntriesCount++;
                }
                // update the mapping to the new color
                var cutout = [];
                var mappingIdx;
                while ((mappingIdx = mappings[color].findIndex(e => e.id == +soilId && e.isElm == false)) >= 0) {
                    cutout.push(mappings[color].splice(mappingIdx, 1)[0]); // remove the entry
                }
                if (cutout.length < 1) throw new Error(`ll-elements: Unexpected error in resolveColorConflicts`);
                var newColorStr = colorToStr(newRgba);
                if (mappings[newColorStr]) throw new Error(`ll-elements: Color conflict resolution failed! Color already exists!`);
                mappings[newColorStr] = cutout; // add the new color mapping
            }
            for (var [elmId, elmEntries] of conflictEntries.byElm) {
                if (hardcodedDontFix[elmTypes[elmId]]) continue; // don't fix this one
                var toShift = [currentColor[0], currentColor[1], currentColor[2]]; // don't want to change alpha
                var result = valueShift(toShift, [255, 255, 255], (rgb) => {
                    var colorStr = colorToStr([rgb[0], rgb[1], rgb[2], 255]);
                    if (mappings[colorStr]) return false;
                    return true; 
                });
                if (!result) {
                    throw new Error(`ll-elements: Color conflict resolution failed! No remaining unused color found!`);
                }
                globalThis.llLogVerbose(`ll-elements: Color conflict resolution for element ${elmTypes[elmId]} color:`, toShift, `->`, result);
                var newRgba = [result[0], result[1], result[2], 255];
                for (var j = 0; j < elmEntries.length; j++) {
                    var elmEntry = elmEntries[j];
                    r_colorScheme.element[elmEntry.id][elmEntry.colorVarientId] = newRgba;
                    changedEntriesCount++;
                }
                // update the mapping to the new color
                var cutout = [];
                var mappingIdx;
                while ((mappingIdx = mappings[color].findIndex(e => e.id == +elmId && e.isElm == true)) >= 0) {
                    cutout.push(mappings[color].splice(mappingIdx, 1)[0]); // remove the entry
                }
                if (cutout.length < 1) throw new Error(`ll-elements: Unexpected error in resolveColorConflicts`);
                var newColorStr = colorToStr(newRgba);
                if (mappings[newColorStr]) throw new Error(`ll-elements: Color conflict resolution failed! Color already exists!`);
                mappings[newColorStr] = cutout; // add the new color mapping
            }
        }

        var remainingConflicts = Object.entries(mappings)
            .map(p => [p[0], p[1]
                .reduce((rv, x)=>((rv[x.ident]??=[]).push(x),rv),{})])
            .map(p => [p[0], Object.entries(p[1])])
            .filter(p => p[1].length > 1);
        globalThis.llLogVerbose("ll-elements: Remaining conflicts:", remainingConflicts);
        var stats = {
            totalColorCount: totalColorCount,
            uniqueColorCount: uniqueColorCount,
            colorUniqueConflictCount: colorUniqueConflictCount,
            colorTotalConflictCount: colorTotalConflictCount,
            changedEntriesCount: changedEntriesCount,
            newUniqueColorCount: Object.keys(mappings).length,
        }
        globalThis.llLogVerbose("ll-elements: Color conflict resolution stats:", stats);
        //debugger;
        
        return stats;
    }

    globalThis.hookSaveEnhancementPatchValue = (store, cell) => {
        var cache = store.Mod_SaveDataEnhancement_LoadingCache;
        if (!cache) {
            var cache = store.Mod_SaveDataEnhancement_LoadingCache = {};
            cache.enabled = false;
            if (!store.Mod_SaveDataEnhancement) {
                console.info("ll-elements: Save file's enhancement data does not exist. Skipping save-data-id-patching.");
                return cell;
            }
            var dataToAdd = store.Mod_SaveDataEnhancement;
            if (dataToAdd.enhancementVersion > 0) {
                console.warn("ll-elements: Save file's enhancement data version is higher than this mod's supported version! Loading this save may cause issues!");
            }
            try {
                /** @type {{[ident: string]: number}} */
                var oldCellTypes = dataToAdd.cellTypes;
                /** @type {{[ident: string]: number}} */
                var oldElmTypes = dataToAdd.elementTypes;
                /** @type {{[ident: string]: number}} */
    
                if (!oldCellTypes || !oldElmTypes) {
                    console.error("ll-elements: Save file's enhancement data does not contain cellTypes or elementTypes. Skipping save-data-id-patching.");
                    return;
                }
                /** @type {{newId?: number, ident: string}[]} */
                var cellRemappingTable = []; // old to new
                /** @type {{newId?: number, ident: string}[]} */
                var elementRemappingTable = []; // old to new
                var cellHasMissingId = false;
                var elementHasMissingId = false;
                var cellAllMatch = true;
                var elementAllMatch = true;
                {
                    for (var [ident, id] of Object.entries(oldCellTypes)) {
                        var newId = globalThis.Hook_CellType[ident];
                        cellAllMatch = cellAllMatch && (newId === id);
                        if (newId === undefined) {
                            //console.error(`ll-elements: Previously existed CellType ${ident} (#${id}) not found.`);
                            cellHasMissingId = true;
                        }
                        cellRemappingTable[id] = {newId: newId, ident: ident};
                    }
                    for (var [ident, id] of Object.entries(oldElmTypes)) {
                        var newId = globalThis.Hook_ElementType[ident];
                        elementAllMatch = elementAllMatch && (newId === id);
                        if (newId === undefined) {
                            //console.error(`ll-elements: Previously existed ElementType ${ident} (#${id}) not found.`);
                            elementHasMissingId = true;
                        }
                        elementRemappingTable[id] = {newId: newId, ident: ident};
                    }
                }
                if (cellAllMatch && elementAllMatch) {
                    console.info("ll-elements: All cell and element types match the remapping table. No save-data-id-patching needed.");
                    return cell;
                }
                var backupCellType = globalThis.Hook_CellType["Empty"];
                var backupElementType = globalThis.Hook_ElementType["Fire"]; // should go 'poof' and disappear
                Object.entries(cellRemappingTable).forEach(([id, e]) => {if (e.newId === +id) delete cellRemappingTable[+id]});
                Object.entries(elementRemappingTable).forEach(([id, e]) => {if (e.newId === +id) delete elementRemappingTable[+id]});
                console.warn("ll-elements: Detected some mismatches in id mapping. Running patching with following remapping:");
                for (var [id, e] of Object.entries(cellRemappingTable)) {
                    if (e.newId != null) {
                        console.warn(`ll-elements: CellType ${e.ident}: #${id} -> #${e.newId}`);
                    } else {
                        console.error(`ll-elements: CellType ${e.ident}: #${id} -> <MISSING>`);
                    }
                }
                for (var [id, e] of Object.entries(elementRemappingTable)) {
                    if (e.newId != null) {
                        console.warn(`ll-elements: ElementType ${e.ident}: #${id} -> #${e.newId}`);
                    } else {
                        console.error(`ll-elements: ElementType ${e.ident}: #${id} -> <MISSING>`);
                    }
                }
                if (cellHasMissingId) {
                    console.error("ll-elements: Some cell types are missing. Will attempt to replace them with 'Empty'.");
                }
                if (elementHasMissingId) {
                    console.error("ll-elements: Some element types are missing. Will attempt to replace them with 'Fire'.");
                }
                var remappingPaths = dataToAdd.indexRemappingPaths;
                if (!remappingPaths) {
                    console.error("ll-elements: Save file's enhancement data does not contain indexRemappingPaths. Unable to run save-data-id-patching.");
                    return cell;
                }
    
                var elmRemappingPaths = remappingPaths["element"] ?? [];
    
                cache.fixedElmConut = 0;
                cache.fixedCellCount = 0;
                /** @type {(obj: object, prop: string) => void} */
                const fixElmIdx = (obj, prop) =>{
                    var val = obj[prop];
                    if (isNaN(val)) return;
                    var remap = elementRemappingTable[val];
                    if (!remap) return;
                    val = remap.newId ?? backupElementType;
                    obj[prop] = val;
                    cache.fixedElmConut++;
                }
    
                /** @type {(obj: object, prop: string) => void} */
                const fixCellIdx = (obj, prop) => {
                    var val = obj[prop];
                    if (isNaN(val)) return;
                    var remap = cellRemappingTable[val];
                    if (!remap) return;
                    val = remap.newId ?? backupCellType;
                    obj[prop] = val;
                    cache.fixedCellCount++;
                }
    
                /** @type {(obj: object, prop: string, metaType: string[]) => void} */
                const fixByMetaType = (obj, prop, metaType) => {
                    if (obj[prop] === undefined) return;
                    switch (metaType[0]) {
                        case "elementIndex":
                            fixElmIdx(obj, prop);
                            break;
                        case "element":
                            if (typeof obj[prop] == "object") remapElm(obj[prop]);
                            break
                        case "cellIndex":
                            fixCellIdx(obj, prop);
                            break;
                        case "cell":
                            remapCell(obj, prop);
                        case "array":
                            if (Array.isArray(obj[prop])) {
                                var nextMetaType = metaType.slice(1);
                                if (nextMetaType[0] === undefined) {
                                    console.warn("ll-elements: Invalid metaType:", metaType);
                                    return;
                                }
                                for (var i = 0; i < obj[prop].length; i++) {
                                    fixByMetaType(obj[prop], i, nextMetaType);
                                }
                            }
                            break;
                        default:
                            console.warn("ll-elements: Unknown metaType:", metaType[0]);
                            break;
                    }
                }
    
                /** @type {(elm: Element) => void} */
                const remapElm = (elm) => {
                    fixElmIdx(elm, "type");
                    for (var remapInfo of elmRemappingPaths) {
                        /** @type {string} */
                        var type = remapInfo.type;
                        if (!type) continue;
                        var typeIdent = globalThis.Hook_ElementType[type];
                        if (typeIdent !== elm.type) continue;
                        /** @type {string[]} */
                        var paths = remapInfo.paths;
                        if (!paths || !paths.length || paths.length < 1) continue;
                        var metaType = remapInfo.metaType;
                        if (!metaType || !metaType.length || metaType.length < 1) continue;
                        var pathsBeforeLast = paths.slice(0, -1);
                        var lastPath = paths[paths.length - 1];
                        var targetObj = elm;
                        for (var path of pathsBeforeLast) {
                            targetObj = targetObj[path];
                            if (!targetObj) break;
                        }
                        if (!targetObj) continue;
                        fixByMetaType(targetObj, lastPath, metaType);
                    }
                }

                cache.fixer = function (cell) {
                    var container = [cell];
                    if (Array.isArray(cell) && cell.length == 2) {
                        // this is a cell with hp
                        fixCellIdx(cell, 0);
                        return cell;
                    }
                    if (typeof cell == "object") {
                        // a full element object. At the moment of writing, only particle elements are under this
                        remapElm(cell);
                        return cell;
                    }
                    else if (typeof cell == "number") {
                        if (cell >= 100) {
                            // So this mean its an element id. Hm.
                            container = [cell - 100];
                            fixElmIdx(container, 0);
                            return container[0] + 100;
                        }
                        else {
                            // this is a cell id.
                            fixCellIdx(container, 0);
                            return container[0];
                        }
                    }
                    else {
                        debugger;
                        console.warn("ll-elements: Unknown cell storage data:", cell);
                    }
                }
            }
            catch (e) {
                console.error("ll-elements: Failed to apply id patching!", e);
                return cell;
            }
            cache.enabled = true;
        }
        if (!cache.enabled) return cell;
        return cache.fixer(cell);
    }

    globalThis.hookOnLoadSaveEndInjectEnhancement = (glb) => {
        var store = glb.store;
        if (store.Mod_SaveDataEnhancement_LoadingCache) {
            // Just got though a load.
            var cache = store.Mod_SaveDataEnhancement_LoadingCache;
            if (cache.enabled) {
                console.info("ll-elements: Finished save-data-id-patching.");
                console.info("ll-elements: Remapped element id count:", cache.fixedElmConut);
                console.info("ll-elements: Remapped cell id count:", cache.fixedCellCount);
            }
            delete store.Mod_SaveDataEnhancement_LoadingCache;
        }
        const selfVersion = 0; // todo change on release
        if (store.dataToAdd?.enhancementVersion > selfVersion) {
            console.warn("ll-elements: Save file's enhancement data version is higher than this mod's supported version! Loading this save may cause issues!");
        }
        var remappingPaths = {};
        remappingPaths["element"] = [
            {
                type: "Flame",
                paths: ["data","output","elementType"],
                metaType: ["elementIndex"],
            }, {
                type: "Flame",
                paths: ["data","output"],
                metatype: ["array", "elementIndex"],
            }, {
                type: "Particle",
                paths: ["element"],
                metatype: ["element"]
            }
        ]
        var elmTypes = Object.entries(globalThis.Hook_ElementType)
            .filter(e => isNaN(e[0]) && !Number.isNaN(e[1]))
            .reduce((rv, x) => ((rv[x[0]] = x[1]), rv), {});
        var cellTypes = Object.entries(globalThis.Hook_CellType)
            .filter(e => isNaN(e[0]) && !Number.isNaN(e[1]))
            .reduce((rv, x) => ((rv[x[0]] = x[1]), rv), {});

        var dataToAdd = {
            enhancementVersion: 0, // todo change on release
            elementTypes: elmTypes,
            cellTypes: cellTypes,
            indexRemappingPaths: remappingPaths,
        };
        store.Mod_SaveDataEnhancement = dataToAdd;
    }
}

/**
 *  @template {GameCtx} TCtx
 * @type {(
 *      ll: LibAccess, 
 *      recipeType: string, 
 *      recipeList: Recipe<TCtx>[], 
 *      hookFunc: (...any)=>any,
 *      additionalFixer?: (obj: RuntimeRecipe)=>void
 *  ) => void}
 *  */
function helper_injectRecipes(ll, recipeType, recipeList, hookFunc, additionalFixer) {
    var recipesFormatted = [];
    for (var i = 0; i < recipeList.length; i++) {
        var recipe = recipeList[i];
        if (!recipe.key) throw new Error(`ll-elements: ${recipeType} recipe ${recipe} doesn't have a key!`);
        if (recipe.result instanceof Function) {
            // serialize func
            recipe.resultFunc = `return ${recipe.result.toString()}`;
            delete recipe.result;
        }
        recipesFormatted.push(recipe);
    }
    var json = JSON.stringify(recipesFormatted);
    //console.log(`${recipeType} Recipes:`, recipesFormatted);
    var recipeTypeWrapped = JSON.stringify(recipeType).slice(1, -1);
    var fixerStr = additionalFixer !== undefined ? ','+additionalFixer.toString() : "";
    var hookFuncStr = `${hookFunc.toString()}`;
    ll.AddInjectionToScriptHeading(`
        globalThis.${recipeType}RecipesSource = ${json};
        globalThis.lazyPropSet(globalThis, "${recipeTypeWrapped}Recipes", globalThis.genericFixRecipe("${recipeTypeWrapped}"${fixerStr}));
        globalThis.hookOn${recipeType}Recipe = ${hookFuncStr};
    `);
}

function rgb2hue(color) {
    {
        var r = color[0] / 255;
        var g = color[1] / 255;
        var b = color[2] / 255;
        var max = Math.max(r, g, b);
        var min = Math.min(r, g, b);
        var h = 0;
        var s = 0;
        var l = (max + min) / 2;
        if (max != min) {
            var d = max - min;
            s = l < 0.5 ? d / (max + min) : d / (2 - max - min);
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
        }
        return Math.round(h * 360);
    }
}

// #endregion Implementation

/** @type {LibLoaderEvents} */
exports.LibLoaderEvents = {
    apiInit(libloader) {
        return new LibElementsApi();
    }
}