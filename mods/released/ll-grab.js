exports.modinfo = {
    name: "ll-grab",
    version: "0.1.0",
    dependencies: [],
    modauthor: "TomTheFurry",
};

/** @type {LibLoaderEvents} */
exports.LibLoaderEvents = {
    modInit: function (libloader) {
        const MaxGrabberHalfSize = 31;
        var grabSize = MaxGrabberHalfSize * 2 + 1; // need a center
        var grabArea = grabSize * grabSize;

        libloader.AddInjectionToScriptHeading(() => {
            globalThis.llGrab = {
                MaxGrabberHalfSize: -1,
                AllowShakeSand: false,
                Hooks: {
                    getCurrentActiveAction: null,
                    ToolTypes: null,
                    Tools: null,
                },
                hookOnGrabTick(glb, obj) {
                    globalThis.gameInstance ??= {};
                    globalThis.gameInstance.state ??= glb;
                    /** @type {Uint8Array} */
                    var grabData = glb.shared.grabber;
                    var grabHalfLength = grabData[grabData.length - 1];
                    grabHalfLength = grabHalfLength === 0 ? (
                            this.ChangeGrabberSideLen = null,
                            grabData[grabData.length - 1] = 2+1
                        ) : grabHalfLength;
                    grabHalfLength -= 1;
                    if (this.ChangeGrabberSideLen) {
                        var change = this.ChangeGrabberSideLen;
                        grabHalfLength += change;
                        if (grabHalfLength > this.MaxGrabberHalfSize) {
                            grabHalfLength = this.MaxGrabberHalfSize;
                        }
                        if (grabHalfLength < 0) {
                            grabHalfLength = 0;
                        }
                        if (!globalThis.scriptId) console.log("grabHalfLength", grabHalfLength);
                        this.ChangeGrabberSideLen = null;
                        grabData[grabData.length - 1] = grabHalfLength + 1;
                    }
                    var grabLength = grabHalfLength * 2 + 1;
                    var grabArea = grabLength * grabLength;
                    obj.sideLen = grabLength;
                    obj.area = grabArea;
                    // actually just need a fake array
                    obj.grid = Array.from({ length: grabLength }, (_, _2) => {return { length: grabLength }});
                    obj.halfSideLen = grabHalfLength;

                    if (glb.environment.context !== 1) return obj;

                    var maxSideLen = this.MaxGrabberHalfSize * 2 + 1;
                    var maxArea = maxSideLen * maxSideLen;
                    var halfSize = this.MaxGrabberHalfSize;
                    var shifts = Math.floor((maxSideLen - grabLength) / 2);
                    var idxToPos = (idx) => {return [idx%maxSideLen, Math.floor(idx/maxSideLen)]};

                    var countTotal = 0;
                    var countPerType = [];
                    var countInGrab = 0;
                    for (var i=0; i < maxArea; i++) {
                        var val = grabData[i+2];
                        if (val === 0) continue;
                        countTotal++;
                        countPerType[val] = (countPerType[val] ?? 0) + 1;
                        var pos = idxToPos(i);
                        var gPos = [pos[0]-shifts, pos[1]-shifts];
                        var inGrab = gPos[0] >= 0 && gPos[0] < grabLength && gPos[1] >= 0 && gPos[1] < grabLength;
                        if (inGrab) countInGrab++;
                    }
                    var primaryType = countPerType.reduce((a,b,i) => {
                        if (a == null) return [b,i];
                        return b > a[0] ? [b,i] : a;
                    }, [0,0])[1];
                    // 255 to signal don't filter
                    grabData[0] = glb.session.input.keys["control"] === 3 /* y_BtnStates.Pressed */ ? 255 : primaryType;
                    grabData[1] = countTotal > 255 ? 255 : countTotal;
                    //console.log("types", JSON.stringify(Object.entries(countPerType)));
                    //console.log("itemsCount", itemsCount, "itemsInRange", itemsInRange);
                    //console.log("Action state", JSON.stringify(glb.session.action.state));
                    if (countInGrab == countTotal) return obj;
                    var idxToDist2Cent2 = (idx) => {
                        var pos = idxToPos(idx);
                        var x = pos[0] - halfSize;
                        var y = pos[1] - halfSize;
                        return x*x + y*y;
                    };
                    var idxToDist2Idx2 = (idx, refIdx) => {
                        var pos = idxToPos(idx);
                        var refPos = idxToPos(refIdx);
                        var x = pos[0] - refPos[0];
                        var y = pos[1] - refPos[1];
                        return x*x + y*y;
                    };
                    var posToIdx = (x,y) => {return x + maxSideLen * y};
                    if (countInGrab < grabLength * grabLength) {
                        // has empty spots
                        // pull in items outside of the range
                        var itemsOutside = [];
                        var emptySpots = [];
                        for (var ox=0; ox < maxSideLen; ox++) {
                            for (var oy=0; oy < maxSideLen; oy++) {
                                var idx = posToIdx(ox,oy);
                                var isEmpty = grabData[idx+2] === 0;
                                var nowX = ox - shifts;
                                var nowY = oy - shifts;
                                var inZone = nowX >= 0 && nowX < grabLength && nowY >= 0 && nowY < grabLength;
                                if (isEmpty && inZone) {
                                    emptySpots.push(idx);
                                } else if (!isEmpty && !inZone) {
                                    itemsOutside.push(idx);
                                }
                            }
                        }
                        itemsOutside.sort((a,b) => idxToDist2Cent2(a) - idxToDist2Cent2(b));
                        while (itemsOutside.length > 0 && emptySpots.length > 0) {
                            var itemIdx = itemsOutside.pop(); // get the farthest item
                            var bestEmptyIdxIdx = emptySpots.reduce((a,v,i) => {
                                var dist = idxToDist2Idx2(v, itemIdx);
                                if (a == null) return [dist,i];
                                return dist < a[0] ? [dist,i] : a;
                            }, null)[1];
                            var bestEmptyIdx = emptySpots[bestEmptyIdxIdx];
                            emptySpots.splice(bestEmptyIdxIdx, 1);
                            grabData[bestEmptyIdx+2] = grabData[itemIdx+2];
                            grabData[itemIdx+2] = 0;
                        }
                    }
                    return obj;
                },

                getIdx(ox, oy, currentLen) {
                    var sideLen = this.MaxGrabberHalfSize * 2 + 1;
                    currentLen ??= sideLen;
                    var shift = (sideLen - currentLen) / 2; // should be an integer
                    return (ox+shift) + sideLen * (oy+shift);
                },
                isUsingGrabber() {
                    if (this.Hooks.getCurrentActiveAction == null || this.Hooks.ToolTypes == null || this.Hooks.Tools == null) return false;
                    var action = this.Hooks.getCurrentActiveAction(globalThis.gameInstance.state);
                    return (action != null && action.type == this.Hooks.ToolTypes.Tool && action.id == this.Hooks.Tools.Grabber);
                },
                onMouseWheel(e) {
                    if (!this.isUsingGrabber()) return false;
                    var val = this.ChangeGrabberSideLen ?? 0;
                    val += Math.sign(e.deltaY);
                    this.ChangeGrabberSideLen = val;
                    return true;
                },
                resetIfEmpty() {
                    // do nothing.
                }
            };
        });
        libloader.AddInjectionToScriptHeading(`globalThis.llGrab.MaxGrabberHalfSize = ${MaxGrabberHalfSize};`);
        libloader.AddInjectionToScriptHeading(() => {
            if (globalThis.scriptId) return;
            window.addEventListener("wheel", (e) => {
                globalThis.llGrab.onMouseWheel(e);
            });
        }, "main"); // only on main, changes the grabber size

        libloader.AddPatternPatches(
            {"main":["X"], "336":["e"]},
            (l) => `${l}.Building=2]="Building"`,
            (l) => `${l}.Building=2]="Building",globalThis.llGrab.Hooks.ToolTypes=${l}`,
        );
        libloader.AddPatternPatches(
            {"main":["H"], "336":["e"]},
            (l) => `${l}.Shovel=1]="Shovel",`,
            (l) => `${l}.Shovel=1]="Shovel",globalThis.llGrab.Hooks.Tools=${l},`,
        );
        libloader.AddPatternPatches(
            {"main":["Ef"]}, // Note: Don't thing workers can grab the currnet action... Thankfully we don't need it yet
            (l) => `${l}=function(`,
            (l) => `${l}=globalThis.llGrab.Hooks.getCurrentActiveAction=function(`,
        );

        libloader.AddPatternPatches(
            {"main": ["r","b"],"336": ["e","i.vJ"]},
            (glb, tutT) => `&&${glb}.store.tutorial.active&&${glb}.store.tutorial.currentStep<${tutT}.RefineGoldWithShaker)`,
            (glb, tutT) => `&&(globalThis.llGrab.AllowShakeSand||(${glb}.store.tutorial.active&&${glb}.store.tutorial.currentStep<${tutT}.RefineGoldWithShaker)))`
        );
        libloader.AddPatternPatches(
            {"main":["o"]},
            (grabBuf) => `${grabBuf}=new SharedArrayBuffer(27),`,
            (grabBuf) => `${grabBuf}=new SharedArrayBuffer(2+${grabArea}+1),`
        );
        libloader.AddPatternPatches(
            {
                "main":["r","mf","pf","gf","yf"],
                "336":["e","m","y","S","x"]
            },
            (glb,sideLen,area,grid,halfSideLen) => `=${glb}.session;if(${glb}.environment.context===`,
            (glb,sideLen,area,grid,halfSideLen) => `=${glb}.session;
            var obj = globalThis.llGrab.hookOnGrabTick(${glb},{
                    sideLen:${sideLen},
                    area:${area},
                    grid:${grid},
                    halfSideLen:${halfSideLen}
                });
            ${sideLen} = obj.sideLen;
            ${area} = obj.area;
            ${grid} = obj.grid;
            ${halfSideLen} = obj.halfSideLen;
            if(${glb}.environment.context===`,
        );
        // Fix all empty check
        libloader.AddPatternPatches(
            {"main":["n"], "336":["t"]},
            (v) => `.useMultithreading&&0!==${v}){`,
            (v) => `.useMultithreading&&0!==${v}){globalThis.llGrab.resetIfEmpty();return;`,
        );
        // fix grab idx
        libloader.AddPatternPatches(
            {"main":["g","h","c","pf","gf.length"],"336":["R","f","p","y","S.length"]},
            (v,x,y,a,l) => `${v}=${x}+${y}*Math.sqrt(${a})`,
            (v,x,y,a,l) => `${v}=globalThis.llGrab.getIdx(${x},${y},${l})`,
        );
        libloader.AddPatternPatches(
            {"main":["G","_","S","pf","gf.length"],"336":["Y","D","z","y","S.length"]},
            (v,x,y,a,l) => `${v}=${x}+${y}*Math.sqrt(${a})`,
            (v,x,y,a,l) => `${v}=globalThis.llGrab.getIdx(${x},${y},${l})`,
            2
        );
        // fix grab idx in render
        libloader.AddPatternPatches(
            {"main":["c","u","pf","gf.length"]},
            (x,y,a,l) => `${x}+${y}*Math.sqrt(${a})`,
            (x,y,a,l) => `globalThis.llGrab.getIdx(${x},${y},${l})`,
        );
        // fix shake sand with multi-type-grab
        libloader.AddPatternPatches(
            {"main":["a","n","o"],"336":["s","i.RJ","l"]},
            (e,eType,n) => `if(${e}&&0!==${n}&&${e}===${eType}.WetSand)`,
            (e,eType,n) => `if(0!==${n}&&(${e}===255&&(${e}=${eType}.WetSand),${e}===${eType}.WetSand))`,
        );
        // prevent overflow when grabbing
        libloader.AddPatternPatches(
            {"main":["r"],"336":["e"]},
            (glb) => `${glb}.shared.grabber[1]++)`,
            (glb) => `${glb}<255&&${glb}.shared.grabber[1]++)`,
        )
        // make grab yellow visual turn orange when multi-type-grab is active
        libloader.AddPatternPatches(
            {"main":["t"]},
            (glb) => `${glb}.session.rendering.overlayContext.strokeStyle="yellow",`,
            (glb) => `${glb}.session.rendering.overlayContext.strokeStyle=${glb}.session.input.keys["control"]===3?"orange":"yellow",`,
        )

        // fix grab filtering (disable it) when multi-type-grab is active
        libloader.AddPatternPatches(
            {"main":["I","U"],"336":["O","$"]},
            (e,oe) => `.type;${e}&&${oe}!==${e}||(`,
            (e,oe) => `.type;${e}&&${e}!==255&&${oe}!==${e}||(`,
        );
        libloader.AddPatternPatches(
            {"main":["I","U"],"336":["O","$"]},
            (e,oe) => `(${e}||(${e}=${oe},`,
            (e,oe) => `(${e}&&${e}!==255||(${e}=${oe},`,
            2 // expects 2 matches per file
        );
    }
}