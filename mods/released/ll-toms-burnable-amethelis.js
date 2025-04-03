exports.modinfo = {
    name: "ll-toms-burnable-amethelis",
    version: "0.1.1",
    dependencies: [],
    modauthor: "TomTheFurry",
};

exports.LibLoaderEvents = {
    // ran after all apiInit is done, and all basic mod info is available
    modInit: function (libloader) {
        var methodName = `(e=>({output:{elementType:e.Basalt,chance:.02}}))`;
        libloader.AddPatches([
            {
                "type": "replace",
                "from": "if((0,c.af)(n,i.RJ.Slag))return(d=(0,s.n)(i.RJ.Flame,t,r)).data=p[i.RJ.Slag](),d.duration.left=d.duration.max=d.duration.left-a,void(0,c.Jx)(e,t,r,d);",
                "to": `if((0,c.af)(n,i.RJ.Slag))return(d=(0,s.n)(i.RJ.Flame,t,r)).data=p[i.RJ.Slag](),d.duration.left=d.duration.max=d.duration.left-a,void(0,c.Jx)(e,t,r,d);
                if((0,c.af)(n,i.RJ.Petalium))return(d=(0,s.n)(i.RJ.Flame,t,r)).data=${methodName}(i.RJ),d.duration.left=d.duration.max=d.duration.left-a,void(0,c.Jx)(e,t,r,d);
                `,
                "expectedMatches": 1
            },
            {
                "type": "replace",
                "from": "if((0,c.af)(n,i.RJ.Slag)){var u=(0,s.n)(i.RJ.Flame,t,r);return u.data=p[i.RJ.Slag](),void(0,c.Jx)(e,t,r,u)}",
                "to": `if((0,c.af)(n,i.RJ.Slag)){var u=(0,s.n)(i.RJ.Flame,t,r);return u.data=p[i.RJ.Slag](),void(0,c.Jx)(e,t,r,u)}
                if((0,c.af)(n,i.RJ.Petalium)){var u=(0,s.n)(i.RJ.Flame,t,r);return u.data=${methodName}(i.RJ),void(0,c.Jx)(e,t,r,u)}
                `,
            }
        ], "336");
    }
}

/// BELOW IS COPY-PASTED INCLUDES FOR LIBLOADER

// v.3 change: Added intercepts for 515 with fixes and improvements to how nested patching works
// Also added proper libloader versioning & self-overriding
function assert(condition, message) {
    if (!condition) {
        throw new Error("Assertion failed: " + message);
    }
}
function isModLoader() {
    if (globalThis.LibLoader_IsModLoader) {
        return globalThis.LibLoader_IsModLoader;
    }
    if (globalThis.bundlePatches) {
        console.info("LibLoader: Detected 'bundlePatches'. I think this is mod loader.");
        globalThis.LibLoader_IsModLoader = true;
        return true;
    }
    else {
        console.info("LibLoader: Can't found 'bundlePatches'. Prob is the game.");
        globalThis.LibLoader_IsModLoader = false;
        return false;
    }
}
const PatchTarget = {main: "main", 336: "336", 546: "546", 515: "515"};

const LibAccess = class {
    static LL_VERSION = "0.0.3";
    constructor(mods) {
        this.version = LibAccess.LL_VERSION;
        this.mod = {};
        this.api = {};
        this.patchTargets = {};
        for (const key in PatchTarget) {
            this.patchTargets[key] = [];
        }
        this.scriptLoadCalls = [];
        this.hooks = [];
        for (const mod of mods) {
            var modExport = mod.exports;
            var name = modExport.modinfo.name;
            assert(name, "Mod name not defined");
            if (this.mod[name]) {
                // Todo: handle this better
                console.error("Duplicated mod name: " + name + ". Ignoring this mod!");
                continue;
            }
            this.mod[name] = modExport;
        }
    }
    TryGetApi(id) {
        //assert(this.state    , "Libraries not initialized yet");
        return this.api[id];
    }
    GetExportsOf(name) {
        return this.mod[name];
    }
    TryGetModInfo(name) {
        return this.mod[name].modinfo;
    }
    TryGetModExport(name) {
        return this.mod[name];
    }
    InvokeEvent(eventName, invoker) {
        for (const exports of Object.values(this.mod)) {
            if (exports.LibLoaderEvents) {
                //console.info("LibLoader: Detected mod " + exports.modinfo.name + ". Triggering callbacks...");
                var callback = exports.LibLoaderEvents[eventName];
                if (!callback) continue;
                console.info("LibLoader: Invoking event " + eventName + " for mod " + exports.modinfo.name);
                try {
                    invoker(exports, callback);
                } catch (e) {
                    console.error("LibLoader: Error invoking event " + eventName + " for mod " + exports.modinfo.name + ":", e);
                }
            }
        }
    }
    AddHooks(hooks) {
        if (hooks instanceof Array)
            this.hooks.push(...hooks);
        else this.hooks.push(hooks);
    }
    AddPatches(patches, patchTarget) {
        patchTarget ??= PatchTarget.main;
        var p = this.patchTargets[patchTarget];
        if (!p) {
            console.error("LibLoader: Unknown patch target: " + patchTarget);
            return;
        }
        p.push(...patches);
    }
}

