exports.modinfo = {
    name: "ll-toms-snow-melting",
    version: "0.1.0",
    dependencies: [],
    modauthor: "TomTheFurry",
};

/** @type {LibLoaderEvents} */
exports.LibLoaderEvents = {
    // ran after all apiInit is done, and all basic mod info is available
    modInit(libloader) {
        /** @type {LibElementsApi} */
        var llElms = libloader.TryGetApi("LibElementsApi");
        llElms.registerBurnableRecipe({key: "FreezingIce", result: (/** @type {PhysicCtx} */ ctx) => {
            var api = ctx.api;
            var elm = ctx.cell;
            if (api.getElementTypeAtPos(ctx.global, elm.x, elm.y+1) == globalThis.Hook_ElementType.Lava
                || api.getElementTypeAtPos(ctx.global, elm.x+1, elm.y) == globalThis.Hook_ElementType.Lava
                || api.getElementTypeAtPos(ctx.global, elm.x-1, elm.y) == globalThis.Hook_ElementType.Lava) 
            {
                return [globalThis.Hook_ElementType.Water];
            }
            return false;
        }})
    }
}