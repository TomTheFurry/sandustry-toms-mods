exports.modinfo = {
    name: "ll-voidbloom-hydroloop",
    version: "0.0.1",
    dependencies: [],
    modauthor: "TomTheFurry",
};

/** @type {LibLoaderEvents} */
exports.LibLoaderEvents = {
    modInit(libloader) {
        /** @type {LibElementsApi} */
        var llElms = libloader.TryGetApi("LibElementsApi");
        llElms.registerShakerRecipe({key: "Gloom", result: ["Sandium", "Water"]});
        llElms.registerShakerFilterAllow("Sandium");
        llElms.registerKineticRecipe({key: "Gloom", result: (/** @type {PhysicCtx} */ ctx) => {
            var binding = ctx.api;
            var elm = ctx.cell;
            var snapGridFloor = v => Math.floor(v / 4) * 4;
            var snapGridCeil = v => Math.ceil(v / 4) * 4;
            if (Math.random() >= 0.5) {
                if (!binding.trySpawnElementsAroundPos(ctx.global, elm.x, elm.y+2,
                    [globalThis.Hook_ElementType.Sand],
                    [[snapGridFloor(elm.x), elm.y+2], [snapGridCeil(elm.x), elm.y+4]],
                    {allowNonTouching: true})) {
                    return false;
                }
            }
            binding.setCell(ctx.global, elm.x, elm.y,
                binding.newElementInstance(globalThis.Hook_ElementType.Steam, elm.x, elm.y));
            return true;
        }});
        llElms.registerBasicInteractionRecipe("Gloom","Steam","Gloom");
    }
}