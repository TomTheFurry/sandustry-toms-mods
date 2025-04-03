
exports.modinfo = {
    name: "ll-elements",
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
// ==== Implementation ====
// #region Implementation

const BaseEndOfCellId = 31 + 9; // 9 as buffer
const BaseEndOfElementId = 21 + 9; // 9 as buffer

class LibElementsApi /** @implements {LibApi} */ {
    id = "LibElementsApi";
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
                    console.log("name:", bindName, nameTable[bindName]);
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
        console.log("ll-elements: Element Cell Types:", elementCellTypes);
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
            var elmLiquidsIds = []; // todo
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
                    if (ct.soilIsFog) soilFogIds.push(ct.id); else soilSolidIds.push(ct.id);
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
                        `${fog}===${cType}.${fogId}?${ne}(${eType}.${elmType},${x},${y}):\n`).join("")}
                    ${fog}===${cType}.FogWater?${ne}(${eType}.Water,${x},${y})`
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
    };
}

globalThis.llElementsPreHook = function () {
    // helper funcs for stuff
    /** @type {PhysicBinding} */
    globalThis.physicsBindingApi = {};

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
            console.log(`ll-elements: Evaluating ${recipeType}Recipes...`);
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
            console.log(`ll-elements: ${recipeType}Recipes computed:`, computed);
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
                result = Math.random() < (elmDataOutput.chance ?? 1) ? [elmDataOutput.elementType] : []; 
            }
            else {
                result = elmDataOutput;
                console.log("ll-elements: Flame end result:", result);
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
        var result;
        if (recipe.result instanceof Function) {
            // if it's a function, call it to get the recipe
            /** @type {(ctx:InteractionCtx)=>RuntimeRecipeResult} */
            result = recipe.result({api:binding, global:global, cell:elm, otherCell: hotElm});
        }
        else result = recipe.result;
        /** @type {number[]|false|null} */
        var genResults = globalThis.runtimeRecipeResultGenerate(result);
        if (typeof genResults === "boolean") return genResults; // if returned a bool, don't run normal handling
        genResults ??= []; // empty array if null
        var newFlame = binding.newElementInstance(globalThis.Hook_ElementType.Flame, cell.x, cell.y);
        newFlame.data = {output: genResults};
        binding.setCell(global, cell.x, cell.y, newFlame);
        return true;
    }

    globalThis.lazyPropSet(globalThis, "KineticRecipes", genericFixRecipe("Kinetic"));

    /** @type {(global, cell: )=>void} */
    globalThis.hookOnKineticPress = (global, elm) => {
        if (elm.velocity.y < 200) return false;
        /** @type {PhysicBinding} */
        var binding = globalThis.physicsBindingApi;
        var kineticRecipes = globalThis.KineticRecipes;
        var recipe = kineticRecipes[elm.type];
        if (!recipe) return false; // no mapped recipe for this element
        var result;
        if (recipe.result instanceof Function) {
            // if it's a function, call it to get the recipe
            /** @type {(ctx:PhysicCtx)=>RuntimeRecipeResult} */
            result = recipe.result({api:binding, global:global, cell:elm});
        }
        else result = recipe.result;
        /** @type {number[]} */
        var genResults = globalThis.runtimeRecipeResultGenerate(result);
        if (typeof genResults === "boolean") return genResults; // if returned a bool, don't run normal handling
        console.log("ll-elements: Kinetic press result:", genResults);
        genResults ??= []; // empty array if null
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
        console.log("ll-elements: Basic interaction recipes source:", newEntries);
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
        console.log("ll-elements: Basic interaction recipes updated:", table);
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
        var result;
        if (recipe.result instanceof Function) {
            // if it's a function, call it to get the recipe
            /** @type {(ctx:InteractionCtx)=>RuntimeRecipeResult} */
            result = recipe.result({api:binding, global:global, cell:elm, otherCell: elmB});
        }
        else result = recipe.result;
        /** @type {number[]} */
        var genResults = globalThis.runtimeRecipeResultGenerate(result);
        if (typeof genResults === "boolean") return genResults; // if returned a bool, don't run normal handling
        console.log("ll-elements: Complex interaction result:", genResults);
        genResults ??= []; // empty array if null
        if (genResults.length == 0) return true; // done
        var x = elm.x;
        var y = elm.y;
        if (genResults.length == 1 || binding.trySpawnElementsAroundPos(global, x, y, genResults.slice(1), [[x-3,y-3],[x+3,y+3]])) {
            binding.setCell(global, x, y, binding.newElementInstance(genResults[0], x, y));
            return true;
        }
        return false;
    };

    // setup global functions for use in patches
    globalThis.patchCellTypeIds = (list, newIds) => {
        globalThis.Hook_CellType ??= list;
        console.log("patching cell type ids, adding newIds:", newIds);
        for (var i = 0; i < newIds.length; i++) {
            list[newIds[i][0]] = newIds[i][1];
            list[newIds[i][1]] = newIds[i][0];
        }
        console.log("patched cell type ids, result:", list);
    }

    globalThis.patchElementTypeIds = (list, newIds) => {
        globalThis.Hook_ElementType ??= list;
        console.log("patching element type ids, adding newIds:", newIds);
        for (var i = 0; i < newIds.length; i++) {
            list[newIds[i][0]] = newIds[i][1];
            list[newIds[i][1]] = newIds[i][0];
        }
        console.log("patched element type ids, result:", list);
    }

    globalThis.patchElementTypeConfig = (list, newConfig) => {
        globalThis.Hook_ElementTypeConfig ??= list;
        console.log("patching element type config, adding newConfig:", newConfig);
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
        console.log("patched element type config, result:", list);
    }
    globalThis.patchSoilTypeConfig = (list, newConfig) => {
        globalThis.Hook_SoilTypeConfig ??= list;
        console.log("patching soil type config, adding newConfig:", newConfig);
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
            console.log("patched soil type config, result:", list);
        }
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