return;
exports.modinfo = {
	name: "libloader-api-test",
	version: "0.0.1",
	dependencies: [],
	modauthor: "TomTheFurry",
};
exports.patches = [];


// LibLoader test api stuff
exports.LibLoaderEvents = {
    // return an api object that other mods can use during modInit
    apiInit: function (libloader) {
        console.info("API init called!");
        return {
            id: "testmod",
            // test api function
            test: function () {
                console.info("Test API called!");
            },
            // finalize, called after all modInit is done, to do whatever.
            // todo: this is where it can then output patches, etc.
            finalize: function (libloader) {
                console.info("Test API finalize called!");
            }
        }
    },
    // ran after all apiInit is done, and all basic mod info is available
    modInit: function (libloader) {
        console.info("Mod init called!");
        libloader.TryGetApi("testmod").test();
    }
}
