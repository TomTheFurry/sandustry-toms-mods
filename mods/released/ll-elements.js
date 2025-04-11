
exports.modinfo = {
    name: "ll-elements",
    version: "0.2.2",
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
 * @typedef {Element | number} Cell
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
/**
 * @template {PhysicCtx} TCtx
 * @typedef {(ctx:TCtx)=>boolean|void} Event<TCtx>
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
    soilBouncerBreakable = false; // todo
    soilDamagableFunction = undefined; // todo

    soilIsFog = false;
    soilFogPreventTriggerUncover = false;
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

    /** @type {Event?} */
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
    version = "2.0.0";
    /** @type {Recipe<PhysicCtx>[]} */
    KineticRecipes = [];
    /** @type {Recipe<InteractionCtx>[]} */
    BurnableRecipes = [];
    /** @type {{[a: CellTypeIdent]: {[b: CellTypeIdent]: CellTypeIdent}}} */
    BasicInteractionRecipes = {};
    /** @type {Recipe<InteractionCtx>[]} */
    ComplexInteractionRecipes = [];

    /** @type {CellTypeDefinition[]} */
    CellTypeDefinitions = [];

    /** @param {CellTypeDefinition} cellType */
    registerCellType(cellType) {
        this.CellTypeDefinitions.push(cellType);
    };
    /** @param {Recipe<PhysicCtx>} recipe */
    registerKineticRecipe(recipe) {
        this.KineticRecipes.push(recipe);
    };
    /** @param {Recipe<InteractionCtx>} recipe */
    registerBurnableRecipe(recipe) {
        this.BurnableRecipes.push(recipe);
    };
    /** @param {Recipe<InteractionCtx>} recipe */
    registerComplexInteractionRecipe(recipe) {
        this.ComplexInteractionRecipes.push(recipe);
    }
    /** @param {CellTypeIdent} elmOnTop @param {CellTypeIdent} elmOnBottom */
    registerBasicInteractionRecipe(elmOnTop, elmOnBottom, result, doubleAmount = false) {
        if (!this.BasicInteractionRecipes[elmOnTop]) this.BasicInteractionRecipes[elmOnTop] = {};
        this.BasicInteractionRecipes[elmOnTop][elmOnBottom] = result;
        if (!doubleAmount) return;
        if (!this.BasicInteractionRecipes[elmOnBottom]) this.BasicInteractionRecipes[elmOnBottom] = {};
        this.BasicInteractionRecipes[elmOnBottom][elmOnTop] = result;
    }

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
                getCellAtPos:              ["Bd", "tT", "tT"],
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
            bindingMake("getCellAtPos");
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
            var soilFogToSpecialMapping = {}; //todo
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
                    if (ct.soilBackgroundElementType) {
                        if (!ct.soilIsFog) throw new Error(`ll-elements: Soil ${ct.id} background element type '${ct.soilBackgroundElementType}' only valid if soilIsFog is true!`);
                        if (!(typeof ct.soilBackgroundElementType === "string"))
                            throw new Error(`ll-elements: Soil ${ct.id} background element type '${ct.soilBackgroundElementType}' must be a string!`);
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
                    else if (ct.soilIsFog && ct.soilBackgroundElementType) {
                        soilFogToResultMapping[ct.id] = ct.soilBackgroundElementType;
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
                        backgroundElementType: ct.soilBackgroundElementType ?? undefined,
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

                // next, the actually inject the recipes, by assigning it to 'globalThis.BurnableRecipesSource'
                var recipesFormatted = [];
                for (var i = 0; i < this.BurnableRecipes.length; i++) {
                    var recipe = this.BurnableRecipes[i];
                    if (!recipe.key) throw new Error(`ll-elements: Burnable recipe ${recipe} doesn't have a key!`);
                    if (recipe.result instanceof Function) {
                        // serialize func
                        recipe.resultFunc = `return ${recipe.result.toString()}`;
                        delete recipe.result;
                    }
                    recipesFormatted.push(recipe);
                }
                var json = JSON.stringify(recipesFormatted);
                console.log("Burnable Recipes:", recipesFormatted);
                ll.AddInjectionToScriptHeading(`globalThis.BurnableRecipesSource = ${json};`);

                // next, patch in the hook call where burn stuff happens (sparkFlameAtPos func)
                // expects 2, because one is flamethrower, and the other is the normal fire by lava/flame
                ll.AddPatternPatches(
                    {"336":["e","n","i.RJ","a","(0,c.af)"]},
                    (glb,elm,elmType,hotElm,v1) => `}if(${v1}(${elm},${elmType}.Slag))`,
                    (glb,elm,elmType,hotElm,v1) => `}
                        if (globalThis.hookOnSparkFlameAtPos(${glb},${elm},${hotElm})) return;
                        if(${v1}(${elm},${elmType}.Slag))`,
                2);
            }
            { // next, the kinetic press recipes
                // inject the recipes, by assigning it to 'globalThis.KineticRecipesSource'
                var recipesFormatted = [];
                for (var i = 0; i < this.KineticRecipes.length; i++) {
                    var recipe = this.KineticRecipes[i];
                    if (!recipe.key) throw new Error(`ll-elements: Kinetic recipe ${recipe} doesn't have a key!`);
                    if (recipe.result instanceof Function) {
                        // serialize func
                        recipe.resultFunc = `return ${recipe.result.toString()}`;
                        delete recipe.result;
                    }
                    recipesFormatted.push(recipe);
                }
                var json = JSON.stringify(recipesFormatted);
                console.log("Kinetic Recipes:", recipesFormatted);
                ll.AddInjectionToScriptHeading(`globalThis.KineticRecipesSource = ${json};`);

                // next, patch in the hook call where kinetic stuff happens (checkKineticPress func)
                ll.AddPatternPatches(
                    {"main":["r","i","s","t"], "515":["e","t","r","n.vZ"]},
                    (glb,elm,cb,cType) => `=function(${glb},${elm},${cb}){return!(${cb}!==${cType}.VelocitySoaker||`,
                    (glb,elm,cb,cType) => `=function(${glb},${elm},${cb}){
                        if (${cb}!==${cType}.VelocitySoaker) return false;
                        if (globalThis.hookOnKineticPress(${glb},${elm})) return true;
                    return!(`
                );
            }
            { 
                // next, the interaction recipes
                var table = this.BasicInteractionRecipes;
                ll.AddInjectionToScriptHeading(`globalThis.BasicInteractionRecipesSource = ${JSON.stringify(table)};`);

                // the complex interaction recipes
                var recipesFormatted = [];
                for (var i = 0; i < this.ComplexInteractionRecipes.length; i++) {
                    var recipe = this.ComplexInteractionRecipes[i];
                    if (!recipe.key) throw new Error(`ll-elements: Interaction recipe ${recipe} doesn't have a key!`);
                    if (recipe.result instanceof Function) {
                        // serialize func
                        recipe.resultFunc = `return ${recipe.result.toString()}`;
                        delete recipe.result;
                    }
                    recipesFormatted.push(recipe);
                }

                var json = JSON.stringify(recipesFormatted);
                console.log("ComplexInteraction Recipes:", recipesFormatted);
                ll.AddInjectionToScriptHeading(`globalThis.ComplexInteractionRecipesSource = ${json};`);

                ll.AddPatternPatches(
                    {"main":["Kc","r","i","s","o"], "515":["c","e","t","r","i"]},
                    (tb,glb,elmA,elmB,v1) => `,!0;var ${v1}=${tb}[${elmB}.type];return!!`,
                    (tb,glb,elmA,elmB,v1) => `,!0;
                        if (globalThis.hookOnComplexInteraction(${glb},${elmA},${elmB})) return true;
                        if (!globalThis.hookDone_BasicInteractionRecipesSource) {
                            globalThis.hookDone_BasicInteractionRecipesSource = true;
                            globalThis.hookInitBasicInteractionRecipes(${tb});
                        };var ${v1}=${tb}[${elmB}.type];return!!`
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
            ll.AddPatternPatches(
                {"main": ["pu", "wu"]},
                (h,d) => `={element:(`,
                (h,d) => `=globalThis.callPostAssign(s=>{debugger;}).trigger={element:(`
            );
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

    var genericFixRecipe = (recipeType, additionalFixer) => {
        return () => {
            globalThis.llLogVerbose(`ll-elements: Evaluating ${recipeType}Recipes...`);
            var source = globalThis[`${recipeType}RecipesSource`];
            if (!source) throw new Error(`ll-elements: ${recipeType}RecipesSource not found!`);
            var ids = globalThis.Hook_ElementType;
            var computed = {};
            for (var recipe of source) {
                var keyId = ids[recipe.key];
                if (keyId === undefined) throw new Error(`ll-elements: Element type ${recipe.key} not found!`);
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
                computed[keyId] = recipe;
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
            var ids = globalThis.Hook_ElementType;
            var computed = {};
            for (var callback of source) {
                var keyId = ids[callback.key];
                if (keyId === undefined) throw new Error(`ll-elements: Element type ${callback.key} not found!`);
                if (computed[keyId]) throw new Error(`ll-elements: Multiple ${callbacksType} for ${callback.key} exists!`);
                callback.key = keyId;
                callback.func = new Function(callback.func)(); // should return a func 
                additionalFixer?.(callback);
                computed[keyId] = callback;
            }
            globalThis.llLogVerbose(`ll-elements: ${callbacksType} computed:`, computed);
            return computed;
        }
    }

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
        if (elmTypes.length == 0) return true; // nothing to spawn, so return true
        /** @type {PhysicBinding} */
        var bindApi = globalThis.physicsBindingApi;
        var condition = opts?.condition ?? ((x,y) => bindApi.isCellAtPosEmpty(global,x,y));
        var spawner = opts?.spawner ?? ((x,y,eType,_) => bindApi.newElementInstance(eType, x, y));
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
            if (cdPass) spaces.push(front);
            if (spaces.length >= elmTypes.length) break;
            if (!isFirst && !cdPass && !allowNonTouching) continue;
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
        if (spaces.length >= elmTypes.length) {
            if (spaces.length < elmTypes.length) return false;
            for (var i = 0; i < elmTypes.length; i++) {
                var elmType = elmTypes[i];
                var pos = spaces[i];
                bindApi.setCell(global, pos[0], pos[1], spawner(pos[0], pos[1], elmType, i));
            }
            return true;
        }
        if (!weakBatching) return false; // not enough space to spawn stuff
        var randIds = Array.from(Array(elmTypes.length).keys()).sort(() => Math.random() - 0.5);
        for (var i = 0; i < spaces.length; i++) {
            var pos = spaces[i];
            var elmType = elmTypes[randIds[i]];
            bindApi.setCell(global, pos[0], pos[1], spawner(pos[0], pos[1], elmType, i));
        }
        return true; // all elements spawned
    };

    /** @type {(RecipeResult: RecipeResult)=>RuntimeRecipeResult} */
    globalThis.recipeResultResolveToRuntime = (RecipeResult) => {
        var mapping = globalThis.Hook_ElementType;
        if (!mapping) throw new Error("ll-elements: ElementTypeIds Not Loaded! How!");
        var resultEntries = Array.isArray(RecipeResult) ? RecipeResult : [RecipeResult];
        /** @type {RuntimeRecipeResultEntry[]} */
        var runtimeEntries = [];
        for (var i = 0; i < resultEntries.length; i++) {
            var entry = resultEntries[i];
            if (!entry.type) {
                var id = mapping[entry];
                if (id === undefined) throw new Error(`ll-elements: Element type ${entry} not found!`);
                runtimeEntries.push(id);
                continue;
            }
            var id = mapping[entry.type];
            if (id === undefined) throw new Error(`ll-elements: Element type ${entry.type} not found!`);
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


    globalThis.lazyPropSet(globalThis, "BurnableRecipes",  genericFixRecipe("Burnable"));

    /** @type {(global, flame: Element)=>void} */
    globalThis.hookOnFlameEndSpawnOutput = (global, flameElm) => {
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
                        && Math.random() < (elmDataOutput.chance ?? 1) ? [elmDataOutput.elementType] : [];
            }
            else {
                result = elmDataOutput;
                globalThis.llLogVerbose("ll-elements: Flame end result:", result);
            }
            if (result.length > 1) {
                var findAllSpot = binding.trySpawnElementsAroundPos(global, x, y,
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
                var newElm = binding.newElementInstance(result[0], x, y);
                binding.setCell(global, x, y, newElm);
                return;
            }
        }
        // otherwise, set it to 'fire'
        var deadElm = binding.newElementInstance(globalThis.Hook_ElementType.Fire, x, y);
        binding.setCell(global, x, y, deadElm);
    }

    // true to break func, false to continue
    /** @type {(global, cell: Cell, hotElm: Element)=>boolean} */
    globalThis.hookOnSparkFlameAtPos = (global, cell, hotElm) => {
        /** @type {PhysicBinding} */
        var binding = globalThis.physicsBindingApi;
        /** @type {{[id:number]:RuntimeRecipe<PhysicCtx>}} */
        var burnRecipes = globalThis.BurnableRecipes;
        if (!binding.cellIsElement(cell)) return false; // not a element
        /** @type {Element} */
        var elm = cell;
        var recipe = burnRecipes[elm.type];
        if (!recipe) return false; // no mapped recipe for this element

        /** @type {RuntimeRecipeResult|boolean|null} */
        var result;
        if (recipe.result instanceof Function) {
            // if it's a function, call it to get the recipe
            /** @type {(ctx:InteractionCtx)=>RuntimeRecipeResult} */
            result = recipe.result({api:binding, global:global, cell:elm, otherCell: hotElm});
        }
        else result = recipe.result;
        result ??= []; // empty array if null
        globalThis.llLogVerbose("ll-elements: Spark flame result:", result);
        if (typeof result === "boolean") return result; // if returned a bool, don't run normal handling
        
        /** @type {number[]} */
        var genResults = globalThis.runtimeRecipeResultGenerate(result);
        var newFlame = binding.newElementInstance(globalThis.Hook_ElementType.Flame, cell.x, cell.y);
        newFlame.data = {output: genResults};
        binding.setCell(global, cell.x, cell.y, newFlame);
        return true;
    }

    globalThis.lazyPropSet(globalThis, "KineticRecipes", genericFixRecipe("Kinetic"));

    /** @type {(global, cell: Element)=>void} */
    globalThis.hookOnKineticPress = (global, elm) => {
        if (elm.velocity.y < 200) return false;
        /** @type {PhysicBinding} */
        var binding = globalThis.physicsBindingApi;
        var kineticRecipes = globalThis.KineticRecipes;
        var recipe = kineticRecipes[elm.type];
        if (!recipe) return false; // no mapped recipe for this element

        /** @type {RuntimeRecipeResult|boolean|null} */
        var result;
        if (recipe.result instanceof Function) {
            // if it's a function, call it to get the recipe
            /** @type {(ctx:PhysicCtx)=>RuntimeRecipeResult} */
            result = recipe.result({api:binding, global:global, cell:elm});
        }
        else result = recipe.result;
        result ??= []; // empty array if null
        globalThis.llLogVerbose("ll-elements: Kinetic press result:", result);
        if (typeof result === "boolean") return result; // if returned a bool, don't run normal handling
        
        /** @type {number[]} */
        var genResults = globalThis.runtimeRecipeResultGenerate(result);
        if (genResults.length == 0) return true; // done
        var snapGridFloor = v => Math.floor(v / elm.snapGridCellSize) * elm.snapGridCellSize;
        var snapGridCeil = v => Math.ceil(v / elm.snapGridCellSize) * elm.snapGridCellSize;
        if (binding.trySpawnElementsAroundPos(global, elm.x, elm.y+2, genResults,
            [[snapGridFloor(elm.x), elm.y+2], [snapGridCeil(elm.x), elm.y+4]], {allowNonTouching: true})) {
            binding.clearCell(global, elm);
            return true;
        }
        return false;
    };

    globalThis.hookInitBasicInteractionRecipes = (table) => {
        /** @type {{[a: CellTypeIdent]: {[b: CellTypeIdent]: CellTypeIdent}}}*/
        var newEntries = globalThis.BasicInteractionRecipesSource;
        if (!newEntries) throw new Error("ll-elements: Basic interaction recipes source not found!");
        globalThis.llLogVerbose("ll-elements: Basic interaction recipes source:", newEntries);
        for (var [key, entries] of Object.entries(newEntries)) {
            var keyId = globalThis.Hook_ElementType[key];
            if (keyId === undefined) throw new Error(`ll-elements: Element type ${key} not found!`);
            for (var [from, to] of Object.entries(entries)) {
                var fromId = globalThis.Hook_ElementType[from];
                if (fromId === undefined) throw new Error(`ll-elements: Element type ${from} not found!`);
                var toId = globalThis.Hook_ElementType[to];
                if (toId === undefined) throw new Error(`ll-elements: Element type ${to} not found!`);
                var list = table[keyId] ?? (table[keyId] = []);
                list.push([fromId, toId]);
            }
        }
        globalThis.llLogVerbose("ll-elements: Basic interaction recipes updated:", table);
    };

    globalThis.lazyPropSet(globalThis, "ComplexInteractionRecipes", genericFixRecipe("ComplexInteraction", (v) => {
        // also patch the 'constraint' property
        if (v.constraint) {
            var id = globalThis.Hook_ElementType[v.constraint];
            if (id === undefined) throw new Error(`ll-elements: Element type ${v.constraint} not found!`);
            v.constraint = id;
        }
    }));

    /** @type {(global, elmA: Element, elmB: Element)=>void} */
    globalThis.hookOnComplexInteraction = (global, elm, elmB) => {
        /** @type {PhysicBinding} */
        var binding = globalThis.physicsBindingApi;
        var recipes = globalThis.ComplexInteractionRecipes;
        var recipe = recipes[elm.type];
        if (!recipe) return false; // no mapped recipe for this element
        if (recipe.constraint && recipe.constraint !== elmB.type) return false; // not the right element type
        
        /** @type {RuntimeRecipeResult|boolean|null} */
        var result;
        if (recipe.result instanceof Function) {
            // if it's a function, call it to get the recipe
            /** @type {(ctx:PhysicCtx)=>RuntimeRecipeResult} */
            result = recipe.result({api:binding, global:global, cell:elm, otherCell: elmB});
        }
        else result = recipe.result;
        result ??= []; // empty array if null
        globalThis.llLogVerbose("ll-elements: Complex interaction result:", result);
        if (typeof result === "boolean") return result; // if returned a bool, don't run normal handling
        
        /** @type {number[]} */
        var genResults = globalThis.runtimeRecipeResultGenerate(result);
        if (genResults.length == 0) return true; // done
        var x = elm.x;
        var y = elm.y;
        if (genResults.length == 1 || binding.trySpawnElementsAroundPos(global, x, y, genResults.slice(1), [[x-3,y-3],[x+3,y+3]])) {
            binding.setCell(global, x, y, binding.newElementInstance(genResults[0], x, y));
            return true;
        }
        return false;
    };

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
                            console.warn(`ll-elements: Previously existed CellType ${ident} not found.`);
                            cellHasMissingId = true;
                        }
                        cellRemappingTable[id] = {newId: newId, ident: ident};
                    }
                    for (var [ident, id] of Object.entries(oldElmTypes)) {
                        var newId = globalThis.Hook_ElementType[ident];
                        elementAllMatch = elementAllMatch && (newId === id);
                        if (newId === undefined) {
                            console.warn(`ll-elements: Previously existed ElementType ${ident} not found.`);
                            elementHasMissingId = true;
                        }
                        elementRemappingTable[id] = {newId: newId, ident: ident};
                    }
                }
                if (cellAllMatch && elementAllMatch) {
                    console.info("ll-elements: All cell and element types match the remapping table. No save-data-id-patching needed.");
                    return cell;
                }
                if (cellHasMissingId) {
                    console.warn("ll-elements: Some cell types are missing. Will attempt to replace them with 'Empty'.");
                }
                if (elementHasMissingId) {
                    console.warn("ll-elements: Some element types are missing. Will attempt to replace them with 'Fire'.");
                }
                console.info("ll-elements: Running save-data-id-patching...");
                var backupCellType = globalThis.Hook_CellType["Empty"];
                var backupElementType = globalThis.Hook_ElementType["Fire"]; // should go 'poof' and disappear
                
                var remappingPaths = dataToAdd.indexRemappingPaths;
                if (!remappingPaths) {
                    console.error("ll-elements: Save file's enhancement data does not contain indexRemappingPaths. Unable to run save-data-id-patching.");
                    return cell;
                }
                Object.entries(cellRemappingTable).forEach(([id, e]) => {if (e.newId === +id) delete cellRemappingTable[+id]});
                Object.entries(elementRemappingTable).forEach(([id, e]) => {if (e.newId === +id) delete elementRemappingTable[+id]});
    
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
    
                const remapCell = (obj, prop) => {
                    var val = obj[prop];
                    if (val === undefined) return;
                    if (Number.isInteger(val)) {
                        fixCellIdx(obj, prop);
                    }
                    else {
                        fixCellIdx(val, "cellType"); // used when cell have hp
                    }
                }

                cache.fixer = function (cell) {
                    var container = [cell];
                    if (Array.isArray(cell) && cell.length == 2) {
                        // this is a cell with hp
                        fixCellIdx(container, 0);
                        return container[0];
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

    globalThis.hookOnLoadSaveStartApplyEnhancement = (glb) => {
        var store = glb.store;
        debugger;
        if (!store.Mod_SaveDataEnhancement) {
            console.info("ll-elements: Save file's enhancement data does not exist. Skipping save-data-id-patching.");
            return;
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
                        console.warn(`ll-elements: Previously existed CellType ${ident} not found.`);
                        cellHasMissingId = true;
                    }
                    cellRemappingTable[id] = {newId: newId, ident: ident};
                }
                for (var [ident, id] of Object.entries(oldElmTypes)) {
                    var newId = globalThis.Hook_ElementType[ident];
                    elementAllMatch = elementAllMatch && (newId === id);
                    if (newId === undefined) {
                        console.warn(`ll-elements: Previously existed ElementType ${ident} not found.`);
                        elementHasMissingId = true;
                    }
                    elementRemappingTable[id] = {newId: newId, ident: ident};
                }
            }
            debugger;
            if (cellAllMatch && elementAllMatch) {
                console.info("ll-elements: All cell and element types match the remapping table. No save-data-id-patching needed.");
                return;
            }
            if (cellHasMissingId) {
                console.warn("ll-elements: Some cell types are missing. Will attempt to replace them with 'Empty'.");
            }
            if (elementHasMissingId) {
                console.warn("ll-elements: Some element types are missing. Will attempt to replace them with 'Fire'.");
            }
            console.info("ll-elements: Running save-data-id-patching...");
            var backupCellType = globalThis.Hook_CellType["Empty"];
            var backupElementType = globalThis.Hook_ElementType["Fire"]; // should go 'poof' and disappear
            
            var remappingPaths = dataToAdd.indexRemappingPaths;
            if (!remappingPaths) {
                console.error("ll-elements: Save file's enhancement data does not contain indexRemappingPaths. Unable to run save-data-id-patching.");
                return;
            }
            Object.entries(cellRemappingTable).forEach(([id, e]) => {if (e.newId === +id) delete cellRemappingTable[+id]});
            Object.entries(elementRemappingTable).forEach(([id, e]) => {if (e.newId === +id) delete elementRemappingTable[+id]});

            var elmRemappingPaths = remappingPaths["element"] ?? [];

            var fixedElmConut = 0;
            var fixedCellCount = 0;

            /** @type {(obj: object, prop: string) => void} */
            const fixElmIdx = (obj, prop) =>{
                var val = obj[prop];
                if (isNaN(val)) return;
                var remap = elementRemappingTable[val];
                if (!remap) return;
                val = remap.newId ?? backupElementType;
                obj[prop] = val;
                fixedElmConut++;
            }

            /** @type {(obj: object, prop: string) => void} */
            const fixCellIdx = (obj, prop) => {
                var val = obj[prop];
                if (isNaN(val)) return;
                var remap = cellRemappingTable[val];
                if (!remap) return;
                val = remap.newId ?? backupCellType;
                obj[prop] = val;
                fixedCellCount++;
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

            const remapCell = (obj, prop) => {
                var val = obj[prop];
                if (val === undefined) return;
                if (Number.isInteger(val)) {
                    fixCellIdx(obj, prop);
                }
                else {
                    fixCellIdx(val, "cellType"); // used when cell have hp
                }
            }


            var matrix = store.world.matrix;
            for (var py=0; py<matrix.length; py++) {
                for (var px=0; px<matrix[py].length; px++) {
                    var baseObj = matrix[py];
                    var cell = baseObj[px];
                    if (!!(cell?.type)) {
                        remapElm(cell);
                    }
                    else {
                        remapCell(baseObj, px);
                    }
                }
            }

            console.info("ll-elements: Finished save-data-id-patching.");
            console.info("ll-elements: Remapped element id count:", fixedElmConut);
            console.info("ll-elements: Remapped cell id count:", fixedCellCount);
            debugger;
        }
        catch (e) {
            console.error("ll-elements: Failed to apply id patching!", e);
            return;
        }
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