function libLoaderInit() {
    exports.modinfo ??= {
        name: "libloader",
        version: LibAccess.LL_VERSION,
        dependencies: [],
        modauthor: "TomTheFurry",
    };
    if (globalThis.scriptId) {
        return; // we are in the script specific part
    }
    // Include guard of sorts
    if (globalThis.LibLoader_Exist) {
        var vInfoParts;
        try {
            vInfoParts = globalThis.LibLoader_Exist.split(".").map((x) => parseInt(x));
            var selfInfoParts = LibAccess.LL_VERSION.split(".").map((x) => parseInt(x));
            if (vInfoParts[0] > selfInfoParts[0] || vInfoParts[1] > selfInfoParts[1] || vInfoParts[2] > selfInfoParts[2]) {
                console.error("LibLoader: Detected a newer version of LibLoader. Overriding the older version.");
                return;
            }
        } catch {
            // prob v0.0.2 which doesn't have this version string nor easy overridable log logic
            console.error("LibLoader: Detected an unknown / older version of LibLoader that cannot be overrided. Please remove the old version.");
            return
        }
    }
    globalThis.LibLoader_Exist = LibAccess.LL_VERSION;
    console.info("LibLoader: Initializing version " + LibAccess.LL_VERSION);
    if (isModLoader()) {
        console.info("LibLoader: Adding jailbreaker...");
        // jailbreak capture end of loadvalidatemods via the log method. Yes. That one.
        // This line => log(`Validated ${globalThis.loadedMods.length} mod(s): [ ${globalThis.loadedMods.map((m) => `${m.exports.modinfo.name} (v${m.exports.modinfo.version})`).join(", ")} ]`);
        globalThis.LibLoader_TrueLogBase ??= globalThis.logBase;
        assert(globalThis.LibLoader_TrueLogBase, "logBase not found");
        globalThis.logBase = function (level, tag, message) {
            try {
            globalThis.LibLoader_TrueLogBase(level, tag, message);
            //console.debug("LibLoader: logBase intercept", level, tag, message);
            if (level !== "info") return;
            if (tag !== "") return;
            var match = message.match(/Validated (\d+) mod\(s\): \[ (.*) \]/);
            if (match) {
                console.info("LibLoader: Detected matching location that prob is end of loadValidateMods.");
                console.info("LibLoader: Starting loader version " + LibAccess.LL_VERSION);
                // restore the log hook
                globalThis.logBase = globalThis.LibLoader_TrueLogBase;
                // setup libloader stuff
                var ll = globalThis.LibLoader = new LibAccess(globalThis.loadedMods) // todo put api here
                // invoke loading events
                // event: apiInit
                ll.InvokeEvent("apiInit", (e,c) => {
                    var modName = e.modinfo.name;
                    var api = c(ll);
                    if (!api) {
                        console.error(`LibLoader: apiInit for ${modName} returned null`);
                        return;
                    }
                    if (!api.id) {
                        console.error(`LibLoader: apiInit for ${modName} returned an api without an 'id'`);
                        return;
                    }
                    globalThis.LibLoader.api[api.id] = api;
                    console.info(`LibLoader: Defined API ${api.id} by ${modName}`);
                });
                // event: modInit
                ll.InvokeEvent("modInit", (e,c) => {
                    c(ll);
                });
                // event: finalize
                console.info("LibLoader: Finalizing APIs...");
                for (const api of Object.values(ll.api)) {
                    try {
                        if (api.finalize) {
                            console.info(`LibLoader: Finalizing api ${api.id}`);
                            api.finalize();
                        }
                    }
                    catch (e) {
                        console.error(`LibLoader: Error on finalizing api ${api.id}`, e);
                    }
                }
                // output patches and stuff
                {
                    // add default patches to fix importScripts
                    ll.AddPatches([{type:"replace",from:`o.p=e`,to:`o.p=$$PREFIXPATH$$`,expectedMatches:1}], PatchTarget[546]);
                    ll.AddPatches([{type:"replace",from:`i.p=e`,to:`i.p=$$PREFIXPATH$$`,expectedMatches:1}], PatchTarget[336]);
                    // add default patches to hijack worker new so more scripts can be intercepted
                    ll.AddPatches([{type:"replace",from:`new Worker(`,to:`globalThis.redirectedWorkerNew(`}], PatchTarget.main);
                    // add main patches to mod loader
                    var patchTargets = ll.patchTargets;
                    console.log("Patch targets:", patchTargets);
                    globalThis.bundlePatches = globalThis.bundlePatches.concat(patchTargets[PatchTarget.main]);
                    // add main hooks to mod loader
                    var hooks = ll.hooks;
                    {
                        for (const hook of hooks) {
                            Object.keys(hook).forEach((key) => {
                                const list = hook[key] instanceof Array ? hook[key] : [hook[key]];
                                if (key in globalThis.intercepts) globalThis.intercepts[key].push(...list);
                                else globalThis.intercepts[key] = list;
                                log(`Added ${list.length} rule(s) to endpoint: ${key}`);
                            });
                        }
                    }
                    // Add the intercepts so the scirpt-specific patches can be applied
                    function AddIntercepts(scriptId, patches) {
                        var scriptName = `${scriptId}.bundle.js`;
                        var modloaderPatchPatches = [
                            {
                                type: "replace",
                                from: `await setupConfigMenu();`,
                                to: ``, // void the config stuff: we don't want that in non-main scripts!
                                expectedMatches: 1,
                            },
                            {
                                type: "replace",
                                from: `await executeModFunctions();`,
                                to: `
                                (()=>{let r="onUnsafePreload"+globalThis.scriptId;for(let o of globalThis.activeMods){let e=o[r];if(e)try{e()}catch(t){console.error(\`Error executing \${r} for mod '\${o.modinfo.name}': \`,t)}}})();
                                `,
                                expectedMatches: 1,
                            }
                        ]
                        var inlineAdd = `
                            if (!globalThis.scriptId){
                                globalThis.scriptId=$$SCRIPTID$$;
                                const oldFetch = self.fetch;
                                const prefetchData = JSON.parse($$PREFETCHDATA$$);
                                globalThis.fetch = async (url) => {
                                    var strUrl = url + "";
                                    var firstMatchingKey = Object.keys(prefetchData).find(k => strUrl.endsWith(k));
                                    if (firstMatchingKey) {
                                        var mappedUrl = prefetchData[firstMatchingKey];
                                        console.log("Intercepted fetch "+url+" with blobUrl:", mappedUrl);
                                        return oldFetch(mappedUrl);
                                    }
                                    console.log("fetch not intercepted for url:", url);
                                    return oldFetch(url);
                                }
                                var oldImportScripts = self.importScripts;
                                self.importScripts = (url) => {
                                    var strUrl = url + "";
                                    var firstMatchingKey = Object.keys(prefetchData).find(k => strUrl.endsWith(k));
                                    if (firstMatchingKey) {
                                        var mappedUrl = prefetchData[firstMatchingKey];
                                        console.log("Intercepted importScripts "+url+" with blobUrl:", mappedUrl);
                                        return oldImportScripts(mappedUrl);
                                    }
                                    console.log("importScripts not intercepted for url:", url);
                                    return oldImportScripts(url);
                                }
                                $$MODLOADERINJECT$$
                            }
                        `;
                        //var inlineAdd = "";
                        globalThis.intercepts[`${scriptId}.bundle.js`] = [
                            {
                                requiresBaseResponse: true,
                                getFinalResponse: async ({ baseResponse }) => {
                                    assert(globalThis.modloaderContent);
                                    globalThis.log(`Intercepted ${scriptName}...`);
                                    let body = Buffer.from(baseResponse.body, "base64").toString("utf8");
                                    //globalThis.injectModloader(body);
                                    body = inlineAdd.replace("$$MODLOADERINJECT$$", globalThis.modloaderContent) + body;
                                    globalThis.log(`Applying patches to Modloader injection...`);
                                    var oldPatches = globalThis.bundlePatches;
                                    globalThis.bundlePatches = modloaderPatchPatches;
                                    body = globalThis.applyBundlePatches(body);
                                    body = body.replace("$$SCRIPTID$$", JSON.stringify(scriptId));
                                    globalThis.log(`Applying ${scriptName} sepcific patches...`);
                                    globalThis.bundlePatches = patches;
                                    body = globalThis.applyBundlePatches(body);
                                    globalThis.bundlePatches = oldPatches;
                                    body = Buffer.from(body).toString("base64");
                                    return { body, contentType: "text/javascript" };
                                },
                            },
                        ];
                    }
                    AddIntercepts("515", patchTargets[PatchTarget[515]]);
                    AddIntercepts("546", patchTargets[PatchTarget[546]]);
                    AddIntercepts("336", patchTargets[PatchTarget[336]]);
                    console.log("LibLoader init done");
                }
            }
            } catch (e) {
                console.error("LibLoader: Fatel Error in logBase hook:", e);
            }
        }
    }
    else {
        // log current url
        var path = location.href;
        // cut the html file part, add /js/, to get a path for js loading
        path = path.substring(0, path.lastIndexOf("/") + 1);
        // stringify it
        console.log("Current url:", path);

        globalThis.PrefetchInject = null;
        
        globalThis.redirectedWorkerNew = function (url) {
            if (!globalThis.PrefetchInject) {
                var fetchablesKeys = [["modloader-api/active-mod-paths", "application/json"], ["js/515.bundle.js", "text/javascript"]];
                var prefetchBlobCache = {};
                for (const key of fetchablesKeys) {
                    var xhr = new XMLHttpRequest();
                    xhr.open("GET", path + key[0], false); // false makes it synchronous
                    console.log("Prefetching:", path + key[0]);
                    xhr.send();
                    var data = xhr.responseText;
                    var blob = new Blob([data], { type: key[1] });
                    var blobUrl = URL.createObjectURL(blob);
                    prefetchBlobCache[key[0]] = blobUrl;
                    console.log("Prefetched:", path + key[0], blobUrl);
                }
                globalThis.PrefetchInject = JSON.stringify(JSON.stringify(prefetchBlobCache));
            }
            // instead of doing new Worker(url),
            // we want to fatch the string data at the url, then pass it into the worker constructor
            // reason is that thwen it gets intercepted by modloader
            // fetch the url
            console.log("Redirected worker new:", url);
            // Note: We can't use fetch as we need to BLOCK everything until we get the data
            // so we use a synchronous request
            // var data = await fetch(url).then(r => r.text());
            var xhr = new XMLHttpRequest();
            xhr.open("GET", url, false); // false makes it synchronous
            xhr.send();
            var data = xhr.responseText;
            //var data = await fetch(url).then(r => r.text());
            //return new Worker(url); // maybe the cache will work?
            data = data.replace(/\$\$PREFIXPATH\$\$/g, JSON.stringify(path + "js/")); // fixing importScripts
            data = data.replace(/\$\$PREFIXLOCPATH\$\$/g, JSON.stringify(path)); // fixing importScripts
            data = data.replace("$$PREFETCHDATA$$", globalThis.PrefetchInject); // fixing importScripts
            // create a blob from the data
            var blob = new Blob([data], { type: "application/javascript" });
            // create a url from the blob
            var blobUrl = URL.createObjectURL(blob);
            // create a worker from the blob url
            var worker = new Worker(blobUrl);
            // log the worker
            console.log("Created worker from url:", url, worker);
            return worker;
        }
    }
}
libLoaderInit